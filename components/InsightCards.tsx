"use client";

import { useState } from "react";
import type { Insights } from "@/app/api/insights/route";
import { Icon, type IconName } from "@/components/ui";

export default function InsightCards({ insights }: { insights: Insights }) {
  return (
    <div className="space-y-4">
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-ink via-[#1f1d5c] to-brand p-6 text-white shadow-lift">
        <div aria-hidden="true" className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-brand-violet/40 blur-2xl" />
        <p className="relative inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-brand-light">
          <Icon name="sparkle" className="h-3.5 w-3.5" />
          The short version
        </p>
        <p className="relative mt-2 text-[15px] leading-7 text-white/90 sm:text-base">{insights.summary}</p>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <ListCard title="What's working" items={insights.working} tone="mint" icon="check" />
        <ListCard title="What's not" items={insights.notWorking} tone="coral" icon="alert" />
      </div>

      <PlanCard plan={insights.plan} />

      <ListCard title="Caption tips" items={insights.captionTips} tone="sun" icon="bulb" />
    </div>
  );
}

const TONES = {
  mint: { badge: "bg-mint/15 text-mint-dark", dot: "bg-mint" },
  coral: { badge: "bg-coral/15 text-coral-dark", dot: "bg-coral" },
  sun: { badge: "bg-sun/20 text-sun-dark", dot: "bg-sun" },
} as const;

function ListCard({
  title,
  items,
  tone,
  icon,
}: {
  title: string;
  items: string[];
  tone: keyof typeof TONES;
  icon: IconName;
}) {
  const style = TONES[tone];
  return (
    <section className="rounded-2xl border border-line bg-white p-5 shadow-card">
      <h3 className="flex items-center gap-2 font-bold text-ink">
        <span className={`inline-flex h-7 w-7 items-center justify-center rounded-lg ${style.badge}`}>
          <Icon name={icon} className="h-4 w-4" />
        </span>
        {title}
      </h3>
      <ul className="mt-4 space-y-3">
        {items.map((item, index) => (
          <li key={index} className="flex gap-3 text-sm leading-relaxed text-ink-soft">
            <span className={`mt-2 h-1.5 w-1.5 shrink-0 rounded-full ${style.dot}`} />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function PlanCard({ plan }: { plan: Insights["plan"] }) {
  const [copied, setCopied] = useState(false);

  async function copyPlan() {
    const text = ["My PostPulse plan for next week", ...plan.map((item) => `• ${item.day}: ${item.idea}`)].join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be blocked (e.g. insecure context). Nothing useful to show beyond no-op.
    }
  }

  return (
    <section className="rounded-2xl border border-line bg-white p-5 shadow-card">
      <div className="flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 font-bold text-ink">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-brand/10 text-brand">
            <Icon name="calendar" className="h-4 w-4" />
          </span>
          Next week&apos;s plan
        </h3>
        <button
          type="button"
          onClick={() => void copyPlan()}
          className="inline-flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-xs font-semibold text-ink-soft transition hover:border-brand-light hover:text-brand print:hidden"
          aria-live="polite"
        >
          <Icon name={copied ? "check" : "copy"} className="h-3.5 w-3.5" />
          {copied ? "Copied" : "Copy plan"}
        </button>
      </div>
      <ol className="relative mt-5 space-y-4 before:absolute before:bottom-2 before:left-[1.375rem] before:top-2 before:w-px before:bg-line">
        {plan.map((item, index) => (
          <li key={`${item.day}-${index}`} className="relative flex gap-4">
            <span className="relative z-10 inline-flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl bg-brand text-white shadow-lift">
              <span className="text-[10px] font-bold uppercase leading-none tracking-wider">{item.day.slice(0, 3)}</span>
            </span>
            <div className="pt-0.5">
              <p className="text-sm font-bold text-ink">{item.day}</p>
              <p className="mt-0.5 text-sm leading-relaxed text-ink-soft">{item.idea}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
