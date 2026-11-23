"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Menu,
  Settings,
  Bot,
  AlertCircle,
} from "lucide-react";
import { useChatStore } from "@/store/useChatStore";
import { useSettingsStore } from "@/store/useSettingsStore";
import { MessageBubble } from "./MessageBubble";
import { ChatInput } from "./ChatInput";
import { ThemeToggle } from "./ThemeToggle";

interface ChatWindowProps {
  onToggleSidebar: () => void;
  onOpenSettings: () => void;
  onRequireAuth: () => void;
}

export function ChatWindow({
  onToggleSidebar,
  onOpenSettings,
  onRequireAuth,
}: ChatWindowProps) {
  const {
    sessions,
    activeSessionId,
    createSession,
    addMessage,
    updateLastAssistantMessage,
    markLastAssistantMessageError,
    removeLastAssistantMessage,
    isStreaming,
    setIsStreaming,
  } = useChatStore();

  const settings = useSettingsStore();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [toastError, setToastError] = useState<string | null>(null);

  // Ensure an active session exists
  useEffect(() => {
    if (sessions.length === 0) {
      createSession(settings.getFormattedGreeting());
    }
  }, [sessions.length, createSession, settings]);

  const activeSession = sessions.find((s) => s.id === activeSessionId) || sessions[0];

  // Auto-scroll to bottom
  const scrollToBottom = (behavior: ScrollBehavior = "smooth") => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  useEffect(() => {
    scrollToBottom("auto");
  }, [activeSession?.id]);

  useEffect(() => {
    if (isStreaming) {
      scrollToBottom("smooth");
    }
  }, [isStreaming, activeSession?.messages]);

  const handleStopGeneration = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsStreaming(false);
  }, [setIsStreaming]);

  const handleSendMessage = async (text: string) => {
    if (!activeSession) return;
    if (isStreaming) {
      handleStopGeneration();
    }

    // 1. Add user message
    addMessage(activeSession.id, {
      role: "user",
      content: text,
    });

    // 2. Prepare assistant placeholder
    addMessage(activeSession.id, {
      role: "assistant",
      content: "",
    });

    setIsStreaming(true);
    setToastError(null);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    // Build payload messages
    const currentMessages = activeSession.messages;
    const historyPayload = [
      ...currentMessages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      { role: "user" as const, content: text },
    ];

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          messages: historyPayload,
          settings: {
            aiName: settings.aiName,
            userName: settings.userName,
            customGreeting: settings.customGreeting,
            customPrompt: settings.customPrompt,
            tone: settings.tone,
            language: settings.language,
            length: settings.length,
            emoji: settings.emoji,
            temperature: settings.temperature,
            maxOutputTokens: settings.maxOutputTokens,
            model: settings.model,
          },
        }),
      });

      if (!res.ok) {
        if (res.status === 401) {
          onRequireAuth();
          markLastAssistantMessageError(
            activeSession.id,
            "Your passcode session has expired. Please unlock the app."
          );
          return;
        }

        const data = await res.json().catch(() => ({}));
        const errMsg =
          res.status === 429
            ? data.error || "Free Gemini quota reached. Please wait a moment before trying again."
            : data.error || `Server returned error (${res.status})`;

        markLastAssistantMessageError(activeSession.id, errMsg);
        setToastError(errMsg);
        return;
      }

      if (!res.body) {
        markLastAssistantMessageError(activeSession.id, "No response stream received.");
        return;
      }

      // Read SSE stream
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith("data: ")) {
            const jsonStr = trimmed.slice(6);
            try {
              const event = JSON.parse(jsonStr);
              if (event.type === "chunk" && event.text) {
                updateLastAssistantMessage(activeSession.id, event.text);
              } else if (event.type === "error") {
                markLastAssistantMessageError(activeSession.id, event.error);
                setToastError(event.error);
              }
            } catch {
              // ignore parse errors
            }
          }
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") {
        // aborted cleanly
      } else {
        const message = err instanceof Error ? err.message : "Network error during response generation";
        markLastAssistantMessageError(activeSession.id, message);
        setToastError(message);
      }
    } finally {
      setIsStreaming(false);
      abortControllerRef.current = null;
    }
  };

  const handleRegenerate = async () => {
    if (!activeSession || isStreaming) return;

    const msgs = activeSession.messages;
    if (msgs.length < 2) return;

    let lastUserIndex = -1;
    for (let i = msgs.length - 1; i >= 0; i--) {
      if (msgs[i].role === "user") {
        lastUserIndex = i;
        break;
      }
    }

    if (lastUserIndex === -1) return;

    const lastUserPrompt = msgs[lastUserIndex].content;
    removeLastAssistantMessage(activeSession.id);
    handleSendMessage(lastUserPrompt);
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden relative">
      {/* Top Bar */}
      <header className="h-16 px-4 sm:px-6 flex items-center justify-between glass-panel border-x-0 border-t-0 border-b border-white/10 dark:border-white/5 relative z-10 select-none">
        <div className="flex items-center gap-3">
          <motion.button
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.92 }}
            onClick={onToggleSidebar}
            className="p-2 rounded-xl glass-button text-muted-foreground hover:text-foreground"
            aria-label="Toggle navigation drawer"
          >
            <Menu className="w-5 h-5" />
          </motion.button>

          <div className="flex items-center gap-2">
            <div className="relative">
              <motion.div
                whileHover={{ rotate: 10, scale: 1.05 }}
                className="w-9 h-9 rounded-2xl glass-panel flex items-center justify-center text-accent shadow-sm"
              >
                <Bot className="w-5 h-5" />
              </motion.div>
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-background animate-pulse" />
            </div>

            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="text-sm font-bold text-foreground tracking-tight">
                  {settings.aiName}
                </h1>
                <span className="px-1.5 py-0.5 rounded-md text-[10px] font-mono font-medium bg-black/5 dark:bg-white/10 text-muted-foreground border border-white/10">
                  {settings.model}
                </span>
              </div>
              <span className="text-[11px] text-muted-foreground hidden sm:block">
                Private Glassmorphism Assistant
              </span>
            </div>
          </div>
        </div>

        {/* Right Tools */}
        <div className="flex items-center gap-2">
          <ThemeToggle />

          <motion.button
            whileHover={{ scale: 1.08, rotate: 30 }}
            whileTap={{ scale: 0.92 }}
            transition={{ type: "spring", stiffness: 400, damping: 20 }}
            onClick={onOpenSettings}
            className="p-2 rounded-xl glass-button text-foreground/80 hover:text-foreground relative"
            title="Customization & Settings"
            aria-label="Open settings"
          >
            <Settings className="w-5 h-5" />
          </motion.button>
        </div>
      </header>

      {/* Animated Toast Error Alert */}
      <AnimatePresence>
        {toastError && (
          <motion.div
            initial={{ opacity: 0, y: -24, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -24, scale: 0.95 }}
            transition={{ type: "spring", damping: 25, stiffness: 400 }}
            className="absolute top-20 left-1/2 -translate-x-1/2 z-30 max-w-md w-11/12 p-3 rounded-2xl bg-rose-500/90 text-white backdrop-blur-md shadow-xl flex items-center justify-between text-xs"
          >
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{toastError}</span>
            </div>
            <button
              onClick={() => setToastError(null)}
              className="p-1 hover:bg-white/20 rounded-lg ml-2 transition-transform hover:scale-110"
            >
              &times;
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chat Messages List */}
      <div className="flex-1 overflow-y-auto px-2 sm:px-4 py-4 space-y-4">
        {activeSession?.messages.map((message, index) => {
          const isLast = index === activeSession.messages.length - 1;
          return (
            <MessageBubble
              key={message.id}
              message={message}
              isLast={isLast}
              isStreaming={isStreaming}
              onRegenerate={handleRegenerate}
              aiName={settings.aiName}
            />
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Floating Input Bar */}
      <ChatInput
        onSendMessage={handleSendMessage}
        onStopGeneration={handleStopGeneration}
        isStreaming={isStreaming}
      />
    </div>
  );
}
