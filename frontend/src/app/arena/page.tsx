"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
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
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      <header className="flex items-center justify-between border-b border-neutral-800 px-6 py-4">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Coding Arena</h1>
          <p className="text-sm text-neutral-500">
            Practice by pattern — real execution, AI review
            {dueCount > 0 && (
              <span className="ml-2 rounded bg-amber-500/15 px-2 py-0.5 text-xs text-amber-300">
                {dueCount} due for review
              </span>
            )}
          </p>
        </div>
        <nav className="flex gap-4 text-sm text-neutral-400">
          <Link href="/" className="hover:text-neutral-100">
            Interview
          </Link>
          <Link href="/mock" className="hover:text-neutral-100">
            Mock
          </Link>
          <Link href="/behavioral" className="hover:text-neutral-100">
            Behavioral
          </Link>
          <Link href="/history" className="hover:text-neutral-100">
            History
          </Link>
        </nav>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-8">
        {error && <p className="text-rose-400">Couldn&apos;t reach the server. Is the backend running?</p>}
        <ul className="space-y-3">
          {problems.map((p) => (
            <li key={p.id}>
              <Link
                href={`/arena/${p.id}`}
                className="flex items-center justify-between rounded-xl border border-neutral-800 bg-neutral-900/50 px-5 py-4 transition hover:border-neutral-600 hover:bg-neutral-900"
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
