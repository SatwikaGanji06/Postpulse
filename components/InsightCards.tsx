import type { Insights } from "@/app/api/insights/route";

const ACCENTS = {
  green: "border-l-green-500",
  amber: "border-l-amber-500",
  indigo: "border-l-indigo-500",
  gray: "border-l-gray-400",
} as const;

const TITLES = {
  green: "text-green-800",
  amber: "text-amber-800",
  indigo: "text-indigo-800",
  gray: "text-gray-700",
} as const;

export default function InsightCards({ insights }: { insights: Insights }) {
  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <p className="text-sm leading-6 text-gray-800">{insights.summary}</p>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <Card title="What's working" items={insights.working} accent="green" />
        <Card title="What's not" items={insights.notWorking} accent="amber" />
      </div>

      <section className={`rounded-lg border border-gray-200 border-l-4 bg-white p-4 shadow-sm ${ACCENTS.indigo}`}>
        <h3 className={`font-semibold ${TITLES.indigo}`}>Next week's plan</h3>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-gray-700">
          {insights.plan.map((item, index) => (
            <li key={`${item.day}-${index}`} className="pl-1">
              <span className="font-bold text-gray-900">{item.day}:</span> {item.idea}
            </li>
          ))}
        </ol>
      </section>

      <section className={`rounded-lg border border-gray-200 border-l-4 bg-white p-4 shadow-sm ${ACCENTS.gray}`}>
        <h3 className={`font-semibold ${TITLES.gray}`}>Caption tips</h3>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-gray-700">
          {insights.captionTips.map((tip) => (
            <li key={tip}>{tip}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Card({
  title,
  items,
  accent,
}: {
  title: string;
  items: string[];
  accent: "green" | "amber";
}) {
  return (
    <section className={`rounded-lg border border-gray-200 border-l-4 bg-white p-4 shadow-sm ${ACCENTS[accent]}`}>
      <h3 className={`font-semibold ${TITLES[accent]}`}>{title}</h3>
      <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-gray-700">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}
