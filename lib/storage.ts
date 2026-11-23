import { ChatSession } from "@/store/useChatStore";
import { SettingsState } from "@/store/useSettingsStore";

export interface GlassChatExportData {
  version: "1.0";
  exportedAt: string;
  sessions: ChatSession[];
  settings?: Partial<SettingsState>;
}

export function exportBackup(sessions: ChatSession[], settings: SettingsState): void {
  const exportPayload: GlassChatExportData = {
    version: "1.0",
    exportedAt: new Date().toISOString(),
    sessions,
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
      theme: settings.theme,
      accent: settings.accent,
      glassIntensity: settings.glassIntensity,
      backgroundStyle: settings.backgroundStyle,
    },
  };

  const blob = new Blob([JSON.stringify(exportPayload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const dateStr = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `glass-chat-backup-${dateStr}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function parseBackupFile(file: File): Promise<GlassChatExportData> {
  const text = await file.text();
  const parsed = JSON.parse(text);
  if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.sessions)) {
    throw new Error("Invalid backup file format. Expected a valid Glass Chat JSON export.");
  }
  return parsed as GlassChatExportData;
}
