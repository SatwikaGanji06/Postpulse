import { readFileSync } from "node:fs";
import { join } from "node:path";
import Papa from "papaparse";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { computeStats, parsePosts, type RawRow } from "@/lib/analyze";
import { MAX_REQUESTS, resetRateLimitForTests } from "@/lib/rateLimit";
import { POST } from "./route";

const csv = readFileSync(join(process.cwd(), "public", "sample.csv"), "utf8");
const stats = computeStats(
  parsePosts(Papa.parse<RawRow>(csv, { header: true, skipEmptyLines: true }).data).posts
);

function request(body: string, ip = "203.0.113.1") {
  return new Request("http://localhost/api/insights", {
    method: "POST",
    headers: { "content-type": "application/json", "x-real-ip": ip },
    body,
  });
}

describe("POST /api/insights", () => {
  beforeEach(() => {
    // No key and no Redis: demo mode with the in-memory limiter.
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
    resetRateLimitForTests();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns rule-based demo insights when no API key is set", async () => {
    const response = await POST(request(JSON.stringify({ stats })));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.source).toBe("mock");
    expect(body.insights.summary).toContain("Reel is your strongest format");
    expect(body.insights.working.length).toBeGreaterThanOrEqual(2);
    expect(body.insights.notWorking.length).toBeGreaterThanOrEqual(2);
    expect(body.insights.captionTips.length).toBeGreaterThanOrEqual(2);
  });

  it("starts the demo plan on the best weekday", async () => {
    const body = await (await POST(request(JSON.stringify({ stats })))).json();
    expect(body.insights.plan.map((p: { day: string }) => p.day)).toEqual(["Sunday", "Tuesday", "Thursday"]);
  });

  it("rejects bodies that are not JSON", async () => {
    expect((await POST(request("not json"))).status).toBe(400);
  });

  it("rejects JSON without a stats object", async () => {
    expect((await POST(request(JSON.stringify({ rows: [] })))).status).toBe(400);
  });

  it("rejects payloads over 50 KB", async () => {
    const big = JSON.stringify({ stats: { ...stats, padding: "x".repeat(60 * 1024) } });
    expect((await POST(request(big))).status).toBe(413);
  });

  it(`allows ${MAX_REQUESTS} requests a minute per IP, then returns 429`, async () => {
    const body = JSON.stringify({ stats });
    for (let i = 0; i < MAX_REQUESTS; i += 1) {
      expect((await POST(request(body))).status).toBe(200);
    }
    expect((await POST(request(body))).status).toBe(429);
    // A different visitor is not affected.
    expect((await POST(request(body, "198.51.100.7"))).status).toBe(200);
  });
});
