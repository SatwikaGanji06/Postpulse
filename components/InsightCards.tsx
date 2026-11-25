import type { Insights } from "@/app/api/insights/route";

export default function InsightCards({ insights }: { insights: Insights }) {
  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-gray-200 bg-white p-4">
        <p className="text-sm leading-6 text-gray-800">{insights.summary}</p>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <Card title="What's working" items={insights.working} />
        <Card title="What's not" items={insights.notWorking} />
      </div>

      <section className="rounded-lg border border-gray-200 bg-white p-4">
        <h3 className="font-semibold text-gray-900">Next week's plan</h3>
        <ul className="mt-3 space-y-2 text-sm text-gray-700">
          {insights.plan.map((item, index) => (
            <li key={`${item.day}-${index}`}>
              <span className="font-medium text-gray-900">{item.day}:</span> {item.idea}
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-4">
        <h3 className="font-semibold text-gray-900">Caption tips</h3>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-gray-700">
          {insights.captionTips.map((tip) => (
            <li key={tip}>{tip}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Card({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4">
      <h3 className="font-semibold text-gray-900">{title}</h3>
      <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-gray-700">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}
