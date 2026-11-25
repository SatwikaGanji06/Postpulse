"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import type { Stats, StatsPost } from "@/lib/analyze";
import type { Insights } from "@/app/api/insights/route";
import FormatChart from "@/components/FormatChart";
import InsightCards from "@/components/InsightCards";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default function ResultsPage() {
  const [ready, setReady] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);
  const [skipped, setSkipped] = useState(0);
  const [insights, setInsights] = useState<Insights | null>(null);
  const [source, setSource] = useState<string | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [insightsError, setInsightsError] = useState<string | null>(null);

  useEffect(() => {
    const skippedValue = Number(sessionStorage.getItem("postpulse:skipped"));
    setSkipped(Number.isFinite(skippedValue) ? skippedValue : 0);

    const raw = sessionStorage.getItem("postpulse:stats");
    if (!raw) {
      setReady(true);
      return;
    }

    try {
      const parsed = JSON.parse(raw) as Stats;
      if (typeof parsed.totalPosts !== "number") {
        setStats(null);
      } else {
        setStats(parsed);
        const cached = readCachedInsights();
        if (cached) {
          setInsights(cached.insights);
          if (cached.source) {
            sessionStorage.setItem("postpulse:source", cached.source);
            setSource(cached.source);
          }
        }
      }
    } catch {
      setStats(null);
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!stats || insights) return;

    const controller = new AbortController();
    setInsightsLoading(true);
    setInsightsError(null);

    fetch("/api/insights", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stats }),
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          if (response.status === 429) {
            throw new Error("Too many requests. Please wait a minute and try again.");
          }
          throw new Error("Could not generate insights. Please try again.");
        }
        const body = (await response.json()) as { insights?: Insights; source?: unknown };
        if (!body.insights || typeof body.insights.summary !== "string") {
          throw new Error("Could not generate insights. Please try again.");
        }
        sessionStorage.setItem("postpulse:insights", JSON.stringify(body));
        const nextSource = typeof body.source === "string" ? body.source : null;
        if (nextSource) sessionStorage.setItem("postpulse:source", nextSource);
        else sessionStorage.removeItem("postpulse:source");
        setSource(nextSource);
        setInsights(body.insights);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        const message =
          error instanceof Error
            ? error.message
            : "Could not generate insights. Please try again.";
        setInsightsError(message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setInsightsLoading(false);
      });

    return () => controller.abort();
  }, [stats, insights]);

  if (!ready) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4 text-sm text-gray-600">
        Loading...
      </main>
    );
  }

  if (!stats) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4 text-center">
        <p className="text-lg text-gray-800">No data found</p>
        <Link href="/" className="mt-4 text-sm font-medium text-indigo-600">
          Back to upload
        </Link>
      </main>
    );
  }

  const bestFormat = stats.byFormat[0];
  const trend = stats.trend.engagementChangePct;

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8 sm:px-6">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">Your PostPulse report</h1>
            <p className="mt-1 text-sm text-gray-600">
              {stats.totalPosts} posts · {prettyDay(stats.dateRange.start)} –{" "}
              {prettyDay(stats.dateRange.end)}
            </p>
            {skipped > 0 ? (
              <p className="mt-1 text-sm text-gray-500">
                {skipped} {skipped === 1 ? "row" : "rows"} skipped
              </p>
            ) : null}
          </div>
          <Link href="/" className="text-sm font-medium text-indigo-600">
            New upload
          </Link>
        </header>

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Best format"
            icon={<FormatIcon />}
            value={bestFormat ? titled(bestFormat.format) : "n/a"}
            detail={bestFormat ? `${percent(bestFormat.avgEngagementRate)} avg engagement` : undefined}
          />
          <StatCard
            label="Best hour"
            icon={<ClockIcon />}
            value={stats.bestHour ? clock(stats.bestHour.hour) : "n/a"}
          />
          <StatCard
            label="Best day"
            icon={<CalendarIcon />}
            value={stats.bestWeekday ? stats.bestWeekday.name : "n/a"}
          />
          <StatCard label="30-day engagement" icon={<TrendIcon />} value={<TrendValue change={trend} />} />
        </section>

        <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">Engagement by format</h2>
          <div className="mt-4">
            <FormatChart data={stats.byFormat} />
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <PostList title="Top 5" posts={stats.topAndBottom.top} />
          <PostList title="Bottom 5" posts={stats.topAndBottom.bottom} />
        </section>

        <section className="flex flex-col gap-4" aria-busy={insightsLoading}>
          <h2 className="text-lg font-semibold text-gray-900">AI insights</h2>
          {insightsLoading ? <InsightSkeleton /> : null}
          {insightsError ? (
            <p role="alert" className="text-sm text-red-600">
              {insightsError}
            </p>
          ) : null}
          {insights && source === "mock" ? (
            <p className="text-xs text-gray-500">
              Demo insights. Add an API key for personalised AI advice.
            </p>
          ) : null}
          {insights ? <InsightCards insights={insights} /> : null}
        </section>
      </div>
    </main>
  );
}

function readCachedInsights(): { insights: Insights; source: string | null } | null {
  const raw = sessionStorage.getItem("postpulse:insights");
  if (!raw) return null;
  try {
    const cached = JSON.parse(raw) as { insights?: Insights; source?: unknown };
    if (!cached.insights || typeof cached.insights.summary !== "string") return null;
    const stored = sessionStorage.getItem("postpulse:source");
    const embedded = typeof cached.source === "string" ? cached.source : null;
    return { insights: cached.insights, source: stored ?? embedded };
  } catch {
    return null;
  }
}

function StatCard({
  label,
  value,
  detail,
  icon,
}: {
  label: string;
  value: ReactNode;
  detail?: string;
  icon: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-gray-500">{label}</p>
        {icon}
      </div>
      <p className="mt-2 text-xl font-semibold text-gray-900">{value}</p>
      {detail ? <p className="mt-1 text-sm text-gray-600">{detail}</p> : null}
    </section>
  );
}

function PostList({ title, posts }: { title: string; posts: StatsPost[] }) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <h2 className="font-semibold text-gray-900">{title}</h2>
      {posts.length === 0 ? (
        <p className="mt-3 text-sm text-gray-500">No posts to show.</p>
      ) : (
        <ol className="mt-3 space-y-3">
          {posts.map((post, index) => (
            <li key={`${post.date}-${post.caption}-${index}`} className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm text-gray-900">{post.caption || "Untitled"}</p>
                <p className="text-xs text-gray-500">{post.format}</p>
              </div>
              <p className="shrink-0 text-sm font-medium text-gray-800">{percent(post.engagementRate)}</p>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function InsightSkeleton() {
  return (
    <div className="space-y-4" aria-label="Generating insights">
      <PulseCard lines={2} />
      <div className="grid gap-4 md:grid-cols-2">
        <PulseCard />
        <PulseCard />
      </div>
      <PulseCard lines={4} />
      <PulseCard lines={3} />
    </div>
  );
}

function PulseCard({ lines = 3 }: { lines?: number }) {
  return (
    <div className="animate-pulse rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="h-4 w-1/3 rounded bg-gray-200" />
      <div className="mt-3 space-y-2">
        {Array.from({ length: lines }, (_, index) => (
          <div
            key={index}
            className={`h-3 rounded bg-gray-200 ${index === lines - 1 ? "w-2/3" : "w-full"}`}
          />
        ))}
      </div>
    </div>
  );
}

function IconWrap({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-indigo-50 text-indigo-600">
      <svg
        viewBox="0 0 24 24"
        className="h-4 w-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {children}
      </svg>
    </span>
  );
}

function FormatIcon() {
  return (
    <IconWrap>
      <path d="M4 20V10" />
      <path d="M10 20V4" />
      <path d="M16 20v-7" />
      <path d="M22 20H2" />
    </IconWrap>
  );
}

function ClockIcon() {
  return (
    <IconWrap>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v5l3 2" />
    </IconWrap>
  );
}

function CalendarIcon() {
  return (
    <IconWrap>
      <rect x="4" y="5" width="16" height="15" rx="2" />
      <path d="M8 3v4M16 3v4M4 10h16" />
    </IconWrap>
  );
}

function TrendIcon() {
  return (
    <IconWrap>
      <path d="M4 16l5-5 4 4 7-7" />
      <path d="M14 8h6v6" />
    </IconWrap>
  );
}

function TrendValue({ change }: { change: number | null }) {
  if (change == null) return <>n/a</>;
  if (change > 0) {
    return (
      <span className="inline-flex items-center gap-1 text-green-600">
        <Arrow direction="up" />
        {signedPercent(change)}
      </span>
    );
  }
  if (change < 0) {
    return (
      <span className="inline-flex items-center gap-1 text-red-600">
        <Arrow direction="down" />
        {signedPercent(change)}
      </span>
    );
  }
  return <>{signedPercent(change)}</>;
}

function Arrow({ direction }: { direction: "up" | "down" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {direction === "up" ? <path d="M6 14l6-6 6 6" /> : <path d="M6 10l6 6 6-6" />}
    </svg>
  );
}

function percent(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`;
}

function signedPercent(value: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

function clock(hour: number): string {
  const suffix = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 || 12;
  return `${hour12} ${suffix}`;
}

function titled(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function prettyDay(iso: string | null): string {
  if (!iso) return "n/a";
  const [year, month, day] = iso.slice(0, 10).split("-");
  const monthName = MONTHS[Number(month) - 1];
  if (!year || !monthName || !day) return iso.slice(0, 10);
  return `${monthName} ${Number(day)}, ${year}`;
}
