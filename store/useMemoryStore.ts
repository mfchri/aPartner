import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import {
  MemoryItem,
  MemoryMeta,
  MemorySuggestion,
  MemoryCategory,
} from "@/lib/memoryModels";

export interface MemoryToastState {
  id: string;
  message: string;
  actionType: "saved" | "deleted";
  memory: MemoryItem;
}

interface MemoryStoreState {
  memories: MemoryItem[];
  suggestions: MemorySuggestion[];
  meta: MemoryMeta;
  isLoading: boolean;
  error: string | null;

  // Search & Filter
  searchQuery: string;
  selectedCategory: MemoryCategory | "all";

  // Temporary Chat & Turn Counter
  isTemporaryChat: boolean;
  turnCounter: number;

  // Toast & Modal
  toast: MemoryToastState | null;
  inspectedMemoryIds: string[] | null;

  // Actions
  fetchMemories: () => Promise<void>;
  addMemory: (content: string, category?: MemoryCategory, pinned?: boolean) => Promise<boolean>;
  updateMemory: (id: string, partial: { content?: string; category?: MemoryCategory; pinned?: boolean }) => Promise<boolean>;
  deleteMemory: (id: string) => Promise<boolean>;
  togglePin: (id: string) => Promise<boolean>;
  updateMeta: (partial: Partial<MemoryMeta>) => Promise<boolean>;
  clearAllMemories: () => Promise<boolean>;
  approveSuggestion: (id: string) => Promise<boolean>;
  rejectSuggestion: (id: string) => Promise<boolean>;
  undoLastAction: () => Promise<void>;
  triggerExtract: (recentMessages: Array<{ role: string; content: string }>) => Promise<void>;
  handleCommandAction: (actionData: { action: "saved" | "deleted"; content?: string; memory?: MemoryItem }) => void;
  incrementTurnCount: () => boolean;
  setIsTemporaryChat: (enabled: boolean) => void;
  setSearchQuery: (query: string) => void;
  setSelectedCategory: (category: MemoryCategory | "all") => void;
  setInspectedMemoryIds: (ids: string[] | null) => void;
  dismissToast: () => void;
}

export const useMemoryStore = create<MemoryStoreState>()(
  persist(
    (set, get) => ({
      memories: [],
      suggestions: [],
      meta: {
        schemaVersion: 1,
        mode: "smart",
        extractInterval: 3,
      },
      isLoading: false,
      error: null,

      searchQuery: "",
      selectedCategory: "all",

      isTemporaryChat: false,
      turnCounter: 0,

      toast: null,
      inspectedMemoryIds: null,

      fetchMemories: async () => {
        set({ isLoading: true, error: null });
        try {
          const res = await fetch("/api/memory");
          if (!res.ok) throw new Error("Failed to load memories");
          const data = await res.json();
          set({
            memories: data.memories || [],
            meta: data.meta || { schemaVersion: 1, mode: "smart", extractInterval: 3 },
            suggestions: data.suggestions || [],
            isLoading: false,
          });
        } catch (err) {
          set({
            error: err instanceof Error ? err.message : "Error fetching memories",
            isLoading: false,
          });
        }
      },

      addMemory: async (content, category = "other", pinned = false) => {
        const previousMemories = get().memories;
        const tempId = `temp-${Date.now()}`;
        const now = new Date().toISOString();

        const optimisticItem: MemoryItem = {
          id: tempId,
          content: content.trim(),
          category,
          pinned,
          source: "manual",
          createdAt: now,
          updatedAt: now,
          useCount: 0,
        };

        // Optimistic UI update
        set((state) => ({
          memories: [optimisticItem, ...state.memories],
        }));

        try {
          const res = await fetch("/api/memory", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ content, category, pinned }),
          });

          if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.error || "Failed to create memory");
          }

          const data = await res.json();
          // Replace temp item with saved item
          set((state) => ({
            memories: state.memories.map((m) => (m.id === tempId ? data.memory : m)),
          }));
          return true;
        } catch (err) {
          // Rollback
          set({ memories: previousMemories });
          alert(err instanceof Error ? err.message : "Failed to create memory.");
          return false;
        }
      },

      updateMemory: async (id, partial) => {
        const previousMemories = get().memories;
        const now = new Date().toISOString();

        // Optimistic update
        set((state) => ({
          memories: state.memories.map((m) =>
            m.id === id ? { ...m, ...partial, updatedAt: now } : m
          ),
        }));

        try {
          const res = await fetch(`/api/memory/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(partial),
          });

          if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.error || "Failed to update memory");
          }

          const data = await res.json();
          set((state) => ({
            memories: state.memories.map((m) => (m.id === id ? data.memory : m)),
          }));
          return true;
        } catch (err) {
          // Rollback
          set({ memories: previousMemories });
          alert(err instanceof Error ? err.message : "Failed to update memory.");
          return false;
        }
      },

      deleteMemory: async (id) => {
        const previousMemories = get().memories;
        const target = previousMemories.find((m) => m.id === id);
        if (!target) return false;

        // Optimistic delete
        set((state) => ({
          memories: state.memories.filter((m) => m.id !== id),
        }));

        try {
          const res = await fetch(`/api/memory/${id}`, {
            method: "DELETE",
          });

          if (!res.ok) {
            throw new Error("Failed to delete memory");
          }

          const data = await res.json();
          const deletedMemory: MemoryItem = data.deletedMemory || target;

          // Set undo toast
          set({
            toast: {
              id: deletedMemory.id,
              message: `Memory deleted: "${deletedMemory.content.slice(0, 48)}..."`,
              actionType: "deleted",
              memory: deletedMemory,
            },
          });

          return true;
        } catch (err) {
          // Rollback
          set({ memories: previousMemories });
          alert(err instanceof Error ? err.message : "Failed to delete memory.");
          return false;
        }
      },

      togglePin: async (id) => {
        const target = get().memories.find((m) => m.id === id);
        if (!target) return false;
        return get().updateMemory(id, { pinned: !target.pinned });
      },

      updateMeta: async (partial) => {
        const previousMeta = get().meta;
        const updatedMeta = { ...previousMeta, ...partial };

        // Optimistic update
        set({ meta: updatedMeta });

        try {
          const res = await fetch("/api/memory", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ meta: partial }),
          });

          if (!res.ok) throw new Error("Failed to update memory settings");
          const data = await res.json();
          set({ meta: data.meta });
          return true;
        } catch {
          // Rollback
          set({ meta: previousMeta });
          return false;
        }
      },

      clearAllMemories: async () => {
        const previousMemories = get().memories;
        const previousSuggestions = get().suggestions;

        set({ memories: [], suggestions: [] });

        try {
          const res = await fetch("/api/memory", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ confirm: true }),
          });

          if (!res.ok) throw new Error("Failed to clear memories");
          return true;
        } catch {
          // Rollback
          set({ memories: previousMemories, suggestions: previousSuggestions });
          return false;
        }
      },

      approveSuggestion: async (id) => {
        const target = get().suggestions.find((s) => s.id === id);
        if (!target) return false;

        const previousSuggestions = get().suggestions;
        const previousMemories = get().memories;

        // Optimistic update
        set((state) => ({
          suggestions: state.suggestions.filter((s) => s.id !== id),
        }));

        try {
          const res = await fetch(`/api/memory/pending/${id}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "approve" }),
          });

          if (!res.ok) throw new Error("Failed to approve suggestion");
          const data = await res.json();

          set((state) => ({
            memories: [data.memory, ...state.memories],
          }));
          return true;
        } catch {
          set({ suggestions: previousSuggestions, memories: previousMemories });
          return false;
        }
      },

      rejectSuggestion: async (id) => {
        const previousSuggestions = get().suggestions;
        set((state) => ({
          suggestions: state.suggestions.filter((s) => s.id !== id),
        }));

        try {
          const res = await fetch(`/api/memory/pending/${id}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "reject" }),
          });

          if (!res.ok) throw new Error("Failed to reject suggestion");
          return true;
        } catch {
          set({ suggestions: previousSuggestions });
          return false;
        }
      },

      undoLastAction: async () => {
        const toast = get().toast;
        if (!toast) return;

        set({ toast: null });

        if (toast.actionType === "deleted" && toast.memory) {
          // Re-create the deleted memory
          await get().addMemory(
            toast.memory.content,
            toast.memory.category,
            toast.memory.pinned
          );
        } else if (toast.actionType === "saved" && toast.memory) {
          // Delete the newly saved memory
          await get().deleteMemory(toast.memory.id);
        }
      },

      triggerExtract: async (recentMessages) => {
        const { isTemporaryChat, meta } = get();
        if (isTemporaryChat || meta.mode === "off" || meta.mode === "manual") {
          return;
        }

        try {
          const res = await fetch("/api/memory/extract", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ messages: recentMessages.slice(-4) }),
          });

          if (!res.ok) return;
          const data = await res.json();

          if (data.mode === "smart" && Array.isArray(data.saved) && data.saved.length > 0) {
            const firstSaved = data.saved[0];
            set((state) => {
              // Merge newly saved items
              const existingIds = new Set(state.memories.map((m) => m.id));
              const updated = state.memories.map((m) => {
                const found = data.saved.find((s: MemoryItem) => s.id === m.id);
                return found || m;
              });
              for (const s of data.saved) {
                if (!existingIds.has(s.id)) {
                  updated.unshift(s);
                }
              }
              return {
                memories: updated,
                toast: {
                  id: firstSaved.id,
                  message: `Memory saved: "${firstSaved.content.slice(0, 48)}..."`,
                  actionType: "saved",
                  memory: firstSaved,
                },
              };
            });
          } else if (data.mode === "ask" && Array.isArray(data.suggestions) && data.suggestions.length > 0) {
            set((state) => ({
              suggestions: [...data.suggestions, ...state.suggestions],
            }));
          }
        } catch {
          // Non-blocking auto-extraction, ignore failures
        }
      },

      handleCommandAction: (actionData) => {
        if (!actionData || !actionData.memory) return;
        const memory = actionData.memory;
        if (actionData.action === "saved") {
          set((state) => ({
            memories: [
              memory,
              ...state.memories.filter((m) => m.id !== memory.id),
            ],
            toast: {
              id: memory.id,
              message: `Memory saved: "${memory.content.slice(0, 48)}..."`,
              actionType: "saved",
              memory,
            },
          }));
        } else if (actionData.action === "deleted") {
          set((state) => ({
            memories: state.memories.filter((m) => m.id !== memory.id),
            toast: {
              id: memory.id,
              message: `Memory forgotten: "${memory.content.slice(0, 48)}..."`,
              actionType: "deleted",
              memory,
            },
          }));
        }
      },

      incrementTurnCount: () => {
        const next = get().turnCounter + 1;
        const interval = get().meta.extractInterval || 3;
        set({ turnCounter: next });
        return next % interval === 0;
      },

      setIsTemporaryChat: (enabled) => {
        set({ isTemporaryChat: enabled });
      },

      setSearchQuery: (searchQuery) => {
        set({ searchQuery });
      },

      setSelectedCategory: (selectedCategory) => {
        set({ selectedCategory });
      },

      setInspectedMemoryIds: (ids) => {
        set({ inspectedMemoryIds: ids });
      },

      dismissToast: () => {
        set({ toast: null });
      },
    }),
    {
      name: "glass_chat_memory_ui_v1",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        isTemporaryChat: state.isTemporaryChat,
      }),
    }
  )
);
