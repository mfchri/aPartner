import { z } from "zod";

export const MEMORY_CATEGORIES = [
  "preference",
  "personal",
  "work",
  "project",
  "interest",
  "other",
] as const;

export type MemoryCategory = (typeof MEMORY_CATEGORIES)[number];

export const memoryCategorySchema = z.enum(MEMORY_CATEGORIES);

export const memoryItemSchema = z
  .object({
    id: z.string().min(1),
    content: z.string().min(1).max(300),
    category: memoryCategorySchema,
    pinned: z.boolean().default(false),
    source: z.enum(["manual", "auto", "command"]).default("manual"),
    createdAt: z.string(),
    updatedAt: z.string(),
    lastUsedAt: z.string().optional(),
    useCount: z.number().int().min(0).default(0),
  })
  .strict();

export type MemoryItem = z.infer<typeof memoryItemSchema>;

export const memorySuggestionSchema = z
  .object({
    id: z.string().min(1),
    content: z.string().min(1).max(300),
    category: memoryCategorySchema,
    createdAt: z.string(),
  })
  .strict();

export type MemorySuggestion = z.infer<typeof memorySuggestionSchema>;

export const memoryModeSchema = z.enum(["off", "manual", "smart", "ask", "ask_first"]);
export type MemoryMode = z.infer<typeof memoryModeSchema>;

export const memoryMetaSchema = z
  .object({
    schemaVersion: z.number().int().default(1),
    mode: memoryModeSchema.default("smart"),
    extractInterval: z.number().int().min(1).max(10).default(3),
  })
  .strict();

export type MemoryMeta = z.infer<typeof memoryMetaSchema>;

export const MAX_MEMORIES_LIMIT = 200;

export const createMemorySchema = z
  .object({
    content: z.string().min(1).max(300),
    category: memoryCategorySchema.default("other"),
    pinned: z.boolean().default(false),
  })
  .strict();

export const updateMemorySchema = z
  .object({
    content: z.string().min(1).max(300).optional(),
    category: memoryCategorySchema.optional(),
    pinned: z.boolean().optional(),
  })
  .strict();

export const importMemorySchema = z
  .object({
    schemaVersion: z.number().int().optional().default(1),
    mode: z.enum(["merge", "replace"]).default("merge"),
    memories: z.array(
      z.object({
        id: z.string().optional(),
        content: z.string().min(1).max(300),
        category: memoryCategorySchema.default("other"),
        pinned: z.boolean().default(false),
        source: z.enum(["manual", "auto", "command"]).default("manual"),
        createdAt: z.string().optional(),
        updatedAt: z.string().optional(),
        lastUsedAt: z.string().optional(),
        useCount: z.number().int().min(0).optional().default(0),
      })
    ).max(MAX_MEMORIES_LIMIT),
    meta: z
      .object({
        mode: memoryModeSchema.optional(),
        extractInterval: z.number().int().min(1).max(10).optional(),
      })
      .optional(),
  })
  .strict();
