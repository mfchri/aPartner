"use client";

import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Square } from "lucide-react";

interface ChatInputProps {
  onSendMessage: (text: string) => void;
  onStopGeneration: () => void;
  isStreaming: boolean;
  disabled?: boolean;
}

export function ChatInput({
  onSendMessage,
  onStopGeneration,
  isStreaming,
  disabled = false,
}: ChatInputProps) {
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    const nextHeight = Math.min(textarea.scrollHeight, 180);
    textarea.style.height = `${Math.max(48, nextHeight)}px`;
  }, [input]);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isStreaming) {
      onStopGeneration();
      return;
    }
    const trimmed = input.trim();
    if (!trimmed || disabled) return;

    onSendMessage(trimmed);
    setInput("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "48px";
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-3 sm:px-6 pb-4 pt-2">
      <form
        onSubmit={handleSubmit}
        className="glass-input rounded-2xl p-1.5 sm:p-2 flex items-end gap-2 shadow-xl relative transition-all duration-200 focus-within:ring-2 focus-within:ring-accent/40"
      >
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type your message... (Enter to send, Shift+Enter for new line)"
          rows={1}
          disabled={disabled}
          className="flex-1 max-h-44 min-h-[44px] bg-transparent resize-none px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none rounded-xl"
        />

        <div className="flex-shrink-0 w-10 h-10 relative flex items-center justify-center">
          <AnimatePresence mode="wait">
            {isStreaming ? (
              <motion.button
                key="stop-btn"
                initial={{ scale: 0.6, rotate: -45, opacity: 0 }}
                animate={{ scale: 1, rotate: 0, opacity: 1 }}
                exit={{ scale: 0.6, rotate: 45, opacity: 0 }}
                transition={{ duration: 0.18 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.92 }}
                type="button"
                onClick={onStopGeneration}
                className="w-10 h-10 rounded-xl bg-rose-500 hover:bg-rose-600 text-white flex items-center justify-center shadow-md active:scale-95"
                title="Stop generation"
                aria-label="Stop generation"
              >
                <Square className="w-4 h-4 fill-current" />
              </motion.button>
            ) : (
              <motion.button
                key="send-btn"
                initial={{ scale: 0.6, rotate: 45, opacity: 0 }}
                animate={{ scale: 1, rotate: 0, opacity: 1 }}
                exit={{ scale: 0.6, rotate: -45, opacity: 0 }}
                transition={{ duration: 0.18 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.92 }}
                type="submit"
                disabled={disabled || !input.trim()}
                className="w-10 h-10 rounded-xl bg-accent hover:opacity-90 disabled:opacity-40 text-accent-foreground flex items-center justify-center shadow-md active:scale-95 disabled:pointer-events-none"
                title="Send message (Enter)"
                aria-label="Send message"
              >
                <Send className="w-4 h-4" />
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </form>

      <div className="flex items-center justify-between text-[11px] text-muted-foreground/60 px-3 mt-1.5">
        <span className="hidden sm:inline">Shift + Enter for new line</span>
        <span className="ml-auto">{input.length} / 8000</span>
      </div>
    </div>
  );
}
