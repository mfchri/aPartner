import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { AUTH_COOKIE_NAME, verifySessionToken } from "@/lib/auth";
import { checkExtractRateLimit } from "@/lib/rateLimit";
import { getMemoryStore, generateMemoryId } from "@/lib/memoryStore";
import { extractMemoriesWithGemini } from "@/lib/memoryExtract";
import { MemoryItem, MemorySuggestion } from "@/lib/memoryModels";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isSameOrigin(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true;
  const host = req.headers.get("host");
  if (!host) return false;
  try {
    const originUrl = new URL(origin);
    return originUrl.host === host;
  } catch {
    return false;
  }
}

function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "127.0.0.1";
}

const extractRequestSchema = z
  .object({
    messages: z
      .array(
        z.object({
          role: z.enum(["user", "assistant"]),
          content: z.string().min(1).max(8000),
        })
      )
      .min(1)
      .max(6),
  })
  .strict();

export async function POST(req: NextRequest) {
  if (!isSameOrigin(req)) {
    return NextResponse.json({ error: "Forbidden: Cross-site request" }, { status: 403 });
  }

  const token = req.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (!token || !(await verifySessionToken(token))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ip = getClientIp(req);
  const rate = await checkExtractRateLimit(ip);
  if (!rate.success) {
    return NextResponse.json(
      { error: rate.error || "Extraction rate limit reached." },
      { status: 429, headers: { "Retry-After": String(rate.resetSeconds || 60) } }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = extractRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid messages payload" }, { status: 400 });
  }

  try {
    const store = getMemoryStore();
    const meta = await store.getMeta();

    // Skip extraction if mode is Off or Manual
    if (meta.mode === "off" || meta.mode === "manual") {
      return NextResponse.json({
        skipped: true,
        reason: `Memory mode is set to '${meta.mode}'`,
      });
    }

    const existingMemories = await store.list();
    const candidates = await extractMemoriesWithGemini(parsed.data.messages, existingMemories);

    if (candidates.length === 0) {
      return NextResponse.json({ extracted: [], count: 0 });
    }

    const now = new Date().toISOString();

    // Mode: Smart -> Automatically save or update
    if (meta.mode === "smart") {
      const savedMemories: MemoryItem[] = [];

      for (const candidate of candidates) {
        if (candidate.isUpdateToExisting && candidate.existingIdToUpdate) {
          const existing = await store.get(candidate.existingIdToUpdate);
          if (existing) {
            const updated: MemoryItem = {
              ...existing,
              content: candidate.content,
              category: candidate.category,
              updatedAt: now,
            };
            await store.upsert(updated);
            savedMemories.push(updated);
            continue;
          }
        }

        // New item
        const newItem: MemoryItem = {
          id: generateMemoryId(),
          content: candidate.content,
          category: candidate.category,
          pinned: false,
          source: "auto",
          createdAt: now,
          updatedAt: now,
          useCount: 0,
        };
        await store.upsert(newItem);
        savedMemories.push(newItem);
      }

      return NextResponse.json({
        mode: "smart",
        saved: savedMemories,
        count: savedMemories.length,
      });
    }

    // Mode: Ask first -> Save into pending suggestions
    if (meta.mode === "ask" || meta.mode === "ask_first") {
      const savedSuggestions: MemorySuggestion[] = [];

      for (const candidate of candidates) {
        const suggestion: MemorySuggestion = {
          id: generateMemoryId(),
          content: candidate.content,
          category: candidate.category,
          createdAt: now,
        };
        await store.addSuggestion(suggestion);
        savedSuggestions.push(suggestion);
      }

      return NextResponse.json({
        mode: "ask",
        suggestions: savedSuggestions,
        count: savedSuggestions.length,
      });
    }

    return NextResponse.json({ extracted: [], count: 0 });
  } catch (err) {
    console.error("[GlassChat] Memory extraction error:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Failed to extract memories" }, { status: 500 });
  }
}
