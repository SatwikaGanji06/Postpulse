"use client";

import { useRef, useState, type DragEvent } from "react";
import { useRouter } from "next/navigation";
import Papa from "papaparse";
import { parsePosts, computeStats, type RawRow } from "@/lib/analyze";
import { Icon, Logo, Spinner, type IconName } from "@/components/ui";

const MAX_BYTES = 2 * 1024 * 1024; // 2 MB
const REQUIRED = ["date", "format", "views"];

type Busy = "upload" | "sample" | null;

const STEPS: { icon: IconName; title: string; body: string }[] = [
  {
    icon: "upload",
    title: "Upload",
    body: "Drop in your post analytics as a CSV, or try the one-click sample data.",
  },
  {
    icon: "chart",
    title: "Analyze",
    body: "Engagement by format, best hour and weekday, top and bottom posts, 30-day trend.",
  },
  {
    icon: "sparkle",
    title: "Plan",
    body: "AI turns the stats into plain-English advice and a specific plan for the week.",
  },
];

const PRIVACY_FLOW: { title: string; body: string; local: boolean }[] = [
  { title: "Parse", body: "Your CSV is read locally", local: true },
  { title: "Compute", body: "Engagement, best hour, trends", local: true },
  { title: "Send", body: "Stats and top-post summaries", local: false },
  { title: "Plan", body: "Insights as cards and charts", local: false },
];

const COLUMNS: { name: string; example: string; required?: boolean }[] = [
  { name: "date", example: "2026-10-14T19:30", required: true },
  { name: "format", example: "reel", required: true },
  { name: "views", example: "3200", required: true },
  { name: "caption", example: "My morning routine" },
  { name: "likes", example: "210" },
  { name: "comments", example: "14" },
  { name: "shares", example: "9" },
  { name: "saves", example: "31" },
];

export default function Home() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const busyRef = useRef<Busy>(null);
  const [loading, setLoading] = useState<Busy>(null);
  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function setBusy(next: Busy) {
    busyRef.current = next;
    setLoading(next);
  }

  // Parse CSV text -> stats -> sessionStorage -> /results
  function processText(text: string) {
    if (!text.trim()) throw new Error("That file is empty.");

    const parsed = Papa.parse<RawRow>(text, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim().toLowerCase(),
    });

    const fields = parsed.meta.fields ?? [];
    const missing = REQUIRED.filter((c) => !fields.includes(c));
    if (missing.length > 0) {
      throw new Error(
        `Missing required column${missing.length > 1 ? "s" : ""}: ${missing.join(", ")}. Check the expected format below.`
      );
    }

    const { posts, skipped } = parsePosts(parsed.data);
    if (posts.length === 0) {
      throw new Error(
        "No valid rows found. Check that dates (YYYY-MM-DD), formats and views are filled in correctly."
      );
    }

    const stats = computeStats(posts);
    sessionStorage.setItem("postpulse:stats", JSON.stringify(stats));
    sessionStorage.setItem("postpulse:skipped", String(skipped));
    sessionStorage.removeItem("postpulse:insights");
    sessionStorage.removeItem("postpulse:source");
    router.push("/results");
  }

  async function handleFile(file: File) {
    if (busyRef.current) return;
    setError(null);
    setFileName(file.name);
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setError("Please upload a .csv file. Most platforms let you export analytics as CSV.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("That file is larger than 2 MB. Please upload a smaller export.");
      return;
    }
    setBusy("upload");
    try {
      processText(await file.text());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong reading that file.");
      setBusy(null);
    }
  }

  async function handleSample() {
    if (busyRef.current) return;
    setError(null);
    setFileName(null);
    setBusy("sample");
    try {
      const res = await fetch("/sample.csv");
      if (!res.ok) throw new Error("Could not load the sample data.");
      processText(await res.text());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setBusy(null);
    }
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    if (!busyRef.current) setDragOver(true);
  }

  function handleDragLeave(event: DragEvent<HTMLDivElement>) {
    // Ignore leave events fired when moving over child elements.
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
    setDragOver(false);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragOver(false);
    const file = event.dataTransfer.files?.[0];
    if (file) void handleFile(file);
  }

  function openPicker() {
    if (!busyRef.current) fileRef.current?.click();
  }

  const busy = loading !== null;

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Soft brand glow behind the hero */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 -top-40 -z-10 mx-auto h-[36rem] max-w-5xl rounded-full bg-gradient-to-br from-brand-light/50 via-brand-violet/20 to-transparent blur-3xl"
      />

      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
        <Logo />
        <nav className="flex items-center gap-1 text-sm font-medium text-ink-soft">
          <a href="#how" className="hidden rounded-lg px-3 py-2 hover:bg-white hover:text-ink sm:inline-block">
            How it works
          </a>
          <a href="#privacy" className="hidden rounded-lg px-3 py-2 hover:bg-white hover:text-ink sm:inline-block">
            Privacy
          </a>
          <a href="#format" className="rounded-lg px-3 py-2 hover:bg-white hover:text-ink">
            CSV format
          </a>
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
        {/* Hero + upload */}
        <section className="grid items-center gap-10 pt-6 lg:grid-cols-[1.05fr_1fr] lg:pt-14">
          <div className="animate-fade-up text-center lg:text-left">
            <p className="inline-flex items-center gap-2 rounded-full border border-line bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-brand">
              <Icon name="sparkle" className="h-3.5 w-3.5" />
              Analytics for small creators
            </p>
            <h1 className="mt-5 text-4xl font-extrabold leading-[1.08] tracking-tight text-ink sm:text-5xl lg:text-6xl">
              Find out why your posts flop, and{" "}
              <span className="bg-gradient-to-r from-brand to-brand-violet bg-clip-text text-transparent">
                what to post next week.
              </span>
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-ink-soft lg:mx-0">
              Upload your post analytics and get your best format, hour and weekday, plus a
              plain-English plan for the week ahead. Free, in seconds.
            </p>
            <ul className="mt-6 flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm text-ink-soft lg:justify-start">
              {["No sign-up", "CSV stays in your browser", "Built for 500–20k followers"].map((item) => (
                <li key={item} className="inline-flex items-center gap-1.5">
                  <Icon name="check" className="h-4 w-4 text-mint-dark" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="animate-fade-up rounded-3xl border border-line bg-white/90 p-5 shadow-card backdrop-blur sm:p-6 [animation-delay:80ms]">
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleFile(f);
                e.target.value = ""; // allow re-uploading the same file
              }}
            />

            <div
              role="button"
              tabIndex={busy ? -1 : 0}
              aria-disabled={busy}
              aria-label="Upload a CSV file. Drop a file here or press Enter to browse."
              onClick={openPicker}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  openPicker();
                }
              }}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`group flex flex-col items-center rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-all ${
                busy ? "cursor-wait opacity-70" : "cursor-pointer"
              } ${
                dragOver
                  ? "scale-[1.01] border-brand bg-brand/5"
                  : "border-line bg-mist/60 hover:border-brand-light hover:bg-brand/[0.03]"
              }`}
            >
              <span
                className={`inline-flex h-14 w-14 items-center justify-center rounded-2xl transition-colors ${
                  dragOver ? "bg-brand text-white" : "bg-white text-brand shadow-card group-hover:bg-brand group-hover:text-white"
                }`}
              >
                {loading === "upload" ? <Spinner className="h-6 w-6" /> : <Icon name="upload" className="h-6 w-6" />}
              </span>
              <p className="mt-4 text-base font-semibold text-ink">
                {loading === "upload"
                  ? "Crunching your numbers…"
                  : dragOver
                    ? "Release to analyze"
                    : "Drop your CSV here"}
              </p>
              <p className="mt-1 text-sm text-ink-soft">
                {fileName && !error && loading === "upload" ? (
                  <span className="inline-flex items-center gap-1.5">
                    <Icon name="file" className="h-3.5 w-3.5" />
                    {fileName}
                  </span>
                ) : (
                  <>
                    or <span className="font-semibold text-brand underline-offset-2 group-hover:underline">browse files</span> · up to 2 MB
                  </>
                )}
              </p>
            </div>

            <div className="my-5 flex items-center gap-3 text-xs font-medium uppercase tracking-wider text-ink-soft/70">
              <span className="h-px flex-1 bg-line" />
              no data handy?
              <span className="h-px flex-1 bg-line" />
            </div>

            <button
              type="button"
              onClick={() => void handleSample()}
              disabled={busy}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand to-brand-violet px-6 py-3.5 font-semibold text-white shadow-lift transition hover:brightness-110 active:scale-[0.99] disabled:cursor-wait disabled:opacity-60"
            >
              {loading === "sample" ? (
                <>
                  <Spinner />
                  Analyzing 75 sample posts…
                </>
              ) : (
                <>
                  Try sample data
                  <Icon name="arrowRight" />
                </>
              )}
            </button>

            {error && (
              <div
                role="alert"
                className="mt-4 flex items-start gap-2.5 rounded-xl border border-coral/30 bg-coral/10 px-4 py-3 text-sm text-coral-dark"
              >
                <Icon name="alert" className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  {fileName ? <p className="font-semibold">{fileName}</p> : null}
                  <p>{error}</p>
                </div>
              </div>
            )}

            <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-ink-soft">
              <Icon name="lock" className="h-3.5 w-3.5" />
              Your raw data stays in your browser.
            </p>
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="scroll-mt-8 pt-24">
          <SectionHeading eyebrow="How it works" title="Upload a CSV. Get next week's plan." />
          <ol className="mt-10 grid gap-4 md:grid-cols-3">
            {STEPS.map((step, index) => (
              <li key={step.title} className="relative rounded-2xl border border-line bg-white p-6 shadow-card">
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-brand/10 text-brand">
                    <Icon name={step.icon} className="h-5 w-5" />
                  </span>
                  <span className="text-xs font-bold uppercase tracking-wider text-ink-soft/70">Step {index + 1}</span>
                </div>
                <h3 className="mt-4 text-lg font-bold text-ink">{step.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{step.body}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* Privacy flow */}
        <section id="privacy" className="scroll-mt-8 pt-24">
          <SectionHeading eyebrow="Privacy" title="Your CSV stays in your browser" />
          <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {PRIVACY_FLOW.map((step, index) => (
              <div
                key={step.title}
                className={`rounded-2xl border p-5 ${
                  step.local ? "border-mint/40 bg-mint/[0.07]" : "border-brand/25 bg-brand/[0.05]"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-white ${
                      step.local ? "bg-mint-dark" : "bg-brand"
                    }`}
                  >
                    {index + 1}
                  </span>
                  <span
                    className={`text-[11px] font-bold uppercase tracking-wider ${
                      step.local ? "text-mint-dark" : "text-brand"
                    }`}
                  >
                    {step.local ? "Your browser" : "AI model"}
                  </span>
                </div>
                <p className="mt-3 font-bold text-ink">{step.title}</p>
                <p className="text-sm text-ink-soft">{step.body}</p>
              </div>
            ))}
          </div>
          <p className="mt-5 text-center text-sm text-ink-soft">
            Only stats and top-post summaries go to the AI, never the full file.
          </p>
        </section>

        {/* CSV format */}
        <section id="format" className="scroll-mt-8 pt-24">
          <SectionHeading eyebrow="CSV format" title="What your file should look like" />
          <div className="mx-auto mt-10 max-w-3xl overflow-hidden rounded-2xl border border-line bg-white shadow-card">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-mist text-xs uppercase tracking-wider text-ink-soft">
                  <tr>
                    <th scope="col" className="px-5 py-3 font-semibold">Column</th>
                    <th scope="col" className="px-5 py-3 font-semibold">Example</th>
                    <th scope="col" className="px-5 py-3 font-semibold">Required</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {COLUMNS.map((col) => (
                    <tr key={col.name}>
                      <td className="px-5 py-2.5 font-mono text-[13px] font-semibold text-ink">{col.name}</td>
                      <td className="px-5 py-2.5 font-mono text-[13px] text-ink-soft">{col.example}</td>
                      <td className="px-5 py-2.5">
                        {col.required ? (
                          <span className="rounded-full bg-brand/10 px-2 py-0.5 text-xs font-semibold text-brand">Required</span>
                        ) : (
                          <span className="text-xs text-ink-soft/70">Optional</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-col gap-3 border-t border-line bg-mist/50 px-5 py-4 text-sm text-ink-soft sm:flex-row sm:items-center sm:justify-between">
              <p>
                Add a time (<code className="font-mono text-[13px]">T19:30</code>) to unlock the best-hour stat. Headers are
                case-insensitive.
              </p>
              <a
                href="/sample.csv"
                download="postpulse-template.csv"
                className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg border border-line bg-white px-3 py-2 font-semibold text-ink hover:border-brand-light hover:text-brand"
              >
                <Icon name="download" />
                Download template
              </a>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-line bg-white/60">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-6 text-sm text-ink-soft sm:flex-row sm:px-6">
          <Logo />
          <p>Free weekly report · Premium calendar &amp; captions coming soon</p>
        </div>
      </footer>
    </div>
  );
}

function SectionHeading({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="text-center">
      <p className="text-xs font-bold uppercase tracking-wider text-brand">{eyebrow}</p>
      <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">{title}</h2>
    </div>
  );
}
