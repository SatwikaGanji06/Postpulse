import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// Rate limit for /api/insights, which is the only route that costs money (AI calls).
//
// On Vercel every request can land on a different server instance, so an in-memory
// counter is not shared and is easy to get around. When UPSTASH_REDIS_REST_URL and
// UPSTASH_REDIS_REST_TOKEN are set we use a shared Redis counter instead.
// Without them (local dev, or before Redis is set up) we fall back to memory.

export const MAX_REQUESTS = 10;
export const WINDOW_MS = 60_000;
const MAX_TRACKED_IPS = 5_000;

let shared: Ratelimit | null | undefined;

function sharedLimiter(): Ratelimit | null {
  if (shared !== undefined) return shared;
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  shared =
    url && token
      ? new Ratelimit({
          redis: new Redis({ url, token }),
          limiter: Ratelimit.slidingWindow(MAX_REQUESTS, `${WINDOW_MS / 1000} s`),
          prefix: "postpulse:insights",
        })
      : null;
  return shared;
}

const hitsByIp = new Map<string, number[]>();

function allowInMemory(ip: string, now: number): boolean {
  // Drop stale entries so the map can't grow without bound on a long-lived server.
  if (hitsByIp.size > MAX_TRACKED_IPS) {
    for (const [key, times] of hitsByIp) {
      if (times.every((time) => now - time >= WINDOW_MS)) hitsByIp.delete(key);
    }
  }

  const recent = (hitsByIp.get(ip) ?? []).filter((time) => now - time < WINDOW_MS);
  if (recent.length >= MAX_REQUESTS) {
    hitsByIp.set(ip, recent);
    return false;
  }
  recent.push(now);
  hitsByIp.set(ip, recent);
  return true;
}

export async function allowRequest(ip: string): Promise<boolean> {
  const limiter = sharedLimiter();
  if (limiter) {
    try {
      const { success } = await limiter.limit(ip);
      return success;
    } catch (error) {
      // If Redis is down, don't take the whole feature offline: fall back to memory.
      console.error("Shared rate limit failed:", error instanceof Error ? error.message : error);
    }
  }
  return allowInMemory(ip, Date.now());
}

// Vercel sets x-real-ip and overwrites x-forwarded-for with the real client address.
// Locally neither header may exist, so everything shares one "unknown" bucket.
export function clientIp(request: Request): string {
  const real = request.headers.get("x-real-ip")?.trim();
  if (real) return real;
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || "unknown";
}

// Test helper: start each test with an empty in-memory window.
export function resetRateLimitForTests(): void {
  hitsByIp.clear();
  shared = undefined;
}
