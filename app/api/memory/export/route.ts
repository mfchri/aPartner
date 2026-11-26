import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, verifySessionToken } from "@/lib/auth";
import { checkMemoryRateLimit } from "@/lib/rateLimit";
import { getMemoryStore } from "@/lib/memoryStore";

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

// GET /api/memory/export - Download full JSON backup of memories & metadata
export async function GET(req: NextRequest) {
  if (!isSameOrigin(req)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const token = req.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (!token || !(await verifySessionToken(token))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const forwarded = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "127.0.0.1";
  const rate = await checkMemoryRateLimit(forwarded.split(",")[0].trim());
  if (!rate.success) {
    return NextResponse.json(
      { error: rate.error || "Rate limit reached." },
      { status: 429, headers: { "Retry-After": String(rate.resetSeconds || 60) } }
    );
  }

  try {
    const store = getMemoryStore();
    const data = await store.exportAll();

    const dateStr = new Date().toISOString().slice(0, 10);
    return new NextResponse(JSON.stringify(data, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="glass-chat-memories-${dateStr}.json"`,
      },
    });
  } catch (err) {
    console.error("[GlassChat] Error exporting memories:", err);
    return NextResponse.json({ error: "Failed to export memories." }, { status: 500 });
  }
}
