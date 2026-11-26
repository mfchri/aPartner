"use client";

import React, { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Brain, RotateCcw, X } from "lucide-react";
import { useMemoryStore } from "@/store/useMemoryStore";

export function MemoryToast() {
  const { toast, undoLastAction, dismissToast } = useMemoryStore();

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => {
      dismissToast();
    }, 7000);
    return () => clearTimeout(timer);
  }, [toast, dismissToast]);

  return (
    <AnimatePresence>
      {toast && (
        <motion.div
          initial={{ opacity: 0, y: 30, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 30, scale: 0.95 }}
          transition={{ type: "spring", stiffness: 450, damping: 28 }}
          className="fixed bottom-24 right-4 sm:right-6 z-50 max-w-sm w-[calc(100vw-2rem)] glass-panel rounded-2xl p-3.5 shadow-2xl border border-white/20 dark:border-white/10 flex items-center justify-between gap-3 text-xs"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-xl bg-purple-500/20 text-purple-600 dark:text-purple-400 flex items-center justify-center flex-shrink-0">
              <Brain className="w-3.5 h-3.5" />
            </div>
            <p className="truncate text-foreground font-medium text-xs">
              {toast.message}
            </p>
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={undoLastAction}
              className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-accent text-accent-foreground font-semibold text-[11px] shadow-sm transition-all"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Undo</span>
            </motion.button>

            <button
              onClick={dismissToast}
              className="p-1 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
