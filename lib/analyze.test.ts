import { readFileSync } from "node:fs";
import { join } from "node:path";
import Papa from "papaparse";
import { describe, expect, it } from "vitest";
import {
  bestHour,
  bestWeekday,
  byFormat,
  computeStats,
  parsePosts,
  topAndBottom,
  trend,
  type RawRow,
} from "./analyze";

// Build a CSV-like row. Counts default to an ordinary post.
function row(overrides: Partial<RawRow> = {}): RawRow {
  return {
    date: "2026-10-14T09:00",
    format: "reel",
    caption: "A post",
    views: "1000",
    likes: "50",
    comments: "5",
    shares: "2",
    saves: "3",
    ...overrides,
  };
}

describe("sample.csv (numbers shown in the pitch deck)", () => {
  const csv = readFileSync(join(process.cwd(), "public", "sample.csv"), "utf8");
  const parsed = Papa.parse<RawRow>(csv, { header: true, skipEmptyLines: true });
  const { posts, skipped } = parsePosts(parsed.data);
  const stats = computeStats(posts);

  it("reads all 75 posts", () => {
    expect(posts).toHaveLength(75);
    expect(skipped).toBe(0);
    expect(stats.totalPosts).toBe(75);
  });

  it("finds Reel as the best format, then video, post, story", () => {
    expect(stats.byFormat.map((f) => f.format)).toEqual(["reel", "video", "post", "story"]);
    expect(stats.byFormat[0].avgEngagementRate).toBeCloseTo(0.088, 3);
  });

  it("finds 9 AM and Sunday as the best hour and day", () => {
    expect(stats.bestHour?.hour).toBe(9);
    expect(stats.bestWeekday?.name).toBe("Sunday");
  });

  it("shows engagement down 22.7% and views down 12.1% on the previous 30 days", () => {
    expect(stats.trend.engagementChangePct).toBeCloseTo(-22.667, 2);
    expect(stats.trend.viewsChangePct).toBeCloseTo(-12.143, 2);
    expect(stats.trend.recent.count).toBe(25);
    expect(stats.trend.previous.count).toBe(25);
  });

  it("keeps the date range on the local calendar day", () => {
    expect(stats.dateRange).toEqual({ start: "2026-08-27T16:45:00", end: "2026-11-24T17:30:00" });
  });
});

describe("parsePosts", () => {
  it("computes engagement as interactions divided by views", () => {
    const { posts } = parsePosts([row({ views: "200", likes: "10", comments: "4", shares: "3", saves: "3" })]);
    expect(posts[0].engagementRate).toBeCloseTo(0.1);
  });

  it("matches headers regardless of case and spaces", () => {
    const { posts } = parsePosts([{ " Date ": "2026-10-14", FORMAT: "Reel", Views: "100" }]);
    expect(posts).toHaveLength(1);
    expect(posts[0].format).toBe("reel");
  });

  it("treats blank optional counts as zero", () => {
    const { posts } = parsePosts([row({ likes: "", comments: "", shares: "", saves: "" })]);
    expect(posts[0].engagementRate).toBe(0);
  });

  it.each([
    ["a date in the wrong format", { date: "14/10/2026" }],
    ["an impossible date", { date: "2026-02-30" }],
    ["a missing format", { format: " " }],
    ["zero views", { views: "0" }],
    ["missing views", { views: "" }],
    ["a negative count", { likes: "-3" }],
    ["a non-number count", { saves: "lots" }],
  ])("skips a row with %s", (_label, overrides) => {
    const result = parsePosts([row(), row(overrides)]);
    expect(result.posts).toHaveLength(1);
    expect(result.skipped).toBe(1);
  });

  it("sorts posts oldest first", () => {
    const { posts } = parsePosts([row({ date: "2026-10-20" }), row({ date: "2026-10-01" })]);
    expect(posts.map((p) => p.date.getDate())).toEqual([1, 20]);
  });

  it("only marks posts with a clock time as timed", () => {
    const { posts } = parsePosts([row({ date: "2026-10-14" }), row({ date: "2026-10-15T19:30" })]);
    expect(posts.map((p) => p.hasTime)).toEqual([false, true]);
  });
});

describe("best hour and weekday", () => {
  it("ignores hours with fewer than 4 posts", () => {
    // One great post at 7 AM should not beat four decent posts at 6 PM.
    const rows = [
      row({ date: "2026-10-01T07:00", likes: "500" }),
      ...[2, 3, 4, 5].map((d) => row({ date: `2026-10-0${d}T18:00` })),
    ];
    expect(bestHour(parsePosts(rows).posts)?.hour).toBe(18);
  });

  it("returns null when no post has a time", () => {
    const rows = [1, 2, 3, 4, 5].map((d) => row({ date: `2026-10-0${d}` }));
    expect(bestHour(parsePosts(rows).posts)).toBeNull();
  });

  it("returns null when no weekday has 4 posts", () => {
    const rows = [1, 2, 3].map((d) => row({ date: `2026-10-0${d}` }));
    expect(bestWeekday(parsePosts(rows).posts)).toBeNull();
  });
});

describe("byFormat", () => {
  it("sorts formats by average engagement, best first", () => {
    const rows = [row({ format: "story", likes: "10" }), row({ format: "reel", likes: "90" })];
    expect(byFormat(parsePosts(rows).posts).map((f) => f.format)).toEqual(["reel", "story"]);
  });
});

describe("topAndBottom", () => {
  function ranked(count: number) {
    const rows = Array.from({ length: count }, (_, i) =>
      row({ date: `2026-10-${String(i + 1).padStart(2, "0")}`, likes: String((i + 1) * 10), caption: `p${i + 1}` })
    );
    return topAndBottom(parsePosts(rows).posts);
  }

  it("returns 5 best and 5 worst when there are enough posts", () => {
    const { top, bottom } = ranked(12);
    expect(top.map((p) => p.caption)).toEqual(["p12", "p11", "p10", "p9", "p8"]);
    expect(bottom.map((p) => p.caption)).toEqual(["p1", "p2", "p3", "p4", "p5"]);
  });

  it("never puts the same post in both lists", () => {
    const { top, bottom } = ranked(7);
    expect(top).toHaveLength(5);
    expect(bottom.map((p) => p.caption)).toEqual(["p1", "p2"]);
    expect(top.some((p) => bottom.includes(p))).toBe(false);
  });

  it("leaves out posts under 100 views", () => {
    const { posts } = parsePosts([row({ views: "99", likes: "99" }), row()]);
    const { top, bottom } = topAndBottom(posts);
    expect(top).toHaveLength(1);
    expect(bottom).toHaveLength(0);
  });
});

describe("trend", () => {
  it("is null when the previous 30 days have no posts", () => {
    const { posts } = parsePosts([row({ date: "2026-10-01" }), row({ date: "2026-10-20" })]);
    const result = trend(posts);
    expect(result.engagementChangePct).toBeNull();
    expect(result.recent.count).toBe(2);
  });

  it("compares the last 30 days with the 30 before", () => {
    const { posts } = parsePosts([
      row({ date: "2026-09-10", likes: "100", comments: "0", shares: "0", saves: "0" }),
      row({ date: "2026-10-20", likes: "50", comments: "0", shares: "0", saves: "0" }),
    ]);
    expect(trend(posts).engagementChangePct).toBeCloseTo(-50);
  });
});

describe("computeStats", () => {
  it("cuts captions to 80 characters before they go to the AI", () => {
    const { posts } = parsePosts([row({ caption: "x".repeat(200) })]);
    expect(computeStats(posts).topAndBottom.top[0].caption).toHaveLength(80);
  });
});
