import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, verifySessionToken } from "@/lib/auth";
import { checkMemoryRateLimit } from "@/lib/rateLimit";
import { getMemoryStore, generateMemoryId } from "@/lib/memoryStore";
import {
  createMemorySchema,
  memoryMetaSchema,
  MemoryItem,
} from "@/lib/memoryModels";
import { isContentSafe, sanitizeMemoryContent } from "@/lib/memoryExtract";

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

async function authenticate(req: NextRequest): Promise<boolean> {
  if (!isSameOrigin(req)) return false;
  const token = req.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (!token) return false;
  return await verifySessionToken(token);
}

// GET /api/memory - List all memories, meta, and pending suggestions
export async function GET(req: NextRequest) {
  if (!(await authenticate(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ip = getClientIp(req);
  const rate = await checkMemoryRateLimit(ip);
  if (!rate.success) {
    return NextResponse.json(
      { error: rate.error || "Rate limit reached." },
      { status: 429, headers: { "Retry-After": String(rate.resetSeconds || 60) } }
    );
  }

  try {
    const store = getMemoryStore();
    const [memories, meta, suggestions] = await Promise.all([
      store.list(),
      store.getMeta(),
      store.listSuggestions(),
    ]);

    return NextResponse.json({
      memories,
      meta,
      suggestions,
    });
  } catch (err) {
    console.error("[GlassChat] Error fetching memories:", err instanceof Error ? err.message : err);
    return NextResponse.json(
      { error: "Failed to retrieve memories from storage." },
      { status: 500 }
    );
  }
}

// POST /api/memory - Create manual memory or update meta
export async function POST(req: NextRequest) {
  if (!(await authenticate(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ip = getClientIp(req);
  const rate = await checkMemoryRateLimit(ip);
  if (!rate.success) {
    return NextResponse.json(
      { error: rate.error || "Rate limit reached." },
      { status: 429, headers: { "Retry-After": String(rate.resetSeconds || 60) } }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Check if updating meta
  if (body && typeof body === "object" && "meta" in body) {
    const metaCheck = memoryMetaSchema.partial().safeParse((body as { meta: unknown }).meta);
    if (!metaCheck.success) {
      return NextResponse.json({ error: "Invalid metadata payload" }, { status: 400 });
    }
    const store = getMemoryStore();
    const updatedMeta = await store.updateMeta(metaCheck.data);
    return NextResponse.json({ meta: updatedMeta });
  }

  // Otherwise, create manual memory
  const parsed = createMemorySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid memory content", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const sanitized = sanitizeMemoryContent(parsed.data.content);
  const safety = isContentSafe(sanitized);
  if (!safety.safe) {
    return NextResponse.json({ error: safety.reason || "Disallowed content" }, { status: 400 });
  }

  try {
    const store = getMemoryStore();
    const now = new Date().toISOString();
    const item: MemoryItem = {
      id: generateMemoryId(),
      content: sanitized,
      category: parsed.data.category,
      pinned: parsed.data.pinned,
      source: "manual",
      createdAt: now,
      updatedAt: now,
      useCount: 0,
    };

    const saved = await store.upsert(item);
    return NextResponse.json({ memory: saved }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to save memory.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

// DELETE /api/memory - Clear all memories
export async function DELETE(req: NextRequest) {
  if (!(await authenticate(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { confirm?: boolean } = {};
  try {
    body = await req.json();
  } catch {
    // ignore
  }

  if (body.confirm !== true) {
    return NextResponse.json(
      { error: "Confirmation required. Pass { confirm: true } to clear all memories." },
      { status: 400 }
    );
  }

  try {
    const store = getMemoryStore();
    await store.clearAll();
    return NextResponse.json({ success: true, message: "All memories cleared." });
  } catch (err) {
    console.error("[GlassChat] Error clearing memories:", err);
    return NextResponse.json({ error: "Failed to clear memories." }, { status: 500 });
  }
}
