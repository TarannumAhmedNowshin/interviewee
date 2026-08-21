"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import type { Feedback } from "../../../lib/useInterview";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface TurnRow {
  idx: number;
  role: string;
  text: string;
  stage: string | null;
  move: string | null;
}

interface SessionDetail {
  id: string;
  problem: string;
  status: string;
  stage: string;
  diagram: string | null;
  report: Feedback | null;
  started_at: string | null;
  ended_at: string | null;
  turns: TurnRow[];
}

function scoreColor(score: number): string {
  if (score >= 4) return "bg-emerald-500";
  if (score >= 3) return "bg-amber-500";
  return "bg-rose-500";
}

export default function Replay({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<SessionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE}/sessions/${id}`)
      .then((r) => {
        if (!r.ok) throw new Error("not found");
        return r.json();
      })
      .then(setData)
      .catch(() => setMissing(true))
      .finally(() => setLoading(false));
  }, [id]);

  const report = data?.report;

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      <header className="flex items-center justify-between border-b border-neutral-800 px-6 py-4">
        <div className="min-w-0">
          <h1 className="truncate text-lg font-semibold tracking-tight">
            {data?.problem ?? "Replay"}
          </h1>
          <p className="text-sm text-neutral-500">Session replay</p>
        </div>
        <Link href="/history" className="shrink-0 text-sm text-neutral-400 hover:text-neutral-200">
          ← All interviews
        </Link>
      </header>

      <div className="mx-auto max-w-3xl px-6 py-8">
        {loading ? (
          <p className="text-neutral-500">Loading…</p>
        ) : missing || !data ? (
          <p className="text-neutral-500">Session not found.</p>
        ) : (
          <div className="space-y-8">
            {report && (
              <section className="rounded-2xl border border-neutral-800 bg-neutral-900 p-6">
                <div className="flex items-start justify-between gap-6">
                  <div>
                    <h2 className="text-lg font-semibold">Debrief</h2>
                    <p className="mt-1 text-sm leading-relaxed text-neutral-400">
                      {report.summary}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-3xl font-bold text-emerald-400">
                      {report.overall_score.toFixed(1)}
                    </div>
                    <div className="text-xs text-neutral-500">out of 5</div>
                  </div>
                </div>
                <div className="mt-5 space-y-3">
                  {report.dimensions?.map((d) => (
                    <div key={d.name}>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-neutral-200">{d.name}</span>
                        <span className="font-mono text-neutral-400">{d.score}/5</span>
                      </div>
                      <div className="mt-1 h-1.5 w-full overflow-hidden rounded bg-neutral-800">
                        <div
                          className={`h-full rounded ${scoreColor(d.score)}`}
                          style={{ width: `${(d.score / 5) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {data.diagram && (
              <section>
                <h2 className="mb-3 text-sm font-semibold text-neutral-400">Final whiteboard</h2>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`data:image/png;base64,${data.diagram}`}
                  alt="Whiteboard snapshot"
                  className="w-full rounded-lg border border-neutral-800 bg-white"
                />
              </section>
            )}

            <section>
              <h2 className="mb-3 text-sm font-semibold text-neutral-400">Transcript</h2>
              <div className="space-y-4">
                {data.turns.map((t) => (
                  <div
                    key={t.idx}
                    className={t.role === "user" ? "flex justify-end" : "flex justify-start"}
                  >
                    <div
                      className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                        t.role === "user"
                          ? "bg-neutral-800 text-neutral-100"
                          : "bg-neutral-900 ring-1 ring-neutral-800"
                      }`}
                    >
                      <div className="mb-1 text-xs text-neutral-500">
                        {t.role === "user" ? "You" : "Interviewer"}
                      </div>
                      <div className="whitespace-pre-wrap leading-relaxed">{t.text}</div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
