import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, verifySessionToken } from "@/lib/auth";
import { checkChatRateLimit } from "@/lib/rateLimit";
import { chatRequestSchema } from "@/lib/validation";
import { createGeminiStream, extractChunkText, mapGeminiError } from "@/lib/gemini";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

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
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  return req.headers.get("x-real-ip") || "127.0.0.1";
}

export async function POST(req: NextRequest) {
  // 1. Cross-site request check
  if (!isSameOrigin(req)) {
    return NextResponse.json({ error: "Cross-site requests not allowed" }, { status: 403 });
  }

  // 2. Passcode gate: verify session cookie
  const token = req.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (!token) {
    return NextResponse.json(
      { error: "Authentication required. Please enter your passcode." },
      { status: 401 }
    );
  }

  const isValidSession = await verifySessionToken(token);
  if (!isValidSession) {
    return NextResponse.json(
      { error: "Session expired or invalid. Please re-enter your passcode." },
      { status: 401 }
    );
  }

  // 3. Rate limiting by IP + session
  const ip = getClientIp(req);
  const sessionHash = token.slice(-8);
  const rateLimitKey = `${ip}:${sessionHash}`;

  const rateCheck = await checkChatRateLimit(rateLimitKey);
  if (!rateCheck.success) {
    console.warn(`[GlassChat] Chat rate limit reached for identifier`);
    return NextResponse.json(
      { error: rateCheck.error || "Rate limit reached. Please wait a moment." },
      {
        status: 429,
        headers: {
          "Retry-After": String(rateCheck.resetSeconds || 60),
        },
      }
    );
  }

  // 4. Request body size check (~100 KB limit)
  const contentLength = req.headers.get("content-length");
  if (contentLength && parseInt(contentLength, 10) > 102400) {
    return NextResponse.json({ error: "Request payload too large (max 100 KB)" }, { status: 413 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const validation = chatRequestSchema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json(
      { error: "Invalid request format", details: validation.error.flatten() },
      { status: 400 }
    );
  }

  const { messages, settings } = validation.data;

  // 5. Connect to Gemini stream
  try {
    const { stream, modelUsed } = await createGeminiStream({
      messages,
      settings,
      signal: req.signal,
    });

    const encoder = new TextEncoder();
    const readableStream = new ReadableStream({
      async start(controller) {
        // Send initial metadata event
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: "start", model: modelUsed })}\n\n`)
        );

        try {
          for await (const chunk of stream) {
            if (req.signal.aborted) {
              break;
            }
            const text = extractChunkText(chunk);
            if (text) {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ type: "chunk", text })}\n\n`)
              );
            }
          }

          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "done" })}\n\n`)
          );
        } catch (streamErr) {
          const mapped = mapGeminiError(streamErr);
          console.error(`[GlassChat] Gemini stream error code: ${mapped.status}`);
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: "error", error: mapped.message, status: mapped.status })}\n\n`
            )
          );
        } finally {
          controller.close();
        }
      },
    });

    return new Response(readableStream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (err) {
    const mapped = mapGeminiError(err);
    console.error(`[GlassChat] Gemini initiation error code: ${mapped.status}`);
    return NextResponse.json({ error: mapped.message }, { status: mapped.status });
  }
}
