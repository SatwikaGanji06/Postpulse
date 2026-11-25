"use client";

import { useEffect, useState } from "react";
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
        if (cached) setInsights(cached);
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
        const body = (await response.json()) as { insights?: Insights };
        if (!body.insights || typeof body.insights.summary !== "string") {
          throw new Error("Could not generate insights. Please try again.");
        }
        sessionStorage.setItem("postpulse:insights", JSON.stringify(body));
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
      <main className="flex min-h-screen items-center justify-center px-4 text-sm text-gray-600">
        Loading...
      </main>
    );
  }

  if (!stats) {
    return (
      <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center px-4 text-center">
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
    <main className="min-h-screen bg-gray-50 px-4 py-8">
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

        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Best format"
            value={bestFormat ? titled(bestFormat.format) : "n/a"}
            detail={bestFormat ? `${percent(bestFormat.avgEngagementRate)} avg engagement` : undefined}
          />
          <StatCard label="Best hour" value={stats.bestHour ? clock(stats.bestHour.hour) : "n/a"} />
          <StatCard label="Best day" value={stats.bestWeekday ? stats.bestWeekday.name : "n/a"} />
          <StatCard label="30-day engagement" value={trend == null ? "n/a" : signedPercent(trend)} />
        </section>

        <section className="rounded-lg border border-gray-200 bg-white p-4">
          <h2 className="text-lg font-semibold text-gray-900">Engagement by format</h2>
          <div className="mt-4">
            <FormatChart data={stats.byFormat} />
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <PostList title="Top 5" posts={stats.topAndBottom.top} />
          <PostList title="Bottom 5" posts={stats.topAndBottom.bottom} />
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold text-gray-900">AI insights</h2>
          {insightsLoading ? <p className="text-sm text-gray-600">Generating insights...</p> : null}
          {insightsError ? (
            <p role="alert" className="text-sm text-red-600">
              {insightsError}
            </p>
          ) : null}
          {insights ? <InsightCards insights={insights} /> : null}
        </section>
      </div>
    </main>
  );
}

function readCachedInsights(): Insights | null {
  const raw = sessionStorage.getItem("postpulse:insights");
  if (!raw) return null;
  try {
    const cached = JSON.parse(raw) as { insights?: Insights };
    if (cached.insights && typeof cached.insights.summary === "string") return cached.insights;
  } catch {
    return null;
  }
  return null;
}

function StatCard({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="mt-1 text-xl font-semibold text-gray-900">{value}</p>
      {detail ? <p className="mt-1 text-sm text-gray-600">{detail}</p> : null}
    </section>
  );
}

function PostList({ title, posts }: { title: string; posts: StatsPost[] }) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4">
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
  return `${hour12}:00 ${suffix}`;
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
