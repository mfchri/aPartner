import { z } from "zod";

export const chatMessageSchema = z.object({
  role: z.enum(["user", "assistant", "system"]),
  content: z.string().min(1).max(8000),
});

export const chatSettingsSchema = z.object({
  aiName: z.string().min(1).max(50).default("Aria"),
  userName: z.string().min(1).max(50).default("User"),
  customGreeting: z.string().max(500).default("Hello {{name}}! How can I assist you today?"),
  customPrompt: z.string().max(4000).default(""),
  tone: z.enum(["friendly", "casual", "professional", "playful", "concise"]).default("friendly"),
  language: z.enum(["auto", "id", "en"]).default("auto"),
  length: z.enum(["short", "balanced", "detailed"]).default("balanced"),
  emoji: z.enum(["none", "few", "many"]).default("few"),
  temperature: z.number().min(0).max(2).default(0.7),
  maxOutputTokens: z.number().int().min(100).max(4096).default(2048),
  model: z.string().min(1).max(64).optional(),
}).strict();

export const chatRequestSchema = z.object({
  messages: z.array(chatMessageSchema).min(1).max(40),
  settings: chatSettingsSchema.optional(),
}).strict();

export const authRequestSchema = z.object({
  passcode: z.string().min(1).max(128),
}).strict();

export type ChatMessage = z.infer<typeof chatMessageSchema>;
export type ChatSettings = z.infer<typeof chatSettingsSchema>;
export type ChatRequest = z.infer<typeof chatRequestSchema>;
export type AuthRequest = z.infer<typeof authRequestSchema>;
