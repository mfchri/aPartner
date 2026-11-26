"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Brain, X, Pin, Sparkles } from "lucide-react";
import { useMemoryStore } from "@/store/useMemoryStore";

export function InspectedMemoriesModal() {
  const { inspectedMemoryIds, memories, setInspectedMemoryIds } = useMemoryStore();

  if (!inspectedMemoryIds || inspectedMemoryIds.length === 0) return null;

  const usedItems = memories.filter((m) => inspectedMemoryIds.includes(m.id));

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setInspectedMemoryIds(null)}
          className="fixed inset-0 bg-black/40 backdrop-blur-sm"
        />

        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 15 }}
          transition={{ type: "spring", damping: 25, stiffness: 350 }}
          className="w-full max-w-md glass-panel rounded-3xl p-5 relative z-10 shadow-2xl border border-white/20 dark:border-white/10 space-y-4"
        >
          <div className="flex items-center justify-between border-b border-white/10 dark:border-white/5 pb-3">
            <div className="flex items-center gap-2 text-foreground font-semibold text-sm">
              <div className="w-7 h-7 rounded-xl bg-purple-500/20 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                <Brain className="w-4 h-4" />
              </div>
              <span>Memories Used for this Answer</span>
            </div>
            <button
              onClick={() => setInspectedMemoryIds(null)}
              className="p-1 rounded-xl glass-button text-muted-foreground hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <p className="text-xs text-muted-foreground">
            The assistant referenced these background facts about you to tailor its response:
          </p>

          <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
            {usedItems.length === 0 ? (
              <p className="text-xs text-muted-foreground italic py-3 text-center">
                These memories have since been updated or removed.
              </p>
            ) : (
              usedItems.map((mem) => (
                <div
                  key={mem.id}
                  className="p-3 rounded-2xl glass-panel border border-white/10 text-xs text-foreground space-y-1.5"
                >
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                    <span className="px-2 py-0.5 rounded-full bg-accent/15 text-accent capitalize font-medium">
                      {mem.category}
                    </span>
                    {mem.pinned && (
                      <span className="flex items-center gap-0.5 text-amber-500 font-medium">
                        <Pin className="w-3 h-3 fill-current" /> Pinned
                      </span>
                    )}
                  </div>
                  <p className="leading-relaxed">{mem.content}</p>
                </div>
              ))
            )}
          </div>

          <div className="pt-1 flex items-center justify-between text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-purple-400" />
              <span>{usedItems.length} active memory context items</span>
            </span>
            <button
              onClick={() => setInspectedMemoryIds(null)}
              className="px-3 py-1.5 rounded-xl glass-button font-medium text-foreground text-xs"
            >
              Close
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
