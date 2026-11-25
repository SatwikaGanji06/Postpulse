"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import type { PeriodStat, Stats, StatsPost } from "@/lib/analyze";
import type { Insights } from "@/app/api/insights/route";
import FormatChart from "@/components/FormatChart";
import InsightCards from "@/components/InsightCards";
import { Card, Icon, Logo, Spinner, type IconName } from "@/components/ui";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default function ResultsPage() {
  const [ready, setReady] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);
  const [skipped, setSkipped] = useState(0);
  const [insights, setInsights] = useState<Insights | null>(null);
  const [source, setSource] = useState<string | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [insightsError, setInsightsError] = useState<string | null>(null);
  // Bumped by the retry button to re-run the insights request.
  const [attempt, setAttempt] = useState(0);

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
          setSource(cached.source);
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
        const nextSource = typeof body.source === "string" ? body.source : null;
        sessionStorage.setItem("postpulse:insights", JSON.stringify(body));
        if (nextSource) sessionStorage.setItem("postpulse:source", nextSource);
        else sessionStorage.removeItem("postpulse:source");
        setSource(nextSource);
        setInsights(body.insights);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        const message =
          error instanceof Error ? error.message : "Could not generate insights. Please try again.";
        setInsightsError(message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setInsightsLoading(false);
      });

    return () => controller.abort();
  }, [stats, insights, attempt]);

  if (!ready) {
    return (
      <main className="flex min-h-screen items-center justify-center gap-2 px-4 text-sm text-ink-soft">
        <Spinner />
        Loading your report…
      </main>
    );
  }

  if (!stats) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
        <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-brand shadow-card">
          <Icon name="file" className="h-6 w-6" />
        </span>
        <h1 className="mt-5 text-xl font-bold text-ink">No report yet</h1>
        <p className="mt-1 max-w-sm text-sm text-ink-soft">
          Reports live in this browser tab only. Upload a CSV or try the sample data to make one.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-3 text-sm font-semibold text-white shadow-lift hover:bg-brand-dark"
        >
          <Icon name="upload" />
          Upload a CSV
        </Link>
      </main>
    );
  }

  const bestFormat = stats.byFormat[0];
  const { trend } = stats;

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-line/80 bg-mist/80 backdrop-blur print:static">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Logo />
          <div className="flex items-center gap-2 print:hidden">
            <button
              type="button"
              onClick={() => window.print()}
              className="hidden items-center gap-1.5 rounded-lg border border-line bg-white px-3 py-2 text-sm font-semibold text-ink-soft hover:border-brand-light hover:text-brand sm:inline-flex"
            >
              <Icon name="print" />
              Save as PDF
            </button>
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-white hover:bg-brand-dark"
            >
              <Icon name="upload" />
              New upload
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6">
        <div className="animate-fade-up">
          <p className="text-xs font-bold uppercase tracking-wider text-brand">Your report</p>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
            Here&apos;s how your posts are doing
          </h1>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
            <Chip icon="chart">{stats.totalPosts} posts</Chip>
            <Chip icon="calendar">
              {prettyDay(stats.dateRange.start)} – {prettyDay(stats.dateRange.end)}
            </Chip>
            {skipped > 0 ? (
              <Chip icon="alert" tone="sun">
                {skipped} {skipped === 1 ? "row" : "rows"} skipped (missing or invalid values)
              </Chip>
            ) : null}
          </div>
        </div>

        {/* KPI tiles */}
        <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4" aria-label="Key stats">
          <StatTile
            label="Best format"
            icon="chart"
            value={bestFormat ? titled(bestFormat.format) : "n/a"}
            detail={bestFormat ? `${percent(bestFormat.avgEngagementRate)} avg engagement` : "Not enough posts"}
            highlight
          />
          <StatTile
            label="Best hour"
            icon="clock"
            value={stats.bestHour ? clock(stats.bestHour.hour) : "n/a"}
            detail={
              stats.bestHour
                ? `${percent(stats.bestHour.avgEngagementRate)} across ${stats.bestHour.count} posts`
                : "Add post times to unlock"
            }
          />
          <StatTile
            label="Best day"
            icon="calendar"
            value={stats.bestWeekday ? stats.bestWeekday.name : "n/a"}
            detail={
              stats.bestWeekday
                ? `${percent(stats.bestWeekday.avgEngagementRate)} across ${stats.bestWeekday.count} posts`
                : "Needs 4+ posts on a day"
            }
          />
          <StatTile
            label="30-day engagement"
            icon="trend"
            value={<TrendValue change={trend.engagementChangePct} />}
            detail={trend.engagementChangePct == null ? "Needs 60 days of posts" : "vs the 30 days before"}
          />
        </section>

        <div className="grid gap-6 lg:grid-cols-5">
          <Card className="lg:col-span-3">
            <CardHeading title="Engagement by format" subtitle="Average (likes + comments + shares + saves) ÷ views" />
            <div className="mt-4">
              <FormatChart data={stats.byFormat} />
            </div>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeading title="Last 30 days vs before" subtitle="Per-post averages" />
            <div className="mt-5 space-y-5">
              <CompareRow
                label="Engagement rate"
                recent={trend.recent}
                previous={trend.previous}
                pick={(p) => p.avgEngagementRate}
                format={percent}
                change={trend.engagementChangePct}
              />
              <CompareRow
                label="Views per post"
                recent={trend.recent}
                previous={trend.previous}
                pick={(p) => p.avgViews}
                format={(v) => Math.round(v).toLocaleString()}
                change={trend.viewsChangePct}
              />
              <p className="border-t border-line pt-4 text-xs text-ink-soft">
                {trend.recent.count} posts in the last 30 days, {trend.previous.count} in the 30 days before.
              </p>
            </div>
          </Card>
        </div>

        <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <PostList title="Top posts" subtitle="Highest engagement" posts={stats.topAndBottom.top} tone="mint" />
          <PostList title="Bottom posts" subtitle="Lowest engagement" posts={stats.topAndBottom.bottom} tone="coral" />
        </section>

        <section className="flex flex-col gap-4 pt-2" aria-busy={insightsLoading} aria-live="polite">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-brand">AI insights</p>
              <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-ink">What to do next</h2>
            </div>
            {insights ? <SourceBadge source={source} /> : null}
          </div>

          {insightsLoading ? <InsightSkeleton /> : null}

          {insightsError ? (
            <div
              role="alert"
              className="flex flex-col gap-3 rounded-2xl border border-coral/30 bg-coral/10 p-4 text-sm text-coral-dark sm:flex-row sm:items-center sm:justify-between"
            >
              <p className="flex items-center gap-2">
                <Icon name="alert" className="h-4 w-4 shrink-0" />
                {insightsError}
              </p>
              <button
                type="button"
                onClick={() => setAttempt((n) => n + 1)}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-white px-3 py-2 font-semibold text-ink shadow-card hover:text-brand"
              >
                <Icon name="refresh" />
                Try again
              </button>
            </div>
          ) : null}

          {insights ? <InsightCards insights={insights} /> : null}
        </section>

        <p className="flex items-center justify-center gap-1.5 pb-4 pt-6 text-xs text-ink-soft">
          <Icon name="lock" className="h-3.5 w-3.5" />
          Your CSV never left this browser. Only summary stats were sent to the AI.
        </p>
      </main>
    </div>
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

function Chip({
  icon,
  children,
  tone = "default",
}: {
  icon: IconName;
  children: ReactNode;
  tone?: "default" | "sun";
}) {
  const cls = tone === "sun" ? "border-sun/40 bg-sun/15 text-sun-dark" : "border-line bg-white text-ink-soft";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-medium ${cls}`}>
      <Icon name={icon} className="h-3.5 w-3.5" />
      {children}
    </span>
  );
}

function CardHeading({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div>
      <h2 className="font-bold text-ink">{title}</h2>
      {subtitle ? <p className="mt-0.5 text-xs text-ink-soft">{subtitle}</p> : null}
    </div>
  );
}

function StatTile({
  label,
  value,
  detail,
  icon,
  highlight = false,
}: {
  label: string;
  value: ReactNode;
  detail?: string;
  icon: IconName;
  highlight?: boolean;
}) {
  return (
    <section
      className={`animate-fade-up rounded-2xl border p-4 shadow-card sm:p-5 ${
        highlight ? "border-transparent bg-gradient-to-br from-brand to-brand-violet text-white" : "border-line bg-white"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className={`text-xs font-semibold uppercase tracking-wider ${highlight ? "text-white/80" : "text-ink-soft"}`}>
          {label}
        </p>
        <span
          className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
            highlight ? "bg-white/15 text-white" : "bg-brand/10 text-brand"
          }`}
        >
          <Icon name={icon} />
        </span>
      </div>
      <p className={`mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl ${highlight ? "text-white" : "text-ink"}`}>
        {value}
      </p>
      {detail ? <p className={`mt-1 text-xs ${highlight ? "text-white/80" : "text-ink-soft"}`}>{detail}</p> : null}
    </section>
  );
}

function CompareRow({
  label,
  recent,
  previous,
  pick,
  format,
  change,
}: {
  label: string;
  recent: PeriodStat;
  previous: PeriodStat;
  pick: (p: PeriodStat) => number;
  format: (v: number) => string;
  change: number | null;
}) {
  const r = pick(recent);
  const p = pick(previous);
  const max = Math.max(r, p) || 1;
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <p className="text-sm font-semibold text-ink">{label}</p>
        <span className="text-sm font-bold">
          <TrendValue change={change} small />
        </span>
      </div>
      <div className="mt-2 space-y-1.5">
        <Bar label="Last 30d" value={format(r)} width={(r / max) * 100} color="bg-brand" />
        <Bar label="Prior 30d" value={format(p)} width={(p / max) * 100} color="bg-brand-light/60" />
      </div>
    </div>
  );
}

function Bar({ label, value, width, color }: { label: string; value: string; width: number; color: string }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-16 shrink-0 text-ink-soft">{label}</span>
      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-mist">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.max(width, 2)}%` }} />
      </div>
      <span className="w-14 shrink-0 text-right font-semibold text-ink">{value}</span>
    </div>
  );
}

function PostList({
  title,
  subtitle,
  posts,
  tone,
}: {
  title: string;
  subtitle: string;
  posts: StatsPost[];
  tone: "mint" | "coral";
}) {
  const max = Math.max(...posts.map((p) => p.engagementRate), 0) || 1;
  const bar = tone === "mint" ? "bg-mint" : "bg-coral";
  const rank = tone === "mint" ? "bg-mint/15 text-mint-dark" : "bg-coral/15 text-coral-dark";
  return (
    <Card>
      <CardHeading title={title} subtitle={subtitle} />
      {posts.length === 0 ? (
        <p className="mt-4 text-sm text-ink-soft">Not enough posts with 100+ views to rank.</p>
      ) : (
        <ol className="mt-4 divide-y divide-line">
          {posts.map((post, index) => (
            <li key={`${post.date}-${post.caption}-${index}`} className="flex items-center gap-3 py-3">
              <span className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${rank}`}>
                {index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-ink" title={post.caption || "Untitled"}>
                  {post.caption || "Untitled"}
                </p>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-ink-soft">
                  <span className="rounded bg-mist px-1.5 py-0.5 font-medium capitalize text-ink">{post.format}</span>
                  <span>{prettyDay(post.date)}</span>
                  <span className="inline-flex items-center gap-1">
                    <Icon name="eye" className="h-3 w-3" />
                    {post.views.toLocaleString()}
                  </span>
                </p>
              </div>
              <div className="w-20 shrink-0 text-right">
                <p className="text-sm font-bold text-ink">{percent(post.engagementRate)}</p>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-mist">
                  <div className={`ml-auto h-full rounded-full ${bar}`} style={{ width: `${(post.engagementRate / max) * 100}%` }} />
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

function SourceBadge({ source }: { source: string | null }) {
  if (source === "anthropic") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-brand/10 px-3 py-1 text-xs font-semibold text-brand">
        <Icon name="sparkle" className="h-3.5 w-3.5" />
        Written by AI from your stats
      </span>
    );
  }
  // mock = no API key configured; fallback = the AI call failed, so rule-based advice was used.
  const text =
    source === "fallback"
      ? "AI was unavailable, so these are rule-based tips from your stats"
      : "Demo mode: rule-based tips from your stats (no API key set)";
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-3 py-1 text-xs font-medium text-ink-soft">
      <Icon name="bulb" className="h-3.5 w-3.5" />
      {text}
    </span>
  );
}

function InsightSkeleton() {
  return (
    <div className="space-y-4" aria-label="Generating insights">
      <div className="flex items-center gap-2 text-sm text-ink-soft">
        <Spinner />
        Reading your stats and writing your plan…
      </div>
      <div className="h-28 animate-pulse rounded-2xl bg-gradient-to-br from-ink/80 to-brand/70" />
      <div className="grid gap-4 md:grid-cols-2">
        <PulseCard />
        <PulseCard />
      </div>
      <PulseCard lines={4} />
    </div>
  );
}

function PulseCard({ lines = 3 }: { lines?: number }) {
  return (
    <div className="animate-pulse rounded-2xl border border-line bg-white p-5 shadow-card">
      <div className="h-4 w-1/3 rounded bg-line" />
      <div className="mt-4 space-y-2.5">
        {Array.from({ length: lines }, (_, index) => (
          <div key={index} className={`h-3 rounded bg-mist ${index === lines - 1 ? "w-2/3" : "w-full"}`} />
        ))}
      </div>
    </div>
  );
}

function TrendValue({ change, small = false }: { change: number | null; small?: boolean }) {
  if (change == null) return <span className={small ? "text-ink-soft" : undefined}>n/a</span>;
  const size = small ? "h-3.5 w-3.5" : "h-5 w-5";
  if (change === 0) return <>{signedPercent(change)}</>;
  const up = change > 0;
  return (
    <span className={`inline-flex items-center gap-1 ${up ? "text-mint-dark" : "text-coral"}`}>
      <svg viewBox="0 0 24 24" className={size} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {up ? <path d="M6 14l6-6 6 6" /> : <path d="M6 10l6 6 6-6" />}
      </svg>
      <span className="sr-only">{up ? "up" : "down"}</span>
      {signedPercent(change)}
    </span>
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
