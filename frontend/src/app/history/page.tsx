"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface SessionRow {
  id: string;
  problem: string;
  status: string;
  stage: string;
  started_at: string | null;
  ended_at: string | null;
  overall_score: number | null;
}

export default function History() {
  const [rows, setRows] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE}/sessions`)
      .then((r) => r.json())
      .then((data) => setRows(Array.isArray(data) ? data : []))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      <header className="flex items-center justify-between border-b border-neutral-800 px-6 py-4">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Past interviews</h1>
          <p className="text-sm text-neutral-500">Your session history</p>
        </div>
        <nav className="flex items-center gap-4 text-sm text-neutral-400">
          <Link href="/arena" className="hover:text-neutral-100">
            Arena
          </Link>
          <Link href="/mock" className="hover:text-neutral-100">
            Mock
          </Link>
          <Link
            href="/"
            className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
          >
            New interview
          </Link>
        </nav>
      </header>

      <div className="mx-auto max-w-3xl px-6 py-8">
        {loading ? (
          <p className="text-neutral-500">Loading…</p>
        ) : error ? (
          <p className="text-rose-400">Couldn&apos;t reach the server. Is the backend running?</p>
        ) : rows.length === 0 ? (
          <p className="text-neutral-500">No interviews yet. Start one and it&apos;ll show up here.</p>
        ) : (
          <ul className="space-y-3">
            {rows.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/replay/${r.id}`}
                  className="flex items-center justify-between rounded-lg border border-neutral-800 bg-neutral-900 px-5 py-4 transition hover:border-neutral-600"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-neutral-100">{r.problem}</p>
                    <p className="mt-0.5 text-xs text-neutral-500">
                      {r.started_at ? new Date(r.started_at).toLocaleString() : "—"} · {r.status}
                    </p>
                  </div>
                  <div className="ml-4 shrink-0 text-right">
                    {r.overall_score != null ? (
                      <span className="text-lg font-bold text-emerald-400">
                        {r.overall_score.toFixed(1)}
                      </span>
                    ) : (
                      <span className="text-sm text-neutral-600">—</span>
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
