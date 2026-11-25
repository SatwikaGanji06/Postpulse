"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Papa from "papaparse";
import { parsePosts, computeStats, type RawRow } from "@/lib/analyze";

const MAX_BYTES = 2 * 1024 * 1024; // 2 MB
const REQUIRED = ["date", "format", "views"];

export default function Home() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    router.push("/results");
  }

  async function handleFile(file: File) {
    setError(null);
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setError("Please upload a .csv file.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("That file is larger than 2 MB. Please upload a smaller export.");
      return;
    }
    setLoading(true);
    try {
      processText(await file.text());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong reading that file.");
      setLoading(false);
    }
  }

  async function handleSample() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/sample.csv");
      if (!res.ok) throw new Error("Could not load the sample data.");
      processText(await res.text());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center px-4 py-12 text-center">
      <h1 className="text-4xl font-bold text-gray-900 sm:text-5xl">PostPulse</h1>
      <p className="mt-3 text-lg text-gray-600">
        Find out why your posts flop, and what to post next week.
      </p>

      <div className="mt-8 flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
            e.target.value = ""; // allow re-uploading the same file
          }}
        />
        <button
          onClick={() => fileRef.current?.click()}
          disabled={loading}
          className="rounded-lg bg-indigo-600 px-6 py-3 font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {loading ? "Analyzing..." : "Upload CSV"}
        </button>
        <button
          onClick={handleSample}
          disabled={loading}
          className="rounded-lg border border-gray-300 px-6 py-3 font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-50"
        >
          {loading ? "Analyzing..." : "Try sample data"}
        </button>
      </div>

      {error && (
        <p role="alert" className="mt-4 text-sm text-red-600">
          {error}
        </p>
      )}

      <details className="mt-8 w-full rounded-lg border border-gray-200 p-4 text-left text-sm text-gray-700">
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

      <p className="mt-6 text-xs text-gray-500">
        Your raw data stays in your browser. Only summary stats are sent to the AI.
      </p>
    </main>
  );
}