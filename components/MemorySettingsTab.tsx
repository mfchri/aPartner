"use client";

import React, { useState, useRef, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Brain,
  Pin,
  PinOff,
  Trash2,
  Edit3,
  Check,
  X,
  Search,
  Plus,
  Download,
  Upload,
  AlertTriangle,
  Sparkles,
  Clock,
  SlidersHorizontal,
  RefreshCw,
  Info,
} from "lucide-react";
import { useMemoryStore } from "@/store/useMemoryStore";
import {
  MemoryCategory,
  MemoryMode,
  MEMORY_CATEGORIES,
} from "@/lib/memoryModels";

const CATEGORY_STYLES: Record<
  MemoryCategory,
  { label: string; bg: string; text: string; border: string }
> = {
  preference: {
    label: "Preference",
    bg: "bg-blue-500/10 dark:bg-blue-500/20",
    text: "text-blue-600 dark:text-blue-400",
    border: "border-blue-500/30",
  },
  personal: {
    label: "Personal",
    bg: "bg-purple-500/10 dark:bg-purple-500/20",
    text: "text-purple-600 dark:text-purple-400",
    border: "border-purple-500/30",
  },
  work: {
    label: "Work",
    bg: "bg-amber-500/10 dark:bg-amber-500/20",
    text: "text-amber-600 dark:text-amber-400",
    border: "border-amber-500/30",
  },
  project: {
    label: "Project",
    bg: "bg-emerald-500/10 dark:bg-emerald-500/20",
    text: "text-emerald-600 dark:text-emerald-400",
    border: "border-emerald-500/30",
  },
  interest: {
    label: "Interest",
    bg: "bg-cyan-500/10 dark:bg-cyan-500/20",
    text: "text-cyan-600 dark:text-cyan-400",
    border: "border-cyan-500/30",
  },
  other: {
    label: "Other",
    bg: "bg-slate-500/10 dark:bg-slate-500/20",
    text: "text-slate-600 dark:text-slate-400",
    border: "border-slate-500/30",
  },
};

export function MemorySettingsTab() {
  const {
    memories,
    suggestions,
    meta,
    isLoading,
    fetchMemories,
    addMemory,
    updateMemory,
    deleteMemory,
    togglePin,
    updateMeta,
    clearAllMemories,
    approveSuggestion,
    rejectSuggestion,
  } = useMemoryStore();

  // Load latest memories when tab mounts
  useEffect(() => {
    fetchMemories();
  }, [fetchMemories]);

  // Search & Filter
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<MemoryCategory | "all">("all");

  // Add memory form state
  const [isAddFormOpen, setIsAddFormOpen] = useState(false);
  const [newContent, setNewContent] = useState("");
  const [newCategory, setNewCategory] = useState<MemoryCategory>("preference");
  const [newPinned, setNewPinned] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Edit inline memory state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [editCategory, setEditCategory] = useState<MemoryCategory>("preference");
  const [editPinned, setEditPinned] = useState(false);

  // Import / Export state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  // Danger zone state
  const [isClearModalOpen, setIsClearModalOpen] = useState(false);
  const [clearConfirmText, setClearConfirmText] = useState("");

  // Filter memories
  const filteredMemories = useMemo(() => {
    return memories.filter((m) => {
      const matchesCategory = selectedCategory === "all" || m.category === selectedCategory;
      const matchesSearch =
        !search.trim() ||
        m.content.toLowerCase().includes(search.toLowerCase()) ||
        m.category.toLowerCase().includes(search.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [memories, selectedCategory, search]);

  // Handle Add Memory
  const handleAddMemory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContent.trim()) return;
    if (newContent.length > 300) {
      alert("Memory content cannot exceed 300 characters.");
      return;
    }

    setIsSubmitting(true);
    const success = await addMemory(newContent.trim(), newCategory, newPinned);
    setIsSubmitting(false);

    if (success) {
      setNewContent("");
      setNewPinned(false);
      setIsAddFormOpen(false);
    }
  };

  // Start inline editing
  const handleStartEdit = (m: (typeof memories)[0]) => {
    setEditingId(m.id);
    setEditContent(m.content);
    setEditCategory(m.category);
    setEditPinned(m.pinned);
  };

  // Save inline edit
  const handleSaveEdit = async (id: string) => {
    if (!editContent.trim()) return;
    if (editContent.length > 300) {
      alert("Memory content cannot exceed 300 characters.");
      return;
    }

    const success = await updateMemory(id, {
      content: editContent.trim(),
      category: editCategory,
      pinned: editPinned,
    });

    if (success) {
      setEditingId(null);
    }
  };

  // Cancel edit
  const handleCancelEdit = () => {
    setEditingId(null);
  };

  // Export JSON backup
  const handleExport = async () => {
    setIsExporting(true);
    try {
      const res = await fetch("/api/memory/export");
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `glasschat-memories-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to export memories");
    } finally {
      setIsExporting(false);
    }
  };

  // Import JSON backup
  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setImportStatus("Importing memories...");
      const text = await file.text();
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        throw new Error("Invalid JSON file");
      }

      const res = await fetch("/api/memory/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Import failed");
      }

      setImportStatus(
        `Imported: ${data.addedCount || 0} added, ${data.updatedCount || 0} updated, ${data.skippedCount || 0} skipped.`
      );
      await fetchMemories();
      setTimeout(() => setImportStatus(null), 5000);
    } catch (err) {
      setImportStatus(`Import failed: ${err instanceof Error ? err.message : "Error"}`);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Wipe all memories
  const handleConfirmClearAll = async () => {
    if (clearConfirmText.trim().toUpperCase() !== "DELETE") {
      alert('Please type "DELETE" to confirm.');
      return;
    }

    const success = await clearAllMemories();
    if (success) {
      setIsClearModalOpen(false);
      setClearConfirmText("");
    } else {
      alert("Failed to clear memories. Please try again.");
    }
  };

  const isNearLimit = memories.length >= 180;
  const isAtLimit = memories.length >= 200;

  return (
    <div className="space-y-6">
      {/* Header Info & Capacity Chip */}
      <div className="p-4 rounded-2xl glass-panel border border-white/20 dark:border-white/10 space-y-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Brain className="w-4 h-4 text-accent" />
            <span className="text-xs font-bold text-foreground">Long-Term Memory</span>
          </div>
          <div
            className={`px-2.5 py-1 rounded-full text-[11px] font-mono font-medium border ${
              isAtLimit
                ? "bg-rose-500/10 border-rose-500/30 text-rose-500"
                : isNearLimit
                ? "bg-amber-500/10 border-amber-500/30 text-amber-500"
                : "bg-accent/10 border-accent/20 text-accent"
            }`}
          >
            {memories.length} / 200 memories
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          Stores durable personal facts, preferred coding styles, language habits, and ongoing projects across all your chat sessions and devices.
        </p>
      </div>

      {/* Memory Mode Selector */}
      <div className="space-y-3">
        <label className="block text-xs font-semibold text-foreground">Memory Mode</label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            {
              id: "smart" as MemoryMode,
              title: "Smart",
              desc: "Auto-extracts facts with toast notifications & Undo",
              icon: Sparkles,
            },
            {
              id: "ask_first" as MemoryMode,
              title: "Ask First",
              desc: "Queues suggestions for your manual review",
              icon: Info,
            },
            {
              id: "manual" as MemoryMode,
              title: "Manual",
              desc: "Only commands or entries added here",
              icon: SlidersHorizontal,
            },
            {
              id: "off" as MemoryMode,
              title: "Off",
              desc: "Memory retrieval & saving completely disabled",
              icon: X,
            },
          ].map((modeOption) => {
            const Icon = modeOption.icon;
            const isSelected =
              meta.mode === modeOption.id ||
              (modeOption.id === "ask_first" && meta.mode === "ask");
            return (
              <motion.button
                key={modeOption.id}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => updateMeta({ mode: modeOption.id })}
                className={`p-3 rounded-2xl border text-left flex flex-col justify-between transition-all ${
                  isSelected
                    ? "bg-accent/15 border-accent text-accent shadow-sm"
                    : "glass-button text-muted-foreground hover:text-foreground"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-foreground">{modeOption.title}</span>
                  <Icon className="w-3.5 h-3.5" />
                </div>
                <p className="text-[10px] text-muted-foreground leading-tight">{modeOption.desc}</p>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Extraction Frequency Slider (only when auto extraction is enabled) */}
      {(meta.mode === "smart" || meta.mode === "ask_first" || meta.mode === "ask") && (
        <div className="p-3.5 rounded-2xl glass-panel border border-white/10 dark:border-white/5 space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-accent" />
              <span>Auto-Extraction Frequency</span>
            </label>
            <span className="text-xs font-mono text-accent">
              Every {meta.extractInterval || 3} turns
            </span>
          </div>
          <input
            type="range"
            min="1"
            max="10"
            step="1"
            value={meta.extractInterval || 3}
            onChange={(e) => updateMeta({ extractInterval: parseInt(e.target.value, 10) })}
            className="w-full accent-blue-500 cursor-pointer"
          />
          <span className="text-[10px] text-muted-foreground block">
            Also triggers immediately when phrases like &ldquo;remember that&rdquo;, &ldquo;my name is&rdquo;, or &ldquo;ingat bahwa&rdquo; appear.
          </span>
        </div>
      )}

      {/* Pending Suggestions (if any exist) */}
      {suggestions.length > 0 && (
        <div className="p-4 rounded-2xl glass-panel border border-accent/30 space-y-3 bg-accent/5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-accent" />
              <h4 className="text-xs font-bold text-foreground">
                Pending Suggestions ({suggestions.length})
              </h4>
            </div>
            <span className="text-[10px] text-accent font-medium">Review required</span>
          </div>
          <div className="space-y-2">
            {suggestions.map((sug) => {
              const catStyle = CATEGORY_STYLES[sug.category] || CATEGORY_STYLES.other;
              return (
                <div
                  key={sug.id}
                  className="p-3 rounded-xl glass-panel border border-white/20 dark:border-white/10 flex items-start justify-between gap-3"
                >
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] font-medium border ${catStyle.bg} ${catStyle.text} ${catStyle.border}`}
                      >
                        {catStyle.label}
                      </span>
                    </div>
                    <p className="text-xs text-foreground leading-relaxed">{sug.content}</p>
                  </div>
                  <div className="flex items-center gap-1.5 pt-0.5">
                    <motion.button
                      whileHover={{ scale: 1.08 }}
                      whileTap={{ scale: 0.92 }}
                      onClick={() => approveSuggestion(sug.id)}
                      className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/30 border border-emerald-500/30"
                      title="Approve & Save"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.08 }}
                      whileTap={{ scale: 0.92 }}
                      onClick={() => rejectSuggestion(sug.id)}
                      className="p-1.5 rounded-lg bg-rose-500/20 text-rose-600 dark:text-rose-400 hover:bg-rose-500/30 border border-rose-500/30"
                      title="Dismiss"
                    >
                      <X className="w-3.5 h-3.5" />
                    </motion.button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Add Memory Section */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-foreground">Stored Memories</label>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setIsAddFormOpen(!isAddFormOpen)}
            disabled={isAtLimit}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-accent text-accent-foreground text-xs font-medium shadow-sm hover:opacity-90 disabled:opacity-50 transition-all"
          >
            {isAddFormOpen ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
            <span>{isAddFormOpen ? "Cancel" : "Add Memory"}</span>
          </motion.button>
        </div>

        <AnimatePresence>
          {isAddFormOpen && (
            <motion.form
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              onSubmit={handleAddMemory}
              className="p-4 rounded-2xl glass-panel border border-accent/30 space-y-3 overflow-hidden"
            >
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-medium text-foreground">Memory Fact / Preference</label>
                  <span
                    className={`text-[10px] font-mono ${
                      newContent.length > 280 ? "text-rose-500 font-bold" : "text-muted-foreground"
                    }`}
                  >
                    {newContent.length} / 300
                  </span>
                </div>
                <textarea
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value.slice(0, 300))}
                  placeholder="e.g. Prefers explanations in Indonesian with TypeScript examples"
                  rows={2}
                  className="w-full px-3 py-2 rounded-xl glass-input text-foreground text-xs focus:outline-none resize-none"
                  autoFocus
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <label className="text-xs text-muted-foreground">Category:</label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value as MemoryCategory)}
                    className="px-2.5 py-1.5 rounded-xl glass-input text-foreground text-xs focus:outline-none capitalize"
                  >
                    {MEMORY_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat} className="bg-background text-foreground capitalize">
                        {CATEGORY_STYLES[cat]?.label || cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1.5 cursor-pointer text-xs text-foreground">
                    <input
                      type="checkbox"
                      checked={newPinned}
                      onChange={(e) => setNewPinned(e.target.checked)}
                      className="rounded accent-blue-500 cursor-pointer"
                    />
                    <Pin className={`w-3.5 h-3.5 ${newPinned ? "text-accent fill-accent" : "text-muted-foreground"}`} />
                    <span>Pin memory</span>
                  </label>

                  <motion.button
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    type="submit"
                    disabled={isSubmitting || !newContent.trim()}
                    className="px-3.5 py-1.5 rounded-xl bg-accent text-accent-foreground text-xs font-medium shadow-sm hover:opacity-90 disabled:opacity-50 transition-all flex items-center gap-1.5"
                  >
                    {isSubmitting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                    <span>Save</span>
                  </motion.button>
                </div>
              </div>
            </motion.form>
          )}
        </AnimatePresence>
      </div>

      {/* Search & Category Filter Chips */}
      <div className="space-y-2">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search saved memories..."
            className="w-full pl-8 pr-8 py-2 rounded-xl glass-input text-foreground text-xs focus:outline-none"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Category Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          <button
            onClick={() => setSelectedCategory("all")}
            className={`px-2.5 py-1 rounded-xl whitespace-nowrap transition-all border ${
              selectedCategory === "all"
                ? "bg-accent text-accent-foreground border-accent font-semibold shadow-sm"
                : "glass-button text-muted-foreground hover:text-foreground"
            }`}
          >
            All ({memories.length})
          </button>
          {MEMORY_CATEGORIES.map((cat) => {
            const count = memories.filter((m) => m.category === cat).length;
            const isSelected = selectedCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-2.5 py-1 rounded-xl whitespace-nowrap transition-all border capitalize ${
                  isSelected
                    ? "bg-accent text-accent-foreground border-accent font-semibold shadow-sm"
                    : "glass-button text-muted-foreground hover:text-foreground"
                }`}
              >
                {CATEGORY_STYLES[cat]?.label} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Memory List Cards */}
      <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
        {isLoading && memories.length === 0 ? (
          <div className="py-8 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-accent" />
            <span>Loading memories...</span>
          </div>
        ) : filteredMemories.length === 0 ? (
          <div className="py-8 text-center text-xs text-muted-foreground glass-panel rounded-2xl p-6">
            <Brain className="w-6 h-6 mx-auto mb-2 opacity-40 text-accent" />
            <p className="font-medium text-foreground">
              {memories.length === 0 ? "No memories saved yet" : "No matching memories"}
            </p>
            <p className="text-[11px] text-muted-foreground mt-1 max-w-sm mx-auto">
              {memories.length === 0
                ? "As you chat, the AI will automatically learn facts about you, or you can add them manually above."
                : "Try adjusting your search query or category filter."}
            </p>
          </div>
        ) : (
          filteredMemories.map((m) => {
            const isEditing = editingId === m.id;
            const catStyle = CATEGORY_STYLES[m.category] || CATEGORY_STYLES.other;

            if (isEditing) {
              return (
                <div
                  key={m.id}
                  className="p-3.5 rounded-2xl glass-panel border border-accent/40 space-y-3 bg-accent/5"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-foreground">Edit Memory</span>
                    <span
                      className={`text-[10px] font-mono ${
                        editContent.length > 280 ? "text-rose-500 font-bold" : "text-muted-foreground"
                      }`}
                    >
                      {editContent.length} / 300
                    </span>
                  </div>

                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value.slice(0, 300))}
                    rows={2}
                    className="w-full px-3 py-2 rounded-xl glass-input text-foreground text-xs focus:outline-none resize-none"
                    autoFocus
                  />

                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <select
                        value={editCategory}
                        onChange={(e) => setEditCategory(e.target.value as MemoryCategory)}
                        className="px-2.5 py-1.5 rounded-xl glass-input text-foreground text-xs focus:outline-none capitalize"
                      >
                        {MEMORY_CATEGORIES.map((cat) => (
                          <option key={cat} value={cat} className="bg-background text-foreground capitalize">
                            {CATEGORY_STYLES[cat]?.label || cat}
                          </option>
                        ))}
                      </select>

                      <label className="flex items-center gap-1 cursor-pointer text-xs text-foreground">
                        <input
                          type="checkbox"
                          checked={editPinned}
                          onChange={(e) => setEditPinned(e.target.checked)}
                          className="rounded accent-blue-500 cursor-pointer"
                        />
                        <span className="text-[11px]">Pinned</span>
                      </label>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={handleCancelEdit}
                        className="px-2.5 py-1 rounded-xl glass-button text-xs text-muted-foreground hover:text-foreground"
                      >
                        Cancel
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => handleSaveEdit(m.id)}
                        disabled={!editContent.trim()}
                        className="px-3 py-1 rounded-xl bg-accent text-accent-foreground text-xs font-medium shadow-sm hover:opacity-90 disabled:opacity-50"
                      >
                        Save
                      </motion.button>
                    </div>
                  </div>
                </div>
              );
            }

            return (
              <motion.div
                key={m.id}
                layout
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className={`p-3 rounded-2xl glass-panel border transition-all space-y-2 group ${
                  m.pinned
                    ? "border-accent/40 bg-accent/[0.04]"
                    : "border-white/15 dark:border-white/10 hover:border-white/30"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] font-medium border ${catStyle.bg} ${catStyle.text} ${catStyle.border}`}
                    >
                      {catStyle.label}
                    </span>

                    {m.pinned && (
                      <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] bg-amber-500/10 text-amber-500 border border-amber-500/20 font-medium">
                        <Pin className="w-2.5 h-2.5 fill-amber-500" />
                        <span>Pinned</span>
                      </span>
                    )}

                    <span className="text-[10px] text-muted-foreground/70 capitalize">
                      via {m.source}
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => togglePin(m.id)}
                      className={`p-1 rounded-lg transition-colors ${
                        m.pinned
                          ? "text-amber-500 hover:bg-amber-500/10"
                          : "text-muted-foreground hover:text-foreground hover:bg-white/10"
                      }`}
                      title={m.pinned ? "Unpin memory" : "Pin memory (always included in prompt)"}
                    >
                      {m.pinned ? <Pin className="w-3.5 h-3.5 fill-amber-500" /> : <PinOff className="w-3.5 h-3.5" />}
                    </motion.button>

                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => handleStartEdit(m)}
                      className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/10 transition-colors"
                      title="Edit memory"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </motion.button>

                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => deleteMemory(m.id)}
                      className="p-1 rounded-lg text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 transition-colors"
                      title="Delete memory"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </motion.button>
                  </div>
                </div>

                <p className="text-xs text-foreground leading-relaxed select-text">{m.content}</p>

                <div className="flex items-center justify-between text-[10px] text-muted-foreground/70 pt-0.5">
                  <span>
                    Used {m.useCount || 0} {m.useCount === 1 ? "time" : "times"}
                    {m.lastUsedAt && ` · last ${new Date(m.lastUsedAt).toLocaleDateString()}`}
                  </span>
                  <span>{new Date(m.createdAt).toLocaleDateString()}</span>
                </div>
              </motion.div>
            );
          })
        )}
      </div>

      {/* Backup, Import & Danger Zone */}
      <div className="pt-2 border-t border-white/10 dark:border-white/5 space-y-4">
        {/* Backup & Import */}
        <div className="p-4 rounded-2xl glass-panel space-y-3">
          <div className="flex items-center gap-2">
            <Download className="w-4 h-4 text-accent" />
            <h4 className="text-xs font-semibold text-foreground">Backup & Import Memories</h4>
          </div>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Download your long-term memories as a JSON backup or restore memories from an earlier file.
          </p>

          <div className="flex flex-wrap gap-2 pt-1">
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.96 }}
              onClick={handleExport}
              disabled={isExporting}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-accent text-accent-foreground text-xs font-medium shadow-sm hover:opacity-90 transition-all disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{isExporting ? "Exporting..." : "Export Memories (JSON)"}</span>
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.96 }}
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl glass-button text-xs font-medium text-foreground/80 hover:text-foreground transition-all"
            >
              <Upload className="w-3.5 h-3.5 text-accent" />
              <span>Import Memories</span>
            </motion.button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleImportFile}
              className="hidden"
            />
          </div>

          {importStatus && (
            <div className="text-xs text-blue-500 font-medium">{importStatus}</div>
          )}
        </div>

        {/* Clear All Danger Zone */}
        <div className="p-4 rounded-2xl glass-panel border border-rose-500/20 space-y-3">
          <div className="flex items-center gap-2 text-rose-500">
            <AlertTriangle className="w-4 h-4" />
            <h4 className="text-xs font-semibold">Danger Zone: Forget Everything</h4>
          </div>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Permanently delete all long-term memories and pending suggestions from storage. This action cannot be undone.
          </p>

          {!isClearModalOpen ? (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.96 }}
              onClick={() => setIsClearModalOpen(true)}
              className="px-3.5 py-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs font-medium transition-all"
            >
              Forget All Memories
            </motion.button>
          ) : (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 space-y-2.5">
              <p className="text-xs text-rose-600 dark:text-rose-400 font-medium">
                Type <span className="font-mono font-bold">DELETE</span> to confirm erasing all memories:
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={clearConfirmText}
                  onChange={(e) => setClearConfirmText(e.target.value)}
                  placeholder="Type DELETE"
                  className="px-3 py-1.5 rounded-xl glass-input text-foreground text-xs focus:outline-none w-36 font-mono"
                  autoFocus
                />
                <button
                  onClick={handleConfirmClearAll}
                  disabled={clearConfirmText.trim().toUpperCase() !== "DELETE"}
                  className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-medium transition-all disabled:opacity-40"
                >
                  Confirm Erase
                </button>
                <button
                  onClick={() => {
                    setIsClearModalOpen(false);
                    setClearConfirmText("");
                  }}
                  className="px-3 py-1.5 rounded-xl glass-button text-xs text-muted-foreground hover:text-foreground"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
