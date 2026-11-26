import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// In-memory sliding window fallback for local development
interface MemoryRecord {
  timestamps: number[];
}
const memoryRateLimits = new Map<string, MemoryRecord>();

function memoryLimit(
  key: string,
  limit: number,
  windowMs: number
): { success: boolean; remaining: number; reset: number } {
  const now = Date.now();
  const windowStart = now - windowMs;
  let record = memoryRateLimits.get(key);

  if (!record) {
    record = { timestamps: [] };
    memoryRateLimits.set(key, record);
  }

  // Filter out expired timestamps
  record.timestamps = record.timestamps.filter((ts) => ts > windowStart);

  if (record.timestamps.length >= limit) {
    const oldestTimestamp = record.timestamps[0] || now;
    const resetTime = oldestTimestamp + windowMs;
    return {
      success: false,
      remaining: 0,
      reset: Math.max(1, Math.ceil((resetTime - now) / 1000)),
    };
  }

  record.timestamps.push(now);
  return {
    success: true,
    remaining: limit - record.timestamps.length,
    reset: Math.ceil(windowMs / 1000),
  };
}

let redisClient: Redis | null = null;
let chatMinuteRatelimit: Ratelimit | null = null;
let chatDailyRatelimit: Ratelimit | null = null;
let authBruteForceRatelimit: Ratelimit | null = null;
let memoryApiRatelimit: Ratelimit | null = null;
let extractApiRatelimit: Ratelimit | null = null;

const hasUpstash = Boolean(
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
);

if (hasUpstash) {
  try {
    redisClient = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    });

    chatMinuteRatelimit = new Ratelimit({
      redis: redisClient,
      limiter: Ratelimit.slidingWindow(15, "1 m"),
      analytics: false,
      prefix: "rl:chat:min",
    });

    chatDailyRatelimit = new Ratelimit({
      redis: redisClient,
      limiter: Ratelimit.slidingWindow(300, "1 d"),
      analytics: false,
      prefix: "rl:chat:day",
    });

    authBruteForceRatelimit = new Ratelimit({
      redis: redisClient,
      limiter: Ratelimit.slidingWindow(5, "15 m"),
      analytics: false,
      prefix: "rl:auth:bf",
    });

    memoryApiRatelimit = new Ratelimit({
      redis: redisClient,
      limiter: Ratelimit.slidingWindow(60, "1 m"),
      analytics: false,
      prefix: "rl:mem:api",
    });

    extractApiRatelimit = new Ratelimit({
      redis: redisClient,
      limiter: Ratelimit.slidingWindow(10, "1 m"),
      analytics: false,
      prefix: "rl:mem:ext",
    });
  } catch (err) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(`Failed to initialize Upstash Redis rate limiter: ${err}`);
    }
  }
} else if (process.env.NODE_ENV !== "production") {
  console.warn(
    "[GlassChat] Upstash Redis credentials not found. Using in-memory rate limiting fallback for local dev."
  );
}

export interface RateLimitResult {
  success: boolean;
  limit?: number;
  remaining?: number;
  resetSeconds?: number;
  error?: string;
}

export async function checkChatRateLimit(identifier: string): Promise<RateLimitResult> {
  const isProd = process.env.NODE_ENV === "production";

  if (!hasUpstash || !chatMinuteRatelimit || !chatDailyRatelimit) {
    if (isProd) {
      return {
        success: false,
        error: "Rate limiting service unavailable in production. Failing closed.",
      };
    }
    // In-memory fallback for local dev
    const minCheck = memoryLimit(`chat:min:${identifier}`, 15, 60 * 1000);
    if (!minCheck.success) {
      return {
        success: false,
        remaining: 0,
        resetSeconds: minCheck.reset,
        error: "Rate limit exceeded (15 requests/minute). Please wait a moment.",
      };
    }

    const dayCheck = memoryLimit(`chat:day:${identifier}`, 300, 24 * 60 * 60 * 1000);
    if (!dayCheck.success) {
      return {
        success: false,
        remaining: 0,
        resetSeconds: dayCheck.reset,
        error: "Daily rate limit exceeded (300 requests/day). Please try again tomorrow.",
      };
    }

    return {
      success: true,
      remaining: Math.min(minCheck.remaining, dayCheck.remaining),
      resetSeconds: minCheck.reset,
    };
  }

  try {
    const minRes = await chatMinuteRatelimit.limit(identifier);
    if (!minRes.success) {
      const resetSeconds = Math.max(1, Math.ceil((minRes.reset - Date.now()) / 1000));
      return {
        success: false,
        remaining: minRes.remaining,
        resetSeconds,
        error: "Rate limit exceeded (15 requests/minute). Please wait a moment.",
      };
    }

    const dayRes = await chatDailyRatelimit.limit(identifier);
    if (!dayRes.success) {
      const resetSeconds = Math.max(1, Math.ceil((dayRes.reset - Date.now()) / 1000));
      return {
        success: false,
        remaining: dayRes.remaining,
        resetSeconds,
        error: "Daily rate limit exceeded (300 requests/day).",
      };
    }

    return {
      success: true,
      remaining: Math.min(minRes.remaining, dayRes.remaining),
      resetSeconds: Math.max(1, Math.ceil((minRes.reset - Date.now()) / 1000)),
    };
  } catch {
    if (isProd) {
      return {
        success: false,
        error: "Rate limiting error. Request blocked for security.",
      };
    }
    return { success: true };
  }
}

export async function checkAuthBruteForce(ip: string): Promise<RateLimitResult> {
  const isProd = process.env.NODE_ENV === "production";

  if (!hasUpstash || !authBruteForceRatelimit) {
    if (isProd) {
      return {
        success: false,
        error: "Rate limiting service unavailable in production.",
      };
    }
    const check = memoryLimit(`auth:fail:${ip}`, 5, 15 * 60 * 1000);
    if (!check.success) {
      return {
        success: false,
        resetSeconds: check.reset,
        error: "Too many failed passcode attempts. Please wait 15 minutes before trying again.",
      };
    }
    return { success: true, remaining: check.remaining };
  }

  try {
    const res = await authBruteForceRatelimit.limit(ip);
    if (!res.success) {
      const resetSeconds = Math.max(1, Math.ceil((res.reset - Date.now()) / 1000));
      return {
        success: false,
        remaining: res.remaining,
        resetSeconds,
        error: "Too many failed passcode attempts. Please wait 15 minutes before trying again.",
      };
    }
    return { success: true, remaining: res.remaining };
  } catch {
    if (isProd) {
      return {
        success: false,
        error: "Security check error. Request rejected.",
      };
    }
    return { success: true };
  }
}

export async function checkMemoryRateLimit(identifier: string): Promise<RateLimitResult> {
  const isProd = process.env.NODE_ENV === "production";

  if (!hasUpstash || !memoryApiRatelimit) {
    if (isProd) {
      return {
        success: false,
        error: "Rate limiting service unavailable in production.",
      };
    }
    const check = memoryLimit(`mem:api:${identifier}`, 60, 60 * 1000);
    if (!check.success) {
      return {
        success: false,
        resetSeconds: check.reset,
        error: "Memory operation rate limit exceeded (60 requests/minute).",
      };
    }
    return { success: true, remaining: check.remaining };
  }

  try {
    const res = await memoryApiRatelimit.limit(identifier);
    if (!res.success) {
      const resetSeconds = Math.max(1, Math.ceil((res.reset - Date.now()) / 1000));
      return {
        success: false,
        remaining: res.remaining,
        resetSeconds,
        error: "Memory operation rate limit exceeded (60 requests/minute).",
      };
    }
    return { success: true, remaining: res.remaining };
  } catch {
    if (isProd) {
      return {
        success: false,
        error: "Rate limiting error. Request blocked.",
      };
    }
    return { success: true };
  }
}

export async function checkExtractRateLimit(identifier: string): Promise<RateLimitResult> {
  const isProd = process.env.NODE_ENV === "production";

  if (!hasUpstash || !extractApiRatelimit) {
    if (isProd) {
      return {
        success: false,
        error: "Rate limiting service unavailable in production.",
      };
    }
    const check = memoryLimit(`mem:ext:${identifier}`, 10, 60 * 1000);
    if (!check.success) {
      return {
        success: false,
        resetSeconds: check.reset,
        error: "Memory extraction rate limit reached (10 requests/minute).",
      };
    }
    return { success: true, remaining: check.remaining };
  }

  try {
    const res = await extractApiRatelimit.limit(identifier);
    if (!res.success) {
      const resetSeconds = Math.max(1, Math.ceil((res.reset - Date.now()) / 1000));
      return {
        success: false,
        remaining: res.remaining,
        resetSeconds,
        error: "Memory extraction rate limit reached (10 requests/minute).",
      };
    }
    return { success: true, remaining: res.remaining };
  } catch {
    if (isProd) {
      return {
        success: false,
        error: "Rate limiting error. Request blocked.",
      };
    }
    return { success: true };
  }
}

