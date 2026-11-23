import { NextRequest, NextResponse } from "next/server";
import {
  AUTH_COOKIE_NAME,
  createSessionToken,
  isPasscodeConfigured,
  verifyPasscode,
  verifySessionToken,
} from "@/lib/auth";
import { checkAuthBruteForce } from "@/lib/rateLimit";
import { authRequestSchema } from "@/lib/validation";
import { getAllowedModels, getDefaultModel } from "@/lib/gemini";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  return req.headers.get("x-real-ip") || "127.0.0.1";
}

export async function GET(req: NextRequest) {
  const isProd = process.env.NODE_ENV === "production";
  const configured = isPasscodeConfigured();

  if (!configured && isProd) {
    return NextResponse.json(
      {
        authenticated: false,
        setupRequired: true,
        error: "Configuration error: APP_PASSCODE is required in production.",
      },
      { status: 503 }
    );
  }

  const token = req.cookies.get(AUTH_COOKIE_NAME)?.value;
  const authenticated = token ? await verifySessionToken(token) : false;

  return NextResponse.json({
    authenticated,
    setupRequired: !configured && isProd,
    models: getAllowedModels(),
    defaultModel: getDefaultModel(),
  });
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);

  // 1. Check brute force rate limit (max 5 failed attempts per 15 min)
  const rateLimitCheck = await checkAuthBruteForce(ip);
  if (!rateLimitCheck.success) {
    console.warn(`[GlassChat] Auth rate limit triggered for IP: [REDACTED]`);
    return NextResponse.json(
      {
        error:
          rateLimitCheck.error ||
          "Too many failed attempts. Please wait 15 minutes before trying again.",
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(rateLimitCheck.resetSeconds || 900),
        },
      }
    );
  }

  // 2. Validate request body
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = authRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Passcode is required." }, { status: 400 });
  }

  // 3. Verify passcode with constant-time comparison
  const { valid, error } = verifyPasscode(parsed.data.passcode);
  if (!valid) {
    console.warn(`[GlassChat] Passcode verification failed`);
    return NextResponse.json(
      { error: error || "Incorrect passcode. Please try again." },
      { status: 401 }
    );
  }

  // 4. Success: create signed JWT session token
  const token = await createSessionToken();
  const isProd = process.env.NODE_ENV === "production";

  const response = NextResponse.json({ success: true });
  response.cookies.set({
    name: AUTH_COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  });

  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ success: true, message: "Logged out" });
  response.cookies.set({
    name: AUTH_COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
    expires: new Date(0),
  });
  return response;
}
