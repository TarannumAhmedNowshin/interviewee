"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import SiteHeader from "../../components/SiteHeader";
import {
  getProgress,
  listProblems,
  type ProblemProgress,
  type ProblemSummary,
} from "../../lib/arena";

const DIFF: Record<string, string> = {
  easy: "text-emerald-400",
  medium: "text-amber-400",
  hard: "text-rose-400",
};

export default function ArenaList() {
  const [problems, setProblems] = useState<ProblemSummary[]>([]);
  const [progress, setProgress] = useState<Record<string, ProblemProgress>>({});
  const [error, setError] = useState(false);

  useEffect(() => {
    listProblems()
      .then(setProblems)
      .catch(() => setError(true));
    getProgress().then(setProgress);
  }, []);

  const dueCount = Object.values(progress).filter((p) => p.due).length;

  return (
    <div className="min-h-screen bg-[#08080a] text-neutral-100">
      <SiteHeader />

      <main className="mx-auto max-w-4xl px-6 py-12">
        <div className="mb-8 flex items-end justify-between gap-6 border-b border-white/8 pb-6">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Coding Arena</h1>
            <p className="mt-1.5 text-sm text-neutral-500">
              Drill algorithm patterns — real execution, AI review, spaced repetition.
            </p>
          </div>
          {dueCount > 0 && (
            <span className="shrink-0 rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-300">
              {dueCount} due for review
            </span>
          )}
        </div>
        {error && <p className="text-rose-400">Couldn&apos;t reach the server. Is the backend running?</p>}
        <ul className="space-y-3">
          {problems.map((p) => (
            <li key={p.id}>
              <Link
                href={`/arena/${p.id}`}
                className="flex items-center justify-between rounded-xl border border-white/8 bg-white/2 px-5 py-4 transition hover:border-white/20 hover:bg-white/4"
              >
                <div>
                  <div className="font-medium text-neutral-100">{p.title}</div>
                  <div className="mt-1 flex gap-2 text-xs text-neutral-500">
                    {p.patterns.map((t) => (
                      <span key={t} className="rounded bg-neutral-800 px-2 py-0.5">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {progress[p.id]?.due ? (
                    <span className="rounded bg-amber-500/15 px-2 py-0.5 text-xs text-amber-300">
                      Review due
                    </span>
                  ) : progress[p.id]?.solved ? (
                    <span className="rounded bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-300">
                      Solved
                    </span>
                  ) : progress[p.id]?.attempts ? (
                    <span className="rounded bg-neutral-800 px-2 py-0.5 text-xs text-neutral-400">
                      Attempted
                    </span>
                  ) : null}
                  <span className={`text-sm font-medium capitalize ${DIFF[p.difficulty] ?? ""}`}>
                    {p.difficulty}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
