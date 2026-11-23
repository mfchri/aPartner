import { SignJWT, jwtVerify } from "jose";

export const AUTH_COOKIE_NAME = "glass_chat_session";
const SESSION_EXPIRATION_SECONDS = 30 * 24 * 60 * 60; // 30 days

function getAuthSecretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET || process.env.APP_PASSCODE;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("AUTH_SECRET or APP_PASSCODE is required in production");
    }
    // Fallback secret for local development only
    return new TextEncoder().encode("glass-chat-local-dev-secret-minimum-32-chars-long");
  }
  return new TextEncoder().encode(secret.padEnd(32, "#"));
}

/**
 * Constant-time comparison between two strings to prevent timing attacks.
 * Uses bitwise accumulator without early termination, safe across both Node and Edge runtimes.
 */
export function timingSafeEqualString(a: string, b: string): boolean {
  let mismatch = a.length === b.length ? 0 : 1;
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const charA = i < a.length ? a.charCodeAt(i) : 0;
    const charB = i < b.length ? b.charCodeAt(i) : 0;
    mismatch |= charA ^ charB;
  }
  return mismatch === 0;
}

export async function createSessionToken(): Promise<string> {
  const secretKey = getAuthSecretKey();
  const token = await new SignJWT({ auth: true })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_EXPIRATION_SECONDS}s`)
    .sign(secretKey);

  return token;
}

export async function verifySessionToken(token: string): Promise<boolean> {
  try {
    const secretKey = getAuthSecretKey();
    const { payload } = await jwtVerify(token, secretKey, {
      algorithms: ["HS256"],
    });
    return Boolean(payload && payload.auth === true);
  } catch {
    return false;
  }
}

export function isPasscodeConfigured(): boolean {
  return Boolean(process.env.APP_PASSCODE && process.env.APP_PASSCODE.trim().length > 0);
}

export function verifyPasscode(inputPasscode: string): { valid: boolean; error?: string } {
  const configuredPasscode = process.env.APP_PASSCODE;
  const isProd = process.env.NODE_ENV === "production";

  if (!configuredPasscode || configuredPasscode.trim().length === 0) {
    if (isProd) {
      return {
        valid: false,
        error: "Configuration error: APP_PASSCODE is required in production.",
      };
    }
    return {
      valid: false,
      error: "APP_PASSCODE is not set in environment variables.",
    };
  }

  const matches = timingSafeEqualString(inputPasscode.trim(), configuredPasscode.trim());
  return { valid: matches };
}
