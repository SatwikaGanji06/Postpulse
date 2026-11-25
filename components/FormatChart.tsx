"use client";

import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { FormatStat } from "@/lib/analyze";

const INDIGO = "#4f46e5";
const INDIGO_DARK = "#3730a3";

export default function FormatChart({ data }: { data: FormatStat[] }) {
  // byFormat is sorted best-first, so the first row is the best format.
  const bestFormat = data[0]?.format;
  const rows = data.map((row) => ({
    format: row.format,
    engagement: row.avgEngagementRate * 100,
    fill: row.format === bestFormat ? INDIGO_DARK : INDIGO,
  }));

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <XAxis dataKey="format" tick={{ fontSize: 12 }} />
          <YAxis
            width={48}
            tick={{ fontSize: 12 }}
            tickFormatter={(value: number) => `${value}%`}
          />
          <Tooltip
            formatter={(value) => {
              const numeric = typeof value === "number" ? value : Number(value);
              const shown = Number.isFinite(numeric) ? `${numeric.toFixed(1)}%` : "n/a";
              return [shown, "Engagement"];
            }}
          />
          <Bar dataKey="engagement" radius={[4, 4, 0, 0]}>
            {rows.map((row) => (
              <Cell key={row.format} fill={row.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
