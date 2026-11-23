"use client";

import React, { useState } from "react";
import {
  MessageSquarePlus,
  Search,
  Trash2,
  Edit2,
  Check,
  X,
  Settings,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
} from "lucide-react";
import { useChatStore, ChatSession } from "@/store/useChatStore";

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  onOpenSettings: () => void;
  aiName: string;
}

export function Sidebar({ isOpen, onToggle, onOpenSettings, aiName }: SidebarProps) {
  const {
    sessions,
    activeSessionId,
    searchQuery,
    createSession,
    selectSession,
    renameSession,
    deleteSession,
    setSearchQuery,
  } = useChatStore();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");

  const handleStartRename = (session: ChatSession, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(session.id);
    setEditTitle(session.title);
  };

  const handleSaveRename = (id: string, e: React.MouseEvent | React.FormEvent) => {
    e.stopPropagation();
    renameSession(id, editTitle);
    setEditingId(null);
  };

  const handleCancelRename = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(null);
  };

  const handleDeleteSession = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("Delete this conversation?")) {
      deleteSession(id);
    }
  };

  const filteredSessions = sessions.filter((s) =>
    s.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          onClick={onToggle}
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-30 md:hidden"
        />
      )}

      {/* Sidebar Panel */}
      <aside
        className={`fixed md:static inset-y-0 left-0 z-40 w-72 sm:w-80 glass-panel flex flex-col transition-transform duration-300 ease-in-out ${
          isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0 md:w-0 md:overflow-hidden md:p-0 md:border-none"
        }`}
      >
        {/* Top Header */}
        <div className="p-4 flex items-center justify-between border-b border-white/10 dark:border-white/5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-accent text-accent-foreground flex items-center justify-center font-bold text-sm shadow-md">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold tracking-tight text-foreground">Glass Chat</h2>
              <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-emerald-500" /> Private &bull; Client Storage
              </span>
            </div>
          </div>

          <button
            onClick={onToggle}
            className="md:hidden p-1.5 rounded-lg glass-button text-muted-foreground hover:text-foreground"
            aria-label="Close sidebar"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>

        {/* New Chat Button */}
        <div className="p-3">
          <button
            onClick={() => createSession()}
            className="w-full py-2.5 px-4 rounded-xl bg-accent/90 hover:bg-accent text-accent-foreground font-medium text-sm flex items-center justify-center gap-2 shadow-sm transition-all hover:translate-y-[-1px]"
          >
            <MessageSquarePlus className="w-4 h-4" />
            <span>New Chat</span>
          </button>
        </div>

        {/* Search Bar */}
        <div className="px-3 pb-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search chats..."
              className="w-full pl-9 pr-3 py-1.5 rounded-xl glass-input text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* Sessions List */}
        <div className="flex-1 overflow-y-auto px-2 py-1 space-y-1">
          {filteredSessions.length === 0 ? (
            <div className="text-center py-8 text-xs text-muted-foreground/60">
              {searchQuery ? "No matching chats found" : "No chats yet. Start a new one!"}
            </div>
          ) : (
            filteredSessions.map((session) => {
              const isActive = session.id === activeSessionId;
              const isEditing = session.id === editingId;

              return (
                <div
                  key={session.id}
                  onClick={() => selectSession(session.id)}
                  className={`group relative flex items-center justify-between px-3 py-2.5 rounded-xl text-xs cursor-pointer transition-all ${
                    isActive
                      ? "bg-accent/15 text-foreground font-medium border border-accent/30 shadow-sm"
                      : "text-foreground/75 hover:bg-black/5 dark:hover:bg-white/5"
                  }`}
                >
                  {isEditing ? (
                    <form
                      onSubmit={(e) => handleSaveRename(session.id, e)}
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center gap-1 w-full"
                    >
                      <input
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        autoFocus
                        className="flex-1 px-2 py-0.5 rounded bg-white/20 dark:bg-black/30 border border-white/30 text-xs focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={(e) => handleSaveRename(session.id, e)}
                        className="p-1 text-emerald-500 hover:text-emerald-400"
                      >
                        <Check className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={handleCancelRename}
                        className="p-1 text-rose-500 hover:text-rose-400"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </form>
                  ) : (
                    <>
                      <span className="truncate pr-2">{session.title}</span>

                      {/* Action buttons on hover */}
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => handleStartRename(session, e)}
                          className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 text-muted-foreground hover:text-foreground"
                          title="Rename"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                        <button
                          onClick={(e) => handleDeleteSession(session.id, e)}
                          className="p-1 rounded hover:bg-rose-500/10 text-muted-foreground hover:text-rose-500"
                          title="Delete"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer / Settings Link */}
        <div className="p-3 border-t border-white/10 dark:border-white/5 flex items-center justify-between">
          <button
            onClick={onOpenSettings}
            className="flex items-center gap-2 px-3 py-2 rounded-xl glass-button text-xs font-medium text-foreground/80 hover:text-foreground w-full justify-center"
          >
            <Settings className="w-3.5 h-3.5 text-accent" />
            <span>Customize AI & Settings</span>
          </button>
        </div>
      </aside>
    </>
  );
}
