"use client";

import { useRef, useState, type DragEvent } from "react";
import { useRouter } from "next/navigation";
import Papa from "papaparse";
import { parsePosts, computeStats, type RawRow } from "@/lib/analyze";

const MAX_BYTES = 2 * 1024 * 1024; // 2 MB
const REQUIRED = ["date", "format", "views"];

type Busy = "upload" | "sample" | null;

const CHIPS = ["Best format", "Best time to post", "Next week's plan"];

export default function Home() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const busyRef = useRef<Busy>(null);
  const [loading, setLoading] = useState<Busy>(null);
  const [dragOver, setDragOver] = useState(false);
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
      throw new Error(`Missing required column(s): ${missing.join(", ")}.`);
    }

    const { posts, skipped } = parsePosts(parsed.data);
    if (posts.length === 0) {
      throw new Error(
        "No valid rows found. Check that dates, formats and views are filled in correctly."
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
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setError("Please upload a .csv file.");
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

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragOver(false);
    const file = event.dataTransfer.files?.[0];
    if (file) void handleFile(file);
  }

  const busy = loading !== null;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-indigo-50 to-white px-4 py-12 text-center">
      <div className="flex w-full max-w-xl flex-col items-center">
        <h1 className="text-5xl font-bold tracking-tight text-gray-900 sm:text-6xl">PostPulse</h1>
        <p className="mt-4 text-lg text-gray-600">
          Find out why your posts flop, and what to post next week.
        </p>

        <ul className="mt-5 flex flex-wrap items-center justify-center gap-2">
          {CHIPS.map((chip) => (
            <li
              key={chip}
              className="rounded-full border border-indigo-100 bg-white px-3 py-1 text-xs font-medium text-indigo-700 shadow-sm"
            >
              {chip}
            </li>
          ))}
        </ul>

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
          onClick={() => {
            if (!busy) fileRef.current?.click();
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              if (!busy) fileRef.current?.click();
            }
          }}
          onDragOver={handleDragOver}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={`mt-8 w-full rounded-xl border-2 border-dashed px-6 py-10 text-sm font-medium transition-colors ${
            busy ? "cursor-not-allowed opacity-60" : "cursor-pointer"
          } ${
            dragOver
              ? "border-indigo-500 bg-indigo-100 text-indigo-800"
              : "border-gray-300 bg-white/80 text-gray-600 hover:border-indigo-300 hover:bg-white"
          }`}
        >
          Drop your CSV here or click to browse
        </div>

        <div className="mt-4 flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={() => void handleSample()}
            disabled={busy}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-6 py-3 font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {loading === "sample" ? (
              <>
                <Spinner />
                Analyzing...
              </>
            ) : (
              "Try sample data"
            )}
          </button>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-6 py-3 font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-50"
          >
            {loading === "upload" ? (
              <>
                <Spinner />
                Analyzing...
              </>
            ) : (
              "Upload CSV"
            )}
          </button>
        </div>

        {error && (
          <p
            role="alert"
            className="mt-4 w-full rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            {error}
          </p>
        )}

        <details className="mt-8 w-full rounded-lg border border-gray-200 bg-white p-4 text-left text-sm text-gray-700 shadow-sm">
          <summary className="cursor-pointer font-medium">Expected CSV format</summary>
          <p className="mt-2">
            Columns: <code>date, format, caption, views, likes, comments, shares, saves</code>
          </p>
          <p className="mt-2">
            Required: <code>date</code>, <code>format</code>, <code>views</code>. Dates can be{" "}
            <code>2026-10-14</code> or <code>2026-10-14T19:30</code> (a time is needed for the
            best-hour stat).
          </p>
        </details>

        <p className="mt-6 inline-flex items-center gap-1.5 text-xs text-gray-500">
          <svg
            viewBox="0 0 24 24"
            className="h-3.5 w-3.5 shrink-0"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect x="5" y="11" width="14" height="9" rx="2" />
            <path d="M8 11V8a4 4 0 0 1 8 0v3" />
          </svg>
          Your raw data stays in your browser. Only summary stats are sent to the AI.
        </p>
      </div>
    </main>
  );
}

function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}
