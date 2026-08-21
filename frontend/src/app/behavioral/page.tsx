"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  listBehavioralQuestions,
  listBehavioralSessions,
  type BehavioralQuestionSummary,
  type BehavioralSessionRow,
} from "../../lib/behavioral";

export default function BehavioralLobby() {
  const [questions, setQuestions] = useState<BehavioralQuestionSummary[]>([]);
  const [sessions, setSessions] = useState<BehavioralSessionRow[]>([]);
  const [error, setError] = useState(false);

  useEffect(() => {
    listBehavioralQuestions()
      .then(setQuestions)
      .catch(() => setError(true));
    listBehavioralSessions().then(setSessions);
  }, []);

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      <header className="flex items-center justify-between border-b border-neutral-800 px-6 py-4">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Behavioral Voice Round</h1>
          <p className="text-sm text-neutral-500">
            Speak your answer — an AI interviewer probes for a full STAR story and scores it
          </p>
        </div>
        <nav className="flex gap-4 text-sm text-neutral-400">
          <Link href="/" className="hover:text-neutral-100">
            Interview
          </Link>
          <Link href="/arena" className="hover:text-neutral-100">
            Arena
          </Link>
          <Link href="/mock" className="hover:text-neutral-100">
            Mock
          </Link>
          <Link href="/history" className="hover:text-neutral-100">
            History
          </Link>
        </nav>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-8">
        {error && (
          <p className="text-rose-400">Couldn&apos;t reach the server. Is the backend running?</p>
        )}

        <h2 className="mb-3 text-sm font-semibold text-neutral-400">Pick a question</h2>
        <ul className="space-y-3">
          {questions.map((q) => (
            <li key={q.id}>
              <Link
                href={`/behavioral/${q.id}`}
                className="flex items-center justify-between rounded-xl border border-neutral-800 bg-neutral-900/50 px-5 py-4 transition hover:border-neutral-600 hover:bg-neutral-900"
              >
                <div>
                  <div className="font-medium text-neutral-100">{q.title}</div>
                  <div className="mt-1 flex gap-2 text-xs text-neutral-500">
                    {q.tags.map((t) => (
                      <span key={t} className="rounded bg-neutral-800 px-2 py-0.5">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
                <span className="shrink-0 rounded bg-neutral-800 px-2 py-0.5 text-xs text-neutral-400">
                  {q.category}
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
                    href={`/behavioral/replay/${s.id}`}
                    className="flex items-center justify-between rounded-lg border border-neutral-800 bg-neutral-900 px-5 py-3 transition hover:border-neutral-600"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-neutral-100">{s.question_title}</p>
                      <p className="mt-0.5 text-xs text-neutral-500">
                        {s.started_at ? new Date(s.started_at).toLocaleString() : "—"} ·{" "}
                        {s.category} · {s.status}
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
