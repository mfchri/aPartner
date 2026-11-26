import fs from "fs";
import path from "path";
import { Redis } from "@upstash/redis";
import {
  MemoryItem,
  MemoryMeta,
  MemorySuggestion,
  MAX_MEMORIES_LIMIT,
} from "./memoryModels";

export function generateMemoryId(size = 12): string {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const bytes = new Uint8Array(size);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}

export interface MemoryStore {
  list(): Promise<MemoryItem[]>;
  get(id: string): Promise<MemoryItem | null>;
  upsert(memory: MemoryItem): Promise<MemoryItem>;
  delete(id: string): Promise<boolean>;
  clearAll(): Promise<void>;
  exportAll(): Promise<{ schemaVersion: number; meta: MemoryMeta; memories: MemoryItem[] }>;
  importAll(
    data: { schemaVersion?: number; meta?: Partial<MemoryMeta>; memories: Partial<MemoryItem>[] },
    mode?: "merge" | "replace"
  ): Promise<{ importedCount: number; totalCount: number }>;
  getMeta(): Promise<MemoryMeta>;
  updateMeta(partial: Partial<MemoryMeta>): Promise<MemoryMeta>;
  listSuggestions(): Promise<MemorySuggestion[]>;
  addSuggestion(suggestion: MemorySuggestion): Promise<MemorySuggestion>;
  removeSuggestion(id: string): Promise<boolean>;
}

// ----------------------------------------------------
// 1. Upstash Redis Adapter (Production Source of Truth)
// ----------------------------------------------------
class UpstashRedisMemoryStore implements MemoryStore {
  private redis: Redis;
  private readonly HASH_KEY = "glasschat:memories";
  private readonly META_KEY = "glasschat:memory:meta";
  private readonly SUGGESTIONS_KEY = "glasschat:memory:suggestions";

  constructor() {
    this.redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    });
  }

  async list(): Promise<MemoryItem[]> {
    const rawMap = await this.redis.hgetall<Record<string, string | MemoryItem>>(this.HASH_KEY);
    if (!rawMap) return [];

    const items: MemoryItem[] = [];
    for (const val of Object.values(rawMap)) {
      if (typeof val === "string") {
        try {
          items.push(JSON.parse(val));
        } catch {
          // ignore corrupted entry
        }
      } else if (val && typeof val === "object") {
        items.push(val as MemoryItem);
      }
    }

    return items.sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
  }

  async get(id: string): Promise<MemoryItem | null> {
    const raw = await this.redis.hget<string | MemoryItem>(this.HASH_KEY, id);
    if (!raw) return null;
    if (typeof raw === "string") {
      try {
        return JSON.parse(raw);
      } catch {
        return null;
      }
    }
    return raw as MemoryItem;
  }

  async upsert(memory: MemoryItem): Promise<MemoryItem> {
    const currentCount = await this.redis.hlen(this.HASH_KEY);
    const exists = await this.redis.hexists(this.HASH_KEY, memory.id);

    if (!exists && currentCount >= MAX_MEMORIES_LIMIT) {
      throw new Error(`Memory limit reached. Maximum allowed is ${MAX_MEMORIES_LIMIT} memories.`);
    }

    await this.redis.hset(this.HASH_KEY, {
      [memory.id]: JSON.stringify(memory),
    });
    return memory;
  }

  async delete(id: string): Promise<boolean> {
    const res = await this.redis.hdel(this.HASH_KEY, id);
    return res > 0;
  }

  async clearAll(): Promise<void> {
    await this.redis.del(this.HASH_KEY);
    await this.redis.del(this.SUGGESTIONS_KEY);
  }

  async getMeta(): Promise<MemoryMeta> {
    const raw = await this.redis.get<string | MemoryMeta>(this.META_KEY);
    const defaults: MemoryMeta = {
      schemaVersion: 1,
      mode: "smart",
      extractInterval: 3,
    };
    if (!raw) return defaults;
    if (typeof raw === "string") {
      try {
        return { ...defaults, ...JSON.parse(raw) };
      } catch {
        return defaults;
      }
    }
    return { ...defaults, ...raw };
  }

  async updateMeta(partial: Partial<MemoryMeta>): Promise<MemoryMeta> {
    const current = await this.getMeta();
    const updated: MemoryMeta = {
      ...current,
      ...partial,
      schemaVersion: 1,
    };
    await this.redis.set(this.META_KEY, JSON.stringify(updated));
    return updated;
  }

  async listSuggestions(): Promise<MemorySuggestion[]> {
    const rawMap = await this.redis.hgetall<Record<string, string | MemorySuggestion>>(
      this.SUGGESTIONS_KEY
    );
    if (!rawMap) return [];
    const items: MemorySuggestion[] = [];
    for (const val of Object.values(rawMap)) {
      if (typeof val === "string") {
        try {
          items.push(JSON.parse(val));
        } catch {
          // ignore
        }
      } else if (val && typeof val === "object") {
        items.push(val as MemorySuggestion);
      }
    }
    return items.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  async addSuggestion(suggestion: MemorySuggestion): Promise<MemorySuggestion> {
    await this.redis.hset(this.SUGGESTIONS_KEY, {
      [suggestion.id]: JSON.stringify(suggestion),
    });
    return suggestion;
  }

  async removeSuggestion(id: string): Promise<boolean> {
    const res = await this.redis.hdel(this.SUGGESTIONS_KEY, id);
    return res > 0;
  }

  async exportAll(): Promise<{ schemaVersion: number; meta: MemoryMeta; memories: MemoryItem[] }> {
    const [meta, memories] = await Promise.all([this.getMeta(), this.list()]);
    return {
      schemaVersion: 1,
      meta,
      memories,
    };
  }

  async importAll(
    data: { schemaVersion?: number; meta?: Partial<MemoryMeta>; memories: Partial<MemoryItem>[] },
    mode: "merge" | "replace" = "merge"
  ): Promise<{ importedCount: number; totalCount: number }> {
    if (mode === "replace") {
      await this.clearAll();
    }

    if (data.meta) {
      await this.updateMeta(data.meta);
    }

    const current = mode === "replace" ? [] : await this.list();
    const map = new Map<string, MemoryItem>();
    for (const item of current) {
      map.set(item.id, item);
    }

    let importedCount = 0;
    const now = new Date().toISOString();

    for (const item of data.memories) {
      if (!item.content || !item.content.trim()) continue;
      if (map.size >= MAX_MEMORIES_LIMIT) break;

      const id = item.id || generateMemoryId();
      const existing = map.get(id);

      const memoryItem: MemoryItem = {
        id,
        content: item.content.trim().slice(0, 300),
        category: item.category || "other",
        pinned: Boolean(item.pinned),
        source: item.source || "manual",
        createdAt: item.createdAt || existing?.createdAt || now,
        updatedAt: now,
        lastUsedAt: item.lastUsedAt || existing?.lastUsedAt,
        useCount: typeof item.useCount === "number" ? item.useCount : existing?.useCount || 0,
      };

      map.set(id, memoryItem);
      importedCount++;
    }

    // Save batch to Redis
    const payload: Record<string, string> = {};
    for (const [id, mem] of map.entries()) {
      payload[id] = JSON.stringify(mem);
    }

    if (Object.keys(payload).length > 0) {
      await this.redis.hset(this.HASH_KEY, payload);
    }

    return { importedCount, totalCount: map.size };
  }
}

// ----------------------------------------------------
// 2. Local JSON File Adapter (Local Dev Only)
// ----------------------------------------------------
interface LocalFileData {
  schemaVersion: number;
  meta: MemoryMeta;
  memories: MemoryItem[];
  suggestions: MemorySuggestion[];
}

class LocalJsonMemoryStore implements MemoryStore {
  private filePath: string;
  private dirPath: string;

  constructor() {
    this.dirPath = path.join(process.cwd(), "data");
    this.filePath = path.join(this.dirPath, "memory.json");
    this.ensureInitialized();
  }

  private ensureInitialized() {
    try {
      if (!fs.existsSync(this.dirPath)) {
        fs.mkdirSync(this.dirPath, { recursive: true });
      }
      if (!fs.existsSync(this.filePath)) {
        const initial: LocalFileData = {
          schemaVersion: 1,
          meta: { schemaVersion: 1, mode: "smart", extractInterval: 3 },
          memories: [],
          suggestions: [],
        };
        fs.writeFileSync(this.filePath, JSON.stringify(initial, null, 2), "utf8");
      }
    } catch (err) {
      console.error("[GlassChat] Error initializing local memory storage:", err);
    }
  }

  private async readData(): Promise<LocalFileData> {
    this.ensureInitialized();
    try {
      const content = await fs.promises.readFile(this.filePath, "utf8");
      const parsed = JSON.parse(content);
      return {
        schemaVersion: parsed.schemaVersion || 1,
        meta: {
          schemaVersion: 1,
          mode: parsed.meta?.mode || "smart",
          extractInterval: parsed.meta?.extractInterval || 3,
        },
        memories: Array.isArray(parsed.memories) ? parsed.memories : [],
        suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
      };
    } catch {
      return {
        schemaVersion: 1,
        meta: { schemaVersion: 1, mode: "smart", extractInterval: 3 },
        memories: [],
        suggestions: [],
      };
    }
  }

  private async writeDataAtomic(data: LocalFileData): Promise<void> {
    this.ensureInitialized();
    const tempPath = `${this.filePath}.tmp.${Date.now()}.${Math.random().toString(36).slice(2, 7)}`;
    const json = JSON.stringify(data, null, 2);
    await fs.promises.writeFile(tempPath, json, "utf8");
    await fs.promises.rename(tempPath, this.filePath);
  }

  async list(): Promise<MemoryItem[]> {
    const data = await this.readData();
    return data.memories.sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
  }

  async get(id: string): Promise<MemoryItem | null> {
    const data = await this.readData();
    return data.memories.find((m) => m.id === id) || null;
  }

  async upsert(memory: MemoryItem): Promise<MemoryItem> {
    const data = await this.readData();
    const index = data.memories.findIndex((m) => m.id === memory.id);

    if (index === -1 && data.memories.length >= MAX_MEMORIES_LIMIT) {
      throw new Error(`Memory limit reached. Maximum allowed is ${MAX_MEMORIES_LIMIT} memories.`);
    }

    if (index >= 0) {
      data.memories[index] = memory;
    } else {
      data.memories.push(memory);
    }

    await this.writeDataAtomic(data);
    return memory;
  }

  async delete(id: string): Promise<boolean> {
    const data = await this.readData();
    const initialLen = data.memories.length;
    data.memories = data.memories.filter((m) => m.id !== id);
    if (data.memories.length !== initialLen) {
      await this.writeDataAtomic(data);
      return true;
    }
    return false;
  }

  async clearAll(): Promise<void> {
    const data = await this.readData();
    data.memories = [];
    data.suggestions = [];
    await this.writeDataAtomic(data);
  }

  async getMeta(): Promise<MemoryMeta> {
    const data = await this.readData();
    return data.meta;
  }

  async updateMeta(partial: Partial<MemoryMeta>): Promise<MemoryMeta> {
    const data = await this.readData();
    data.meta = { ...data.meta, ...partial, schemaVersion: 1 };
    await this.writeDataAtomic(data);
    return data.meta;
  }

  async listSuggestions(): Promise<MemorySuggestion[]> {
    const data = await this.readData();
    return data.suggestions.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  async addSuggestion(suggestion: MemorySuggestion): Promise<MemorySuggestion> {
    const data = await this.readData();
    data.suggestions = [suggestion, ...data.suggestions.filter((s) => s.id !== suggestion.id)];
    await this.writeDataAtomic(data);
    return suggestion;
  }

  async removeSuggestion(id: string): Promise<boolean> {
    const data = await this.readData();
    const initialLen = data.suggestions.length;
    data.suggestions = data.suggestions.filter((s) => s.id !== id);
    if (data.suggestions.length !== initialLen) {
      await this.writeDataAtomic(data);
      return true;
    }
    return false;
  }

  async exportAll(): Promise<{ schemaVersion: number; meta: MemoryMeta; memories: MemoryItem[] }> {
    const data = await this.readData();
    return {
      schemaVersion: 1,
      meta: data.meta,
      memories: data.memories,
    };
  }

  async importAll(
    data: { schemaVersion?: number; meta?: Partial<MemoryMeta>; memories: Partial<MemoryItem>[] },
    mode: "merge" | "replace" = "merge"
  ): Promise<{ importedCount: number; totalCount: number }> {
    const fileData = await this.readData();

    if (mode === "replace") {
      fileData.memories = [];
      fileData.suggestions = [];
    }

    if (data.meta) {
      fileData.meta = { ...fileData.meta, ...data.meta, schemaVersion: 1 };
    }

    const map = new Map<string, MemoryItem>();
    for (const item of fileData.memories) {
      map.set(item.id, item);
    }

    let importedCount = 0;
    const now = new Date().toISOString();

    for (const item of data.memories) {
      if (!item.content || !item.content.trim()) continue;
      if (map.size >= MAX_MEMORIES_LIMIT) break;

      const id = item.id || generateMemoryId();
      const existing = map.get(id);

      const memoryItem: MemoryItem = {
        id,
        content: item.content.trim().slice(0, 300),
        category: item.category || "other",
        pinned: Boolean(item.pinned),
        source: item.source || "manual",
        createdAt: item.createdAt || existing?.createdAt || now,
        updatedAt: now,
        lastUsedAt: item.lastUsedAt || existing?.lastUsedAt,
        useCount: typeof item.useCount === "number" ? item.useCount : existing?.useCount || 0,
      };

      map.set(id, memoryItem);
      importedCount++;
    }

    fileData.memories = Array.from(map.values());
    await this.writeDataAtomic(fileData);

    return { importedCount, totalCount: fileData.memories.length };
  }
}

// ----------------------------------------------------
// Memory Store Factory
// ----------------------------------------------------
let memoryStoreInstance: MemoryStore | null = null;

export function getMemoryStore(): MemoryStore {
  if (memoryStoreInstance) return memoryStoreInstance;

  const hasUpstash = Boolean(
    process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
  );

  if (hasUpstash) {
    memoryStoreInstance = new UpstashRedisMemoryStore();
    return memoryStoreInstance;
  }

  // Fail closed in production if Upstash is missing
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "Configuration Error: Persistent memory storage requires UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN in production."
    );
  }

  console.warn(
    "[GlassChat] Upstash Redis not configured. Using local JSON memory store ('data/memory.json') for development."
  );
  memoryStoreInstance = new LocalJsonMemoryStore();
  return memoryStoreInstance;
}
