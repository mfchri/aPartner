import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, verifySessionToken } from "@/lib/auth";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Protect /api/chat and /api/memory routes
  if (pathname.startsWith("/api/chat") || pathname.startsWith("/api/memory")) {
    const origin = req.headers.get("origin");
    const host = req.headers.get("host");

    if (origin && host) {
      try {
        const originUrl = new URL(origin);
        if (originUrl.host !== host) {
          return NextResponse.json(
            { error: "Forbidden: Cross-site request rejected" },
            { status: 403 }
          );
        }
      } catch {
        return NextResponse.json(
          { error: "Forbidden: Malformed origin" },
          { status: 403 }
        );
      }
    }

    const token = req.cookies.get(AUTH_COOKIE_NAME)?.value;
    if (!token) {
      return NextResponse.json(
        { error: "Authentication required. Please enter your passcode." },
        { status: 401 }
      );
    }

    const isValid = await verifySessionToken(token);
    if (!isValid) {
      return NextResponse.json(
        { error: "Session expired or invalid. Please re-enter your passcode." },
        { status: 401 }
      );
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/chat/:path*", "/api/memory/:path*"],
};
