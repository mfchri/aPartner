import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, verifySessionToken } from "@/lib/auth";
import { checkMemoryRateLimit } from "@/lib/rateLimit";
import { getMemoryStore } from "@/lib/memoryStore";
import { updateMemorySchema } from "@/lib/memoryModels";
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

// PATCH /api/memory/[id] - Update a memory item
export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  if (!(await authenticate(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
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

  const parsed = updateMemorySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const store = getMemoryStore();
    const existing = await store.get(id);
    if (!existing) {
      return NextResponse.json({ error: "Memory item not found" }, { status: 404 });
    }

    let nextContent = existing.content;
    if (typeof parsed.data.content === "string") {
      const sanitized = sanitizeMemoryContent(parsed.data.content);
      const safety = isContentSafe(sanitized);
      if (!safety.safe) {
        return NextResponse.json({ error: safety.reason || "Disallowed content" }, { status: 400 });
      }
      nextContent = sanitized;
    }

    const updated = await store.upsert({
      ...existing,
      content: nextContent,
      category: parsed.data.category ?? existing.category,
      pinned: parsed.data.pinned ?? existing.pinned,
      updatedAt: new Date().toISOString(),
    });

    return NextResponse.json({ memory: updated });
  } catch (err) {
    console.error("[GlassChat] Error updating memory:", err);
    return NextResponse.json({ error: "Failed to update memory item." }, { status: 500 });
  }
}

// DELETE /api/memory/[id] - Delete a memory item
export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  if (!(await authenticate(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
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
    const existing = await store.get(id);
    const deleted = await store.delete(id);

    return NextResponse.json({
      success: deleted,
      deletedId: id,
      deletedMemory: existing,
    });
  } catch (err) {
    console.error("[GlassChat] Error deleting memory:", err);
    return NextResponse.json({ error: "Failed to delete memory item." }, { status: 500 });
  }
}
