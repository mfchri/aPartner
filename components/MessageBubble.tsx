"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { Copy, Check, RotateCw, AlertTriangle, User, Bot, Brain } from "lucide-react";
import { ChatMessageItem } from "@/store/useChatStore";
import { useMemoryStore } from "@/store/useMemoryStore";

interface MessageBubbleProps {
  message: ChatMessageItem;
  isLast: boolean;
  isStreaming: boolean;
  onRegenerate?: () => void;
  aiName: string;
}

export function MessageBubble({
  message,
  isLast,
  isStreaming,
  onRegenerate,
  aiName,
}: MessageBubbleProps) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === "user";
  const { setInspectedMemoryIds } = useMemoryStore();

  const handleCopyMessage = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 14, scale: 0.98, x: isUser ? 10 : -10 }}
      animate={{ opacity: 1, y: 0, scale: 1, x: 0 }}
      transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
      className={`group flex w-full gap-3 px-2 sm:px-4 py-2 ${
        isUser ? "justify-end" : "justify-start"
      }`}
    >
      {/* Bot Avatar */}
      {!isUser && (
        <motion.div
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 450, damping: 25 }}
          className="flex-shrink-0 w-8 h-8 rounded-xl glass-panel flex items-center justify-center text-accent mt-0.5 shadow-sm"
        >
          <Bot className="w-4 h-4" />
        </motion.div>
      )}

      {/* Bubble Container */}
      <motion.div
        whileHover={{ y: -1 }}
        transition={{ duration: 0.15 }}
        className={`max-w-[88%] sm:max-w-[80%] md:max-w-[72%] rounded-2xl px-4 py-3.5 relative text-sm leading-relaxed transition-colors shadow-sm ${
          isUser
            ? "glass-bubble-user text-foreground"
            : message.isError
            ? "bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 backdrop-blur-md"
            : "glass-bubble-ai text-foreground"
        }`}
      >
        {/* Header with Name and Time */}
        <div className="flex items-center justify-between gap-2 mb-1.5 opacity-60 text-[11px] font-medium">
          <span>{isUser ? "You" : aiName}</span>
          <span>
            {new Date(message.timestamp).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </div>

        {/* Message Content */}
        {message.isError ? (
          <div className="flex items-start gap-2 text-sm">
            <AlertTriangle className="w-4 h-4 text-rose-500 mt-0.5 flex-shrink-0" />
            <p className="whitespace-pre-wrap">{message.content}</p>
          </div>
        ) : isUser ? (
          <p className="whitespace-pre-wrap break-words">{message.content}</p>
        ) : (
          <div className="prose dark:prose-invert prose-sm max-w-none break-words space-y-2 [&>ul]:list-disc [&>ul]:pl-5 [&>ol]:list-decimal [&>ol]:pl-5 [&>p]:leading-relaxed">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeHighlight]}
              components={{
                a: ({ ...props }) => (
                  <a
                    {...props}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-500 hover:text-blue-600 underline font-medium"
                  />
                ),
                pre: ({ children, ...props }) => (
                  <CodeBlock {...props}>{children}</CodeBlock>
                ),
                table: ({ ...props }) => (
                  <div className="overflow-x-auto my-3 rounded-lg border border-white/20 dark:border-white/10">
                    <table {...props} className="min-w-full text-xs text-left" />
                  </div>
                ),
                th: ({ ...props }) => (
                  <th
                    {...props}
                    className="bg-black/5 dark:bg-white/5 px-3 py-2 font-semibold border-b border-white/20 dark:border-white/10"
                  />
                ),
                td: ({ ...props }) => (
                  <td
                    {...props}
                    className="px-3 py-2 border-b border-white/10 dark:border-white/5"
                  />
                ),
              }}
            >
              {message.content}
            </ReactMarkdown>

            {/* Streaming Pulse indicator */}
            {isLast && isStreaming && (
              <motion.span
                animate={{ opacity: [0.3, 1, 0.3], scale: [0.95, 1.05, 0.95] }}
                transition={{ duration: 0.8, repeat: Infinity, ease: "easeInOut" }}
                className="inline-block w-2 h-4 ml-1 bg-accent rounded-sm align-middle shadow-sm"
              />
            )}
          </div>
        )}

        {/* Action Toolbar */}
        <div
          className={`flex items-center gap-1.5 mt-2 pt-1 border-t border-white/10 dark:border-white/5 text-[11px] text-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity ${
            isUser ? "justify-end" : "justify-start"
          }`}
        >
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.92 }}
            onClick={handleCopyMessage}
            className="flex items-center gap-1 px-2 py-0.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
            title="Copy message"
          >
            {copied ? (
              <>
                <Check className="w-3 h-3 text-emerald-500" />
                <span className="text-emerald-500 font-medium">Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3 h-3" />
                <span>Copy</span>
              </>
            )}
          </motion.button>

          {!isUser && message.usedMemoryIds && message.usedMemoryIds.length > 0 && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.92 }}
              onClick={() => setInspectedMemoryIds(message.usedMemoryIds || null)}
              className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-purple-500/15 text-purple-600 dark:text-purple-400 font-medium hover:bg-purple-500/25 transition-colors"
              title={`This answer used ${message.usedMemoryIds.length} memorized facts`}
            >
              <Brain className="w-3 h-3" />
              <span>Memory ({message.usedMemoryIds.length})</span>
            </motion.button>
          )}

          {!isUser && isLast && !isStreaming && onRegenerate && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.92 }}
              onClick={onRegenerate}
              className="flex items-center gap-1 px-2 py-0.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
              title="Regenerate last response"
            >
              <RotateCw className="w-3 h-3" />
              <span>Regenerate</span>
            </motion.button>
          )}
        </div>
      </motion.div>

      {/* User Avatar */}
      {isUser && (
        <motion.div
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 450, damping: 25 }}
          className="flex-shrink-0 w-8 h-8 rounded-xl glass-panel flex items-center justify-center text-foreground/80 mt-0.5 shadow-sm"
        >
          <User className="w-4 h-4" />
        </motion.div>
      )}
    </motion.div>
  );
}

function CodeBlock({ children, ...props }: React.HTMLAttributes<HTMLPreElement>) {
  const [copied, setCopied] = useState(false);

  const extractText = (node: React.ReactNode): string => {
    if (typeof node === "string") return node;
    if (Array.isArray(node)) return node.map(extractText).join("");
    if (node && typeof node === "object" && "props" in node) {
      return extractText((node as { props: { children?: React.ReactNode } }).props.children);
    }
    return "";
  };

  const handleCopyCode = async () => {
    const codeString = extractText(children);
    try {
      await navigator.clipboard.writeText(codeString);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  return (
    <div className="relative my-3 rounded-xl overflow-hidden border border-white/20 dark:border-white/10 bg-black/40 backdrop-blur-md text-slate-200 shadow-md">
      <div className="flex items-center justify-between px-3 py-1.5 bg-white/5 border-b border-white/10 text-[11px] text-slate-400">
        <span className="font-mono">Code</span>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.92 }}
          onClick={handleCopyCode}
          className="flex items-center gap-1 px-2 py-0.5 rounded hover:bg-white/10 text-slate-300 transition-colors"
          title="Copy code"
        >
          {copied ? (
            <>
              <Check className="w-3 h-3 text-emerald-400" />
              <span className="text-emerald-400">Copied</span>
            </>
          ) : (
            <>
              <Copy className="w-3 h-3" />
              <span>Copy</span>
            </>
          )}
        </motion.button>
      </div>
      <pre {...props} className="p-3 text-xs overflow-x-auto font-mono">
        {children}
      </pre>
    </div>
  );
}
