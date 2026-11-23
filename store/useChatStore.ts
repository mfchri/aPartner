import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export interface ChatMessageItem {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
  isError?: boolean;
}

export interface ChatSession {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: ChatMessageItem[];
}

interface ChatStoreState {
  sessions: ChatSession[];
  activeSessionId: string | null;
  searchQuery: string;
  isStreaming: boolean;

  // Actions
  createSession: (initialGreeting?: string) => string;
  selectSession: (id: string) => void;
  renameSession: (id: string, newTitle: string) => void;
  deleteSession: (id: string) => void;
  addMessage: (sessionId: string, message: Omit<ChatMessageItem, "id" | "timestamp">) => string;
  updateLastAssistantMessage: (sessionId: string, chunk: string, replace?: boolean) => void;
  markLastAssistantMessageError: (sessionId: string, errorText: string) => void;
  removeLastAssistantMessage: (sessionId: string) => void;
  setSearchQuery: (query: string) => void;
  setIsStreaming: (isStreaming: boolean) => void;
  clearAllSessions: () => void;
  importSessions: (imported: ChatSession[]) => void;
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

export const useChatStore = create<ChatStoreState>()(
  persist(
    (set, get) => ({
      sessions: [],
      activeSessionId: null,
      searchQuery: "",
      isStreaming: false,

      createSession: (initialGreeting) => {
        const id = generateId();
        const now = Date.now();
        const defaultGreeting = initialGreeting || "Hello! How can I assist you today?";

        const newSession: ChatSession = {
          id,
          title: "New Chat",
          createdAt: now,
          updatedAt: now,
          messages: [
            {
              id: generateId(),
              role: "assistant",
              content: defaultGreeting,
              timestamp: now,
            },
          ],
        };

        set((state) => ({
          sessions: [newSession, ...state.sessions],
          activeSessionId: id,
        }));

        return id;
      },

      selectSession: (id) => {
        set({ activeSessionId: id });
      },

      renameSession: (id, newTitle) => {
        set((state) => ({
          sessions: state.sessions.map((s) =>
            s.id === id ? { ...s, title: newTitle.trim() || "Untitled", updatedAt: Date.now() } : s
          ),
        }));
      },

      deleteSession: (id) => {
        set((state) => {
          const remaining = state.sessions.filter((s) => s.id !== id);
          let nextActive = state.activeSessionId;
          if (state.activeSessionId === id) {
            nextActive = remaining.length > 0 ? remaining[0].id : null;
          }
          return {
            sessions: remaining,
            activeSessionId: nextActive,
          };
        });
      },

      addMessage: (sessionId, message) => {
        const msgId = generateId();
        const now = Date.now();
        const fullMessage: ChatMessageItem = {
          ...message,
          id: msgId,
          timestamp: now,
        };

        set((state) => {
          return {
            sessions: state.sessions.map((session) => {
              if (session.id !== sessionId) return session;

              let updatedTitle = session.title;
              // Auto-title from the first user message if title is still "New Chat"
              if (message.role === "user" && session.title === "New Chat") {
                const words = message.content.trim().slice(0, 36);
                updatedTitle = words.length >= 36 ? `${words}...` : words;
              }

              return {
                ...session,
                title: updatedTitle,
                updatedAt: now,
                messages: [...session.messages, fullMessage],
              };
            }),
          };
        });

        return msgId;
      },

      updateLastAssistantMessage: (sessionId, content, replace = false) => {
        set((state) => ({
          sessions: state.sessions.map((s) => {
            if (s.id !== sessionId) return s;

            const messages = [...s.messages];
            const lastIdx = messages.length - 1;

            if (lastIdx >= 0 && messages[lastIdx].role === "assistant") {
              const prev = messages[lastIdx];
              messages[lastIdx] = {
                ...prev,
                content: replace ? content : prev.content + content,
                timestamp: Date.now(),
              };
            }

            return {
              ...s,
              updatedAt: Date.now(),
              messages,
            };
          }),
        }));
      },

      markLastAssistantMessageError: (sessionId, errorText) => {
        set((state) => ({
          sessions: state.sessions.map((s) => {
            if (s.id !== sessionId) return s;

            const messages = [...s.messages];
            const lastIdx = messages.length - 1;

            if (lastIdx >= 0 && messages[lastIdx].role === "assistant") {
              messages[lastIdx] = {
                ...messages[lastIdx],
                content: errorText,
                isError: true,
                timestamp: Date.now(),
              };
            }

            return { ...s, messages };
          }),
        }));
      },

      removeLastAssistantMessage: (sessionId) => {
        set((state) => ({
          sessions: state.sessions.map((s) => {
            if (s.id !== sessionId) return s;
            const messages = [...s.messages];
            if (messages.length > 0 && messages[messages.length - 1].role === "assistant") {
              messages.pop();
            }
            return { ...s, messages };
          }),
        }));
      },

      setSearchQuery: (query) => {
        set({ searchQuery: query });
      },

      setIsStreaming: (isStreaming) => {
        set({ isStreaming });
      },

      clearAllSessions: () => {
        set({ sessions: [], activeSessionId: null });
      },

      importSessions: (imported) => {
        if (!Array.isArray(imported)) return;
        set((state) => {
          const merged = [...imported, ...state.sessions];
          // deduplicate by id
          const uniqueMap = new Map<string, ChatSession>();
          for (const sess of merged) {
            if (sess && sess.id && Array.isArray(sess.messages)) {
              uniqueMap.set(sess.id, sess);
            }
          }
          const uniqueList = Array.from(uniqueMap.values()).sort(
            (a, b) => b.updatedAt - a.updatedAt
          );
          return {
            sessions: uniqueList,
            activeSessionId: uniqueList[0]?.id || null,
          };
        });
      },
    }),
    {
      name: "glass_chat_history_v1",
      storage: createJSONStorage(() => localStorage),
    }
  )
);
