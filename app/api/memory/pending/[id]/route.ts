import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, verifySessionToken } from "@/lib/auth";
import { checkMemoryRateLimit } from "@/lib/rateLimit";
import { getMemoryStore, generateMemoryId } from "@/lib/memoryStore";
import { MemoryItem } from "@/lib/memoryModels";

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

// POST /api/memory/pending/[id] - { action: "approve" | "reject" }
export async function POST(
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

  let body: { action?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const action = body.action?.toLowerCase();
  if (action !== "approve" && action !== "reject") {
    return NextResponse.json(
      { error: "Invalid action. Expected { action: 'approve' | 'reject' }" },
      { status: 400 }
    );
  }

  try {
    const store = getMemoryStore();
    const suggestions = await store.listSuggestions();
    const target = suggestions.find((s) => s.id === id);

    if (!target) {
      return NextResponse.json({ error: "Suggestion not found" }, { status: 404 });
    }

    await store.removeSuggestion(id);

    if (action === "approve") {
      const now = new Date().toISOString();
      const memory: MemoryItem = {
        id: generateMemoryId(),
        content: target.content,
        category: target.category,
        pinned: false,
        source: "auto",
        createdAt: now,
        updatedAt: now,
        useCount: 0,
      };

      const saved = await store.upsert(memory);
      return NextResponse.json({
        action: "approved",
        memory: saved,
      });
    }

    return NextResponse.json({
      action: "rejected",
      id,
    });
  } catch (err) {
    console.error("[GlassChat] Error handling pending memory suggestion:", err);
    return NextResponse.json({ error: "Failed to process suggestion" }, { status: 500 });
  }
}
