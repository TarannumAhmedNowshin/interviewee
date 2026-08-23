"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import SiteHeader from "../../components/SiteHeader";
import {
  listMockProblems,
  listMockSessions,
  type MockProblemSummary,
  type MockSessionRow,
} from "../../lib/mock";

const DIFF: Record<string, string> = {
  easy: "text-emerald-400",
  medium: "text-amber-400",
  hard: "text-rose-400",
};

export default function MockLobby() {
  const [problems, setProblems] = useState<MockProblemSummary[]>([]);
  const [sessions, setSessions] = useState<MockSessionRow[]>([]);
  const [error, setError] = useState(false);

  useEffect(() => {
    listMockProblems()
      .then(setProblems)
      .catch(() => setError(true));
    listMockSessions().then(setSessions);
  }, []);

  return (
    <div className="min-h-screen bg-[#08080a] text-neutral-100">
      <SiteHeader />

      <main className="mx-auto max-w-4xl px-6 py-12">
        <div className="mb-8 border-b border-white/8 pb-6">
          <h1 className="text-2xl font-semibold tracking-tight">Mock Coding Interview</h1>
          <p className="mt-1.5 text-sm text-neutral-500">
            A timed, live round — a bare editor with an AI interviewer watching and probing.
          </p>
        </div>
        {error && (
          <p className="text-rose-400">Couldn&apos;t reach the server. Is the backend running?</p>
        )}

        <h2 className="mb-3 text-sm font-semibold text-neutral-400">Pick a problem</h2>
        <ul className="space-y-3">
          {problems.map((p) => (
            <li key={p.id}>
              <Link
                href={`/mock/${p.id}`}
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
                <span className={`text-sm font-medium capitalize ${DIFF[p.difficulty] ?? ""}`}>
                  {p.difficulty}
                </span>
              </Link>
            </li>
          ))}
        </ul>

        {sessions.length > 0 && (
          <>
            <h2 className="mt-10 mb-3 text-sm font-semibold text-neutral-400">Past rounds</h2>
            <ul className="space-y-2">
              {sessions.map((s) => (
                <li key={s.id}>
                  <Link
                    href={`/mock/replay/${s.id}`}
                    className="flex items-center justify-between rounded-lg border border-white/8 bg-white/2 px-5 py-3 transition hover:border-white/20 hover:bg-white/4"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-neutral-100">{s.problem_title}</p>
                      <p className="mt-0.5 text-xs text-neutral-500">
                        {s.started_at ? new Date(s.started_at).toLocaleString() : "—"} ·{" "}
                        {s.language} · {s.status}
                      </p>
                    </div>
                    <div className="ml-4 shrink-0 text-right">
                      {s.overall_score != null ? (
                        <span className="text-lg font-bold text-emerald-400">
                          {s.overall_score.toFixed(1)}
                        </span>
                      ) : (
                        <span className="text-sm text-neutral-600">—</span>
                      )}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </main>
    </div>
  );
}
