import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type TonePreset = "friendly" | "casual" | "professional" | "playful" | "concise";
export type LanguagePreset = "auto" | "id" | "en";
export type LengthPreset = "short" | "balanced" | "detailed";
export type EmojiPreset = "none" | "few" | "many";
export type ThemePreset = "system" | "light" | "dark";
export type AccentPreset = "blue" | "emerald" | "violet" | "rose" | "amber" | "cyan";
export type BackgroundStyle = "animated" | "static";

export interface SettingsState {
  // Persona
  aiName: string;
  userName: string;
  customGreeting: string;
  customPrompt: string;

  // Style of talking
  tone: TonePreset;
  language: LanguagePreset;
  length: LengthPreset;
  emoji: EmojiPreset;

  // Model parameters
  temperature: number;
  maxOutputTokens: number;
  model: string;

  // Appearance
  theme: ThemePreset;
  accent: AccentPreset;
  glassIntensity: number; // 10 to 40
  backgroundStyle: BackgroundStyle;

  // Actions
  updateSettings: (partial: Partial<Omit<SettingsState, "updateSettings" | "resetSettings" | "getFormattedGreeting">>) => void;
  resetSettings: () => void;
  getFormattedGreeting: () => string;
}

export const DEFAULT_SETTINGS = {
  aiName: "Aria",
  userName: "User",
  customGreeting: "Hello {{name}}! How can I assist you today?",
  customPrompt: "",
  tone: "friendly" as TonePreset,
  language: "auto" as LanguagePreset,
  length: "balanced" as LengthPreset,
  emoji: "few" as EmojiPreset,
  temperature: 0.7,
  maxOutputTokens: 2048,
  model: "gemini-2.5-flash",
  theme: "system" as ThemePreset,
  accent: "blue" as AccentPreset,
  glassIntensity: 20,
  backgroundStyle: "animated" as BackgroundStyle,
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      ...DEFAULT_SETTINGS,

      updateSettings: (partial) => {
        set((state) => ({ ...state, ...partial }));
      },

      resetSettings: () => {
        set(DEFAULT_SETTINGS);
      },

      getFormattedGreeting: () => {
        const { customGreeting, userName } = get();
        return customGreeting.replace(/{{\s*name\s*}}/gi, userName || "User");
      },
    }),
    {
      name: "glass_chat_settings_v1",
      storage: createJSONStorage(() => localStorage),
    }
  )
);
