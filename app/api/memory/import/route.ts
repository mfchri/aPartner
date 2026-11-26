import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, verifySessionToken } from "@/lib/auth";
import { checkMemoryRateLimit } from "@/lib/rateLimit";
import { getMemoryStore } from "@/lib/memoryStore";
import { importMemorySchema } from "@/lib/memoryModels";

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

// POST /api/memory/import - Import JSON backup (~500 KB limit)
export async function POST(req: NextRequest) {
  if (!isSameOrigin(req)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const token = req.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (!token || !(await verifySessionToken(token))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const contentLength = req.headers.get("content-length");
  if (contentLength && parseInt(contentLength, 10) > 512000) {
    return NextResponse.json({ error: "File too large (max 500 KB)" }, { status: 413 });
  }

  const forwarded = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "127.0.0.1";
  const rate = await checkMemoryRateLimit(forwarded.split(",")[0].trim());
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
    return NextResponse.json({ error: "Invalid JSON format" }, { status: 400 });
  }

  const parsed = importMemorySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid backup format", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const store = getMemoryStore();
    const result = await store.importAll(
      {
        schemaVersion: parsed.data.schemaVersion,
        meta: parsed.data.meta,
        memories: parsed.data.memories,
      },
      parsed.data.mode
    );

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (err) {
    console.error("[GlassChat] Error importing memories:", err);
    return NextResponse.json({ error: "Failed to import memories." }, { status: 500 });
  }
}
