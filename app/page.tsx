"use client";

import React, { useState, useEffect, useCallback } from "react";
import { PasscodeGate } from "@/components/PasscodeGate";
import { Sidebar } from "@/components/Sidebar";
import { ChatWindow } from "@/components/ChatWindow";
import { SettingsDialog } from "@/components/SettingsDialog";
import { useSettingsStore } from "@/store/useSettingsStore";

export default function HomePage() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [allowedModels, setAllowedModels] = useState<string[]>(["gemini-3.8-flash"]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const { aiName, model, updateSettings } = useSettingsStore();

  const checkAuth = useCallback(async () => {
    try {
      const res = await fetch("/api/auth");
      const data = await res.json();

      if (data.models && Array.isArray(data.models)) {
        setAllowedModels(data.models);
        // Automatically migrate legacy models (e.g. gemini-2.5-flash) to the current default
        if (!data.models.includes(model) || model === "gemini-2.5-flash") {
          updateSettings({ model: data.defaultModel || data.models[0] || "gemini-3.8-flash" });
        }
      }

      if (data.setupRequired) {
        setSetupError(data.error || "Server passcode configuration is required in production.");
        setIsAuthenticated(false);
      } else {
        setIsAuthenticated(Boolean(data.authenticated));
      }
    } catch {
      setIsAuthenticated(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const handleLockSession = async () => {
    try {
      await fetch("/api/auth", { method: "DELETE" });
    } catch {
      // ignore
    }
    setIsAuthenticated(false);
    setIsSettingsOpen(false);
  };

  // Loading splash while checking auth
  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
      </div>
    );
  }

  // Passcode gate if unauthenticated
  if (!isAuthenticated) {
    return (
      <PasscodeGate
        onSuccess={() => setIsAuthenticated(true)}
        setupError={setupError}
      />
    );
  }

  return (
    <div className="flex h-[100dvh] w-full overflow-hidden relative">
      {/* Sidebar */}
      <Sidebar
        isOpen={isSidebarOpen}
        onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        aiName={aiName}
      />

      {/* Main Chat Interface */}
      <ChatWindow
        onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onRequireAuth={() => setIsAuthenticated(false)}
      />

      {/* Settings Dialog */}
      <SettingsDialog
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        allowedModels={allowedModels}
        onLockSession={handleLockSession}
      />
    </div>
  );
}
