const MIN_POSTS_PER_BUCKET = 4;

export type RawRow = Record<string, string>;

export type Post = {
  date: Date;
  hasTime: boolean;
  format: string;
  caption: string;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  engagementRate: number;
};

// Engagement rate is total interactions divided by views.
export function engagementRate(
  p: Pick<Post, "likes" | "comments" | "shares" | "saves" | "views">
): number {
  return (p.likes + p.comments + p.shares + p.saves) / p.views;
}

// Turn CSV rows into posts. Unusable rows are counted in skipped.
export function parsePosts(rows: RawRow[]): { posts: Post[]; skipped: number } {
  const posts: Post[] = [];
  let skipped = 0;

  for (const row of rows) {
    const post = toPost(normalizeKeys(row));
    if (!post) {
      skipped += 1;
      continue;
    }
    posts.push(post);
  }

  posts.sort((a, b) => a.date.getTime() - b.date.getTime());
  return { posts, skipped };
}

// Lowercase and trim header names so "Views" and " views " match.
function normalizeKeys(row: RawRow): RawRow {
  const normalized: RawRow = {};
  for (const [key, value] of Object.entries(row)) {
    normalized[key.trim().toLowerCase()] = value;
  }
  return normalized;
}

// Build one post, or return null when the row should be skipped.
function toPost(row: RawRow): Post | null {
  const parsed = parseLocalDate(row.date ?? "");
  if (!parsed) return null;

  const format = (row.format ?? "").trim().toLowerCase();
  if (!format) return null;

  const views = parseCount(row.views, null);
  if (views === null || views <= 0) return null;

  const likes = parseCount(row.likes, 0);
  const comments = parseCount(row.comments, 0);
  const shares = parseCount(row.shares, 0);
  const saves = parseCount(row.saves, 0);
  if (likes === null || comments === null || shares === null || saves === null) {
    return null;
  }

  const counts = { views, likes, comments, shares, saves };
  return {
    date: parsed.date,
    hasTime: parsed.hasTime,
    format,
    caption: row.caption ?? "",
    ...counts,
    engagementRate: engagementRate(counts),
  };
}

// Read a count. Blank optional fields use the fallback; invalid or negative values fail.
function parseCount(value: string | undefined, ifMissing: number | null): number | null {
  if (value === undefined || value.trim() === "") return ifMissing;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

// Parse YYYY-MM-DD or YYYY-MM-DDTHH:mm in local time.
// new Date("2026-10-14") is UTC and can shift the calendar day.
function parseLocalDate(value: string): { date: Date; hasTime: boolean } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?$/.exec(value.trim());
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hasTime = match[4] !== undefined;
  const hour = hasTime ? Number(match[4]) : 0;
  const minute = hasTime ? Number(match[5]) : 0;

  const date = new Date(year, month - 1, day, hour, minute, 0, 0);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day ||
    date.getHours() !== hour ||
    date.getMinutes() !== minute
  ) {
    return null;
  }

  return { date, hasTime };
}

const MIN_RANK_VIEWS = 100;
const CAPTION_MAX = 80;
const TREND_DAYS = 30;

const WEEKDAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export type FormatStat = {
  format: string;
  count: number;
  avgViews: number;
  avgEngagementRate: number;
};

export type HourStat = {
  hour: number;
  avgEngagementRate: number;
  count: number;
};

export type WeekdayStat = {
  weekday: number;
  name: string;
  avgEngagementRate: number;
  count: number;
};

export type PeriodStat = {
  count: number;
  avgViews: number;
  avgEngagementRate: number;
};

export type TrendStat = {
  recent: PeriodStat;
  previous: PeriodStat;
  engagementChangePct: number | null;
  viewsChangePct: number | null;
};

// Post sent to the AI: date is a string, caption is at most 80 characters.
export type StatsPost = {
  date: string;
  hasTime: boolean;
  format: string;
  caption: string;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  engagementRate: number;
};

export type Stats = {
  totalPosts: number;
  dateRange: { start: string | null; end: string | null };
  byFormat: FormatStat[];
  bestHour: HourStat | null;
  bestWeekday: WeekdayStat | null;
  topAndBottom: { top: StatsPost[]; bottom: StatsPost[] };
  trend: TrendStat;
};

// Average engagement and views for each format, highest engagement first.
export function byFormat(posts: Post[]): FormatStat[] {
  const groups = groupPosts(posts, (post) => post.format);
  const stats: FormatStat[] = [];

  for (const [format, group] of groups) {
    stats.push({ format, ...averages(group) });
  }

  stats.sort(
    (a, b) => b.avgEngagementRate - a.avgEngagementRate || a.format.localeCompare(b.format)
  );
  return stats;
}

// Best hour (0-23) by average engagement. Only posts with a clock time count.
// Hours with fewer than MIN_POSTS_PER_BUCKET (4) posts are ignored. Null when nothing qualifies.
export function bestHour(posts: Post[]): HourStat | null {
  const timed = posts.filter((post) => post.hasTime);
  if (timed.length === 0) return null;

  const best = bestGroup(groupPosts(timed, (post) => post.date.getHours()));
  if (!best) return null;
  return { hour: best.key, avgEngagementRate: best.avgEngagementRate, count: best.count };
}

// Best weekday (0 = Sunday) by average engagement, using the same 4-post minimum.
export function bestWeekday(posts: Post[]): WeekdayStat | null {
  const best = bestGroup(groupPosts(posts, (post) => post.date.getDay()));
  if (!best) return null;
  return {
    weekday: best.key,
    name: WEEKDAY_NAMES[best.key],
    avgEngagementRate: best.avgEngagementRate,
    count: best.count,
  };
}

// Highest and lowest engagement. Posts under 100 views are left out of the ranking.
// Bottom is worst-first. The two lists overlap when fewer than 2n posts qualify.
export function topAndBottom(posts: Post[], n = 5): { top: Post[]; bottom: Post[] } {
  const ranked = posts
    .filter((post) => post.views >= MIN_RANK_VIEWS)
    .sort((a, b) => b.engagementRate - a.engagementRate);

  const count = Math.max(0, Math.min(n, ranked.length));
  return {
    top: ranked.slice(0, count),
    bottom: ranked.slice(ranked.length - count).reverse(),
  };
}

// Last 30 days versus the 30 days before that.
// now defaults to the newest post, not the real current date.
// A change percent is null when the previous window has no posts.
export function trend(posts: Post[], now?: Date): TrendStat {
  const end = now ?? newestDate(posts);
  if (!end) return emptyTrend();

  const recent = averages(postsInWindow(posts, shiftDays(end, -TREND_DAYS), end.getTime()));
  const previous = averages(
    postsInWindow(posts, shiftDays(end, -TREND_DAYS * 2), shiftDays(end, -TREND_DAYS))
  );

  return {
    recent,
    previous,
    engagementChangePct: changePct(
      recent.avgEngagementRate,
      previous.avgEngagementRate,
      previous.count
    ),
    viewsChangePct: changePct(recent.avgViews, previous.avgViews, previous.count),
  };
}

// One payload for the AI: aggregates, plus the top and bottom posts only.
// Captions are cut to 80 characters. Dates stay on the local calendar day.
export function computeStats(posts: Post[]): Stats {
  const ranked = topAndBottom(posts);
  return {
    totalPosts: posts.length,
    dateRange: dateRange(posts),
    byFormat: byFormat(posts),
    bestHour: bestHour(posts),
    bestWeekday: bestWeekday(posts),
    topAndBottom: {
      top: ranked.top.map(toStatsPost),
      bottom: ranked.bottom.map(toStatsPost),
    },
    trend: trend(posts),
  };
}

function averages(posts: Post[]): PeriodStat {
  const count = posts.length;
  if (count === 0) return { count: 0, avgViews: 0, avgEngagementRate: 0 };

  let views = 0;
  let engagement = 0;
  for (const post of posts) {
    views += post.views;
    engagement += post.engagementRate;
  }

  return { count, avgViews: views / count, avgEngagementRate: engagement / count };
}

function groupPosts<K>(posts: Post[], keyOf: (post: Post) => K): Map<K, Post[]> {
  const groups = new Map<K, Post[]>();
  for (const post of posts) {
    const key = keyOf(post);
    const group = groups.get(key);
    if (group) group.push(post);
    else groups.set(key, [post]);
  }
  return groups;
}

// Highest average engagement among buckets with at least MIN_POSTS_PER_BUCKET posts.
// A tie goes to the smaller key so the result does not depend on input order.
function bestGroup(groups: Map<number, Post[]>): { key: number; avgEngagementRate: number; count: number } | null {
  let best: { key: number; avgEngagementRate: number; count: number } | null = null;

  for (const [key, group] of groups) {
    if (group.length < MIN_POSTS_PER_BUCKET) continue;
    const { avgEngagementRate, count } = averages(group);
    if (
      !best ||
      avgEngagementRate > best.avgEngagementRate ||
      (avgEngagementRate === best.avgEngagementRate && key < best.key)
    ) {
      best = { key, avgEngagementRate, count };
    }
  }

  return best;
}

// Calendar-day shift. setDate keeps the local clock time across a DST change.
function shiftDays(date: Date, days: number): number {
  const copy = new Date(date.getTime());
  copy.setDate(copy.getDate() + days);
  return copy.getTime();
}

// Posts in (afterMs, throughMs]. The two trend windows meet at one edge and do not overlap.
function postsInWindow(posts: Post[], afterMs: number, throughMs: number): Post[] {
  return posts.filter((post) => {
    const time = post.date.getTime();
    return time > afterMs && time <= throughMs;
  });
}

function newestDate(posts: Post[]): Date | null {
  let newest: Date | null = null;
  for (const post of posts) {
    if (!newest || post.date > newest) newest = post.date;
  }
  return newest;
}

function emptyTrend(): TrendStat {
  const empty = averages([]);
  return {
    recent: empty,
    previous: empty,
    engagementChangePct: null,
    viewsChangePct: null,
  };
}

// Null when the earlier window is empty. Both values at 0 is no change.
// A jump up from 0 has no meaningful percent.
function changePct(recent: number, previous: number, previousCount: number): number | null {
  if (previousCount === 0) return null;
  if (previous === 0) return recent === 0 ? 0 : null;
  return ((recent - previous) / previous) * 100;
}

function dateRange(posts: Post[]): { start: string | null; end: string | null } {
  if (posts.length === 0) return { start: null, end: null };

  let start = posts[0].date;
  let end = posts[0].date;
  for (const post of posts) {
    if (post.date < start) start = post.date;
    if (post.date > end) end = post.date;
  }

  return { start: toLocalISO(start), end: toLocalISO(end) };
}

// Local ISO, not toISOString(). UTC would shift the calendar day for these dates.
function toLocalISO(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  );
}

function toStatsPost(post: Post): StatsPost {
  return {
    date: toLocalISO(post.date),
    hasTime: post.hasTime,
    format: post.format,
    caption: post.caption.slice(0, CAPTION_MAX),
    views: post.views,
    likes: post.likes,
    comments: post.comments,
    shares: post.shares,
    saves: post.saves,
    engagementRate: post.engagementRate,
  };
}
