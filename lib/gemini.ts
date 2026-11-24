import { GoogleGenAI } from "@google/genai";
import { ChatMessage, ChatSettings } from "./validation";
import { buildSystemPrompt } from "./buildSystemPrompt";

export const DEFAULT_ALLOWED_MODELS = [
  "gemini-3.8-flash",
  "gemini-3.8-flash-lite",
  "gemini-3.5-flash",
  "gemini-2.0-flash",
  "gemini-1.5-flash",
];

export function getAllowedModels(): string[] {
  const envAllowed = process.env.GEMINI_ALLOWED_MODELS;
  if (!envAllowed) {
    return DEFAULT_ALLOWED_MODELS;
  }
  const parsed = envAllowed
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean);
  return parsed.length > 0 ? parsed : DEFAULT_ALLOWED_MODELS;
}

export function getDefaultModel(): string {
  const envModel = process.env.GEMINI_MODEL?.trim();
  const allowed = getAllowedModels();
  if (envModel && allowed.includes(envModel)) {
    return envModel;
  }
  return allowed[0] || "gemini-3.8-flash";
}

export function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.trim().length === 0) {
    throw new Error("GEMINI_API_KEY is not configured on the server.");
  }
  return new GoogleGenAI({ apiKey: apiKey.trim() });
}

export interface StreamChatParams {
  messages: ChatMessage[];
  settings?: ChatSettings;
  signal?: AbortSignal;
}

export async function createGeminiStream({
  messages,
  settings,
  signal,
}: StreamChatParams) {
  const client = getGeminiClient();
  const allowed = getAllowedModels();
  let selectedModel = settings?.model?.trim() || getDefaultModel();
  if (!allowed.includes(selectedModel)) {
    selectedModel = getDefaultModel();
  }

  // Build system instructions server-side from sanitized settings
  const systemInstruction = buildSystemPrompt(settings);

  // Clamp temperature (0 to 2) and maxOutputTokens (100 to 2048)
  const temperature = Math.min(2, Math.max(0, settings?.temperature ?? 0.7));
  const maxOutputTokens = Math.min(2048, Math.max(100, settings?.maxOutputTokens ?? 2048));

  // Limit conversation history to latest 40 messages
  const trimmedMessages = messages.slice(-40);

  // Format messages into Google GenAI format: user -> user, assistant -> model
  // Combine consecutive messages with same role if needed, or map properly
  const contents = trimmedMessages.map((msg) => {
    const role = msg.role === "assistant" ? "model" : "user";
    return {
      role,
      parts: [{ text: msg.content.slice(0, 8000) }],
    };
  });

  const responseStream = await client.models.generateContentStream({
    model: selectedModel,
    contents,
    config: {
      systemInstruction,
      temperature,
      maxOutputTokens,
      abortSignal: signal,
    },
  });

  return {
    stream: responseStream,
    modelUsed: selectedModel,
  };
}

export function extractChunkText(chunk: unknown): string {
  if (!chunk || typeof chunk !== "object") return "";
  const anyChunk = chunk as Record<string, unknown>;

  if (typeof anyChunk.text === "string") {
    return anyChunk.text;
  }
  if (typeof anyChunk.text === "function") {
    try {
      const res = (anyChunk.text as () => string)();
      if (typeof res === "string") return res;
    } catch {
      // ignore
    }
  }

  const candidates = anyChunk.candidates as Array<Record<string, unknown>> | undefined;
  if (Array.isArray(candidates) && candidates.length > 0) {
    const content = candidates[0]?.content as Record<string, unknown> | undefined;
    const parts = content?.parts as Array<Record<string, unknown>> | undefined;
    if (Array.isArray(parts)) {
      return parts.map((p) => (typeof p.text === "string" ? p.text : "")).join("");
    }
  }

  return "";
}

export function mapGeminiError(error: unknown): { status: number; message: string } {
  const errStr = error instanceof Error ? error.message : String(error);
  const lower = errStr.toLowerCase();

  if (lower.includes("abort") || lower.includes("cancelled")) {
    return { status: 499, message: "Request cancelled by user." };
  }

  if (
    lower.includes("quota") ||
    lower.includes("429") ||
    lower.includes("resource_exhausted") ||
    lower.includes("rate limit")
  ) {
    return {
      status: 429,
      message: "Free Gemini quota reached. Please wait a moment and try again.",
    };
  }

  if (
    lower.includes("safety") ||
    lower.includes("blocked") ||
    lower.includes("harm") ||
    lower.includes("content moderation")
  ) {
    return {
      status: 400,
      message: "The response was blocked by Gemini safety guidelines.",
    };
  }

  if (lower.includes("api_key") || lower.includes("unauthenticated") || lower.includes("invalid api key")) {
    return {
      status: 500,
      message: "Server AI configuration error. Please check server settings.",
    };
  }

  if (lower.includes("deadline") || lower.includes("timeout") || lower.includes("timed out")) {
    return {
      status: 504,
      message: "Upstream request timed out. Please try again.",
    };
  }

  return {
    status: 500,
    message: "An unexpected error occurred while communicating with Gemini.",
  };
}
