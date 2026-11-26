"use client";

import React, { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  User,
  Sliders,
  Palette,
  Shield,
  Download,
  Upload,
  RefreshCw,
  LogOut,
  Sparkles,
  Cpu,
  Brain,
} from "lucide-react";
import { MemorySettingsTab } from "@/components/MemorySettingsTab";
import {
  useSettingsStore,
  TonePreset,
  LanguagePreset,
  LengthPreset,
  EmojiPreset,
  ThemePreset,
  AccentPreset,
  BackgroundStyle,
} from "@/store/useSettingsStore";
import { useChatStore } from "@/store/useChatStore";
import { exportBackup, parseBackupFile } from "@/lib/storage";

interface SettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  allowedModels: string[];
  onLockSession: () => void;
}

export function SettingsDialog({
  isOpen,
  onClose,
  allowedModels,
  onLockSession,
}: SettingsDialogProps) {
  const settings = useSettingsStore();
  const { sessions, clearAllSessions, importSessions } = useChatStore();
  const [activeTab, setActiveTab] = useState<"persona" | "style" | "model" | "appearance" | "memory" | "data">("persona");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importStatus, setImportStatus] = useState<string | null>(null);

  const handleExport = () => {
    exportBackup(sessions, settings);
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setImportStatus("Importing...");
      const data = await parseBackupFile(file);
      if (data.sessions) {
        importSessions(data.sessions);
      }
      if (data.settings) {
        settings.updateSettings(data.settings);
      }
      setImportStatus("Import successful!");
      setTimeout(() => setImportStatus(null), 3000);
    } catch (err) {
      setImportStatus(`Import failed: ${err instanceof Error ? err.message : "Invalid format"}`);
    }
  };

  const handleClearData = () => {
    if (confirm("Are you sure you want to clear ALL chats stored in this browser? This cannot be undone.")) {
      clearAllSessions();
      alert("All conversations have been erased from browser storage.");
    }
  };

  const handleResetSettings = () => {
    if (confirm("Reset all settings to default values?")) {
      settings.resetSettings();
    }
  };

  const tabs = [
    { id: "persona", label: "Persona", icon: User },
    { id: "style", label: "Style of Talking", icon: Sparkles },
    { id: "model", label: "Model", icon: Cpu },
    { id: "appearance", label: "Appearance", icon: Palette },
    { id: "memory", label: "Memory", icon: Brain },
    { id: "data", label: "Data & Security", icon: Shield },
  ] as const;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 backdrop-blur-md"
          />

          {/* Modal Panel */}
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 16 }}
            transition={{ type: "spring", damping: 25, stiffness: 350 }}
            className="w-full max-w-2xl glass-panel rounded-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden border border-white/20 dark:border-white/10 relative z-10"
          >
            {/* Header */}
            <div className="px-6 py-4 flex items-center justify-between border-b border-white/10 dark:border-white/5">
              <div className="flex items-center gap-2">
                <Sliders className="w-5 h-5 text-accent" />
                <h2 className="text-base font-bold text-foreground">Settings & Customization</h2>
              </div>
              <motion.button
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.92 }}
                onClick={onClose}
                className="p-1.5 rounded-xl glass-button text-muted-foreground hover:text-foreground"
                aria-label="Close settings"
              >
                <X className="w-4 h-4" />
              </motion.button>
            </div>

            {/* Navigation Tabs with sliding pill indicator */}
            <div className="flex items-center gap-1 px-4 py-2 bg-black/5 dark:bg-white/5 overflow-x-auto border-b border-white/10 dark:border-white/5 text-xs font-medium relative">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`relative px-3 py-1.5 rounded-xl transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                      isActive ? "text-accent-foreground font-semibold" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="activeSettingsTabPill"
                        className="absolute inset-0 bg-accent rounded-xl shadow-sm"
                        transition={{ type: "spring", stiffness: 450, damping: 30 }}
                      />
                    )}
                    <span className="relative z-10 flex items-center gap-1.5">
                      <Icon className="w-3.5 h-3.5" />
                      <span>{tab.label}</span>
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Tab Content with Crossfade */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 text-sm">
              <AnimatePresence mode="wait">
                {activeTab === "persona" && (
                  <motion.div
                    key="persona"
                    initial={{ opacity: 0, x: 8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -8 }}
                    transition={{ duration: 0.16 }}
                    className="space-y-4"
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-foreground mb-1.5">AI Name</label>
                        <input
                          type="text"
                          value={settings.aiName}
                          onChange={(e) => settings.updateSettings({ aiName: e.target.value })}
                          placeholder="e.g. Aria"
                          className="w-full px-3 py-2 rounded-xl glass-input text-foreground text-xs focus:outline-none"
                        />
                        <span className="text-[11px] text-muted-foreground mt-1 block">
                          How the assistant introduces itself
                        </span>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-foreground mb-1.5">Your Name</label>
                        <input
                          type="text"
                          value={settings.userName}
                          onChange={(e) => settings.updateSettings({ userName: e.target.value })}
                          placeholder="e.g. Alex"
                          className="w-full px-3 py-2 rounded-xl glass-input text-foreground text-xs focus:outline-none"
                        />
                        <span className="text-[11px] text-muted-foreground mt-1 block">
                          Used to personalize greetings and responses
                        </span>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-foreground mb-1.5">
                        Custom Greeting (supports <code className="font-mono text-accent">{"{{name}}"}</code>)
                      </label>
                      <input
                        type="text"
                        value={settings.customGreeting}
                        onChange={(e) => settings.updateSettings({ customGreeting: e.target.value })}
                        placeholder="Hello {{name}}! How can I assist you today?"
                        className="w-full px-3 py-2 rounded-xl glass-input text-foreground text-xs focus:outline-none"
                      />
                      <span className="text-[11px] text-muted-foreground mt-1 block">
                        Preview: &ldquo;{settings.getFormattedGreeting()}&rdquo;
                      </span>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="block text-xs font-medium text-foreground">Custom System Prompt</label>
                        <span className="text-[11px] text-muted-foreground">{settings.customPrompt.length} / 4000</span>
                      </div>
                      <textarea
                        value={settings.customPrompt}
                        onChange={(e) => settings.updateSettings({ customPrompt: e.target.value.slice(0, 4000) })}
                        rows={4}
                        placeholder="Add custom background rules or expertise (e.g. 'You are a senior full-stack engineer and teach step-by-step with clean code snippets...')"
                        className="w-full px-3 py-2 rounded-xl glass-input text-foreground text-xs focus:outline-none resize-none"
                      />
                    </div>
                  </motion.div>
                )}

                {activeTab === "style" && (
                  <motion.div
                    key="style"
                    initial={{ opacity: 0, x: 8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -8 }}
                    transition={{ duration: 0.16 }}
                    className="space-y-4"
                  >
                    <div>
                      <label className="block text-xs font-medium text-foreground mb-2">Tone Preset</label>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {(["friendly", "casual", "professional", "playful", "concise"] as TonePreset[]).map((t) => (
                          <motion.button
                            key={t}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.96 }}
                            onClick={() => settings.updateSettings({ tone: t })}
                            className={`px-3 py-2 rounded-xl text-xs font-medium capitalize border transition-all ${
                              settings.tone === t
                                ? "bg-accent/20 border-accent text-accent shadow-sm"
                                : "glass-button text-foreground/80 hover:text-foreground"
                            }`}
                          >
                            {t}
                          </motion.button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-foreground mb-2">Response Language</label>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { id: "auto", label: "Auto Detect" },
                          { id: "id", label: "Bahasa Indonesia" },
                          { id: "en", label: "English" },
                        ].map((l) => (
                          <motion.button
                            key={l.id}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.96 }}
                            onClick={() => settings.updateSettings({ language: l.id as LanguagePreset })}
                            className={`px-3 py-2 rounded-xl text-xs font-medium border transition-all ${
                              settings.language === l.id
                                ? "bg-accent/20 border-accent text-accent shadow-sm"
                                : "glass-button text-foreground/80 hover:text-foreground"
                            }`}
                          >
                            {l.label}
                          </motion.button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-foreground mb-2">Response Length</label>
                        <div className="flex gap-2">
                          {(["short", "balanced", "detailed"] as LengthPreset[]).map((len) => (
                            <motion.button
                              key={len}
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.96 }}
                              onClick={() => settings.updateSettings({ length: len })}
                              className={`flex-1 px-3 py-2 rounded-xl text-xs font-medium capitalize border transition-all ${
                                settings.length === len
                                  ? "bg-accent/20 border-accent text-accent shadow-sm"
                                  : "glass-button text-foreground/80 hover:text-foreground"
                              }`}
                            >
                              {len}
                            </motion.button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-foreground mb-2">Emoji Usage</label>
                        <div className="flex gap-2">
                          {[
                            { id: "none", label: "Off" },
                            { id: "few", label: "Some" },
                            { id: "many", label: "Lots" },
                          ].map((em) => (
                            <motion.button
                              key={em.id}
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.96 }}
                              onClick={() => settings.updateSettings({ emoji: em.id as EmojiPreset })}
                              className={`flex-1 px-3 py-2 rounded-xl text-xs font-medium border transition-all ${
                                settings.emoji === em.id
                                  ? "bg-accent/20 border-accent text-accent shadow-sm"
                                  : "glass-button text-foreground/80 hover:text-foreground"
                              }`}
                            >
                              {em.label}
                            </motion.button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {activeTab === "model" && (
                  <motion.div
                    key="model"
                    initial={{ opacity: 0, x: 8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -8 }}
                    transition={{ duration: 0.16 }}
                    className="space-y-5"
                  >
                    <div>
                      <label className="block text-xs font-medium text-foreground mb-1.5">Gemini Model</label>
                      <select
                        value={settings.model}
                        onChange={(e) => settings.updateSettings({ model: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl glass-input text-foreground text-xs focus:outline-none"
                      >
                        {allowedModels.map((m) => (
                          <option key={m} value={m} className="bg-background text-foreground">
                            {m}
                          </option>
                        ))}
                      </select>
                      <span className="text-[11px] text-muted-foreground mt-1 block">
                        Configured from GEMINI_ALLOWED_MODELS on the server
                      </span>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-medium text-foreground">Temperature</label>
                        <span className="text-xs font-mono text-accent">{settings.temperature.toFixed(1)}</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="2"
                        step="0.1"
                        value={settings.temperature}
                        onChange={(e) => settings.updateSettings({ temperature: parseFloat(e.target.value) })}
                        className="w-full accent-blue-500 cursor-pointer"
                      />
                      <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                        <span>0.0 (Precise / Factual)</span>
                        <span>1.0 (Balanced)</span>
                        <span>2.0 (Creative)</span>
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-medium text-foreground">Max Output Tokens</label>
                        <span className="text-xs font-mono text-accent">{settings.maxOutputTokens}</span>
                      </div>
                      <input
                        type="range"
                        min="256"
                        max="2048"
                        step="128"
                        value={settings.maxOutputTokens}
                        onChange={(e) => settings.updateSettings({ maxOutputTokens: parseInt(e.target.value, 10) })}
                        className="w-full accent-blue-500 cursor-pointer"
                      />
                      <span className="text-[11px] text-muted-foreground mt-1 block">
                        Server cap: 2048 tokens to protect free-tier quota
                      </span>
                    </div>
                  </motion.div>
                )}

                {activeTab === "appearance" && (
                  <motion.div
                    key="appearance"
                    initial={{ opacity: 0, x: 8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -8 }}
                    transition={{ duration: 0.16 }}
                    className="space-y-5"
                  >
                    <div>
                      <label className="block text-xs font-medium text-foreground mb-2">Theme Mode</label>
                      <div className="grid grid-cols-3 gap-2">
                        {(["light", "dark", "system"] as ThemePreset[]).map((th) => (
                          <motion.button
                            key={th}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.96 }}
                            onClick={() => settings.updateSettings({ theme: th })}
                            className={`px-3 py-2 rounded-xl text-xs font-medium capitalize border transition-all ${
                              settings.theme === th
                                ? "bg-accent/20 border-accent text-accent shadow-sm"
                                : "glass-button text-foreground/80 hover:text-foreground"
                            }`}
                          >
                            {th}
                          </motion.button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-foreground mb-2">Accent Color</label>
                      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                        {[
                          { id: "blue", label: "Blue", color: "#2563eb" },
                          { id: "emerald", label: "Emerald", color: "#059669" },
                          { id: "violet", label: "Violet", color: "#7c3aed" },
                          { id: "rose", label: "Rose", color: "#e11d48" },
                          { id: "amber", label: "Amber", color: "#d97706" },
                          { id: "cyan", label: "Cyan", color: "#0284c7" },
                        ].map((acc) => (
                          <motion.button
                            key={acc.id}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.94 }}
                            onClick={() => settings.updateSettings({ accent: acc.id as AccentPreset })}
                            className={`flex flex-col items-center gap-1.5 p-2 rounded-xl border transition-all ${
                              settings.accent === acc.id
                                ? "bg-accent/15 border-accent shadow-sm"
                                : "glass-button text-foreground/80"
                            }`}
                          >
                            <span className="w-5 h-5 rounded-full" style={{ backgroundColor: acc.color }} />
                            <span className="text-[10px]">{acc.label}</span>
                          </motion.button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-medium text-foreground">Glass Blur Intensity</label>
                        <span className="text-xs font-mono text-accent">{settings.glassIntensity}px</span>
                      </div>
                      <input
                        type="range"
                        min="10"
                        max="40"
                        step="2"
                        value={settings.glassIntensity}
                        onChange={(e) => settings.updateSettings({ glassIntensity: parseInt(e.target.value, 10) })}
                        className="w-full accent-blue-500 cursor-pointer"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-foreground mb-2">Background Motion</label>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { id: "animated", label: "Animated Gradient Orbs" },
                          { id: "static", label: "Static Gradient" },
                        ].map((bg) => (
                          <motion.button
                            key={bg.id}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.96 }}
                            onClick={() => settings.updateSettings({ backgroundStyle: bg.id as BackgroundStyle })}
                            className={`px-3 py-2 rounded-xl text-xs font-medium border transition-all ${
                              settings.backgroundStyle === bg.id
                                ? "bg-accent/20 border-accent text-accent shadow-sm"
                                : "glass-button text-foreground/80 hover:text-foreground"
                            }`}
                          >
                            {bg.label}
                          </motion.button>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}

                {activeTab === "memory" && (
                  <motion.div
                    key="memory"
                    initial={{ opacity: 0, x: 8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -8 }}
                    transition={{ duration: 0.16 }}
                  >
                    <MemorySettingsTab />
                  </motion.div>
                )}

                {activeTab === "data" && (
                  <motion.div
                    key="data"
                    initial={{ opacity: 0, x: 8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -8 }}
                    transition={{ duration: 0.16 }}
                    className="space-y-4"
                  >
                    <div className="p-4 rounded-2xl glass-panel space-y-3">
                      <h3 className="text-xs font-semibold text-foreground">Backup & Migration</h3>
                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        Export all your conversations and customized settings into a single JSON file. You can restore your data anytime.
                      </p>

                      <div className="flex flex-wrap gap-2 pt-1">
                        <motion.button
                          whileHover={{ scale: 1.03 }}
                          whileTap={{ scale: 0.96 }}
                          onClick={handleExport}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-accent text-accent-foreground text-xs font-medium shadow-sm hover:opacity-90 transition-all"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Export Chats (JSON)</span>
                        </motion.button>

                        <motion.button
                          whileHover={{ scale: 1.03 }}
                          whileTap={{ scale: 0.96 }}
                          onClick={() => fileInputRef.current?.click()}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-xl glass-button text-xs font-medium text-foreground/80 hover:text-foreground transition-all"
                        >
                          <Upload className="w-3.5 h-3.5 text-accent" />
                          <span>Import Backup</span>
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

                    <div className="p-4 rounded-2xl glass-panel space-y-3">
                      <h3 className="text-xs font-semibold text-foreground">Data Reset</h3>
                      <div className="flex flex-wrap gap-2">
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.96 }}
                          onClick={handleResetSettings}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-xl glass-button text-xs font-medium text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 transition-all"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          <span>Reset Settings to Default</span>
                        </motion.button>

                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.96 }}
                          onClick={handleClearData}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-xl glass-button text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 transition-all"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          <span>Clear All Conversations</span>
                        </motion.button>
                      </div>
                    </div>

                    <div className="p-4 rounded-2xl glass-panel border border-rose-500/20 space-y-2">
                      <h3 className="text-xs font-semibold text-rose-500 flex items-center gap-1.5">
                        <LogOut className="w-4 h-4" />
                        <span>Lock / Sign out</span>
                      </h3>
                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        Clears the secure session cookie immediately. You will need to re-enter your passcode to access Glass Chat.
                      </p>
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.96 }}
                        onClick={onLockSession}
                        className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-medium shadow-sm transition-all"
                      >
                        Lock App & Sign Out
                      </motion.button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
