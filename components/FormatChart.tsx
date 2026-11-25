"use client";

import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { FormatStat } from "@/lib/analyze";

const BRAND = "#5B4BE8";
const MUTED = "#A9A3FF";
const INK_SOFT = "#4B4F7A";
const LINE = "#DCDDF0";

type Row = { format: string; engagement: number; count: number; avgViews: number; best: boolean };

export default function FormatChart({ data }: { data: FormatStat[] }) {
  // byFormat is sorted best-first, so the first row is the best format.
  const rows: Row[] = data.map((row, index) => ({
    format: titled(row.format),
    engagement: row.avgEngagementRate * 100,
    count: row.count,
    avgViews: row.avgViews,
    best: index === 0,
  }));

  if (rows.length === 0) {
    return <p className="py-10 text-center text-sm text-ink-soft">No formats to compare yet.</p>;
  }

  return (
    <div className="w-full" style={{ height: Math.max(180, rows.length * 56 + 24) }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 56, left: 4, bottom: 4 }} barCategoryGap={14}>
          <CartesianGrid horizontal={false} stroke={LINE} strokeDasharray="3 3" />
          <XAxis
            type="number"
            tick={{ fontSize: 12, fill: INK_SOFT }}
            tickFormatter={(value: number) => `${value}%`}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="format"
            width={64}
            tick={{ fontSize: 13, fill: "#14163A", fontWeight: 600 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip cursor={{ fill: "rgba(91,75,232,0.06)" }} content={<ChartTooltip />} />
          <Bar dataKey="engagement" radius={[0, 8, 8, 0]} isAnimationActive>
            {rows.map((row) => (
              <Cell key={row.format} fill={row.best ? BRAND : MUTED} />
            ))}
            <LabelList
              dataKey="engagement"
              position="right"
              formatter={(value: unknown) => `${Number(value).toFixed(1)}%`}
              style={{ fontSize: 12, fontWeight: 700, fill: "#14163A" }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function ChartTooltip({ active, payload }: { active?: boolean; payload?: { payload: Row }[] }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div className="rounded-xl border border-line bg-white px-3 py-2 text-xs shadow-card">
      <p className="font-bold text-ink">
        {row.format}
        {row.best ? <span className="ml-1.5 text-brand">★ best</span> : null}
      </p>
      <p className="mt-1 text-ink-soft">
        <span className="font-semibold text-ink">{row.engagement.toFixed(1)}%</span> avg engagement
      </p>
      <p className="text-ink-soft">
        {Math.round(row.avgViews).toLocaleString()} avg views · {row.count} posts
      </p>
    </div>
  );
}

function titled(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
