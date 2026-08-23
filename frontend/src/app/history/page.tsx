"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import SiteHeader from "../../components/SiteHeader";
import { listBehavioralSessions } from "../../lib/behavioral";
import { listMockSessions } from "../../lib/mock";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface UnifiedRow {
  key: string;
  type: string;
  typeClass: string;
  title: string;
  meta: string;
  started_at: string | null;
  status: string;
  overall_score: number | null;
  href: string;
}

interface RawSession {
  id: string;
  status: string;
  started_at: string | null;
  overall_score: number | null;
  problem?: string;
}

const TYPE_CLASS: Record<string, string> = {
  "System Design": "bg-sky-500/15 text-sky-300",
  "Mock Coding": "bg-violet-500/15 text-violet-300",
  Behavioral: "bg-amber-500/15 text-amber-300",
};

function startedMs(s: string | null): number {
  return s ? new Date(s).getTime() : 0;
}

export default function History() {
  const [rows, setRows] = useState<UnifiedRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      let hadError = false;
      const sd: RawSession[] = await fetch(`${API_BASE}/sessions`)
        .then((r) => (r.ok ? r.json() : []))
        .catch(() => {
          hadError = true;
          return [];
        });
      const [mock, beh] = await Promise.all([listMockSessions(), listBehavioralSessions()]);
      if (cancelled) return;

      const merged: UnifiedRow[] = [
        ...sd.map((r) => ({
          key: `sd-${r.id}`,
          type: "System Design",
          typeClass: TYPE_CLASS["System Design"],
          title: r.problem ?? "Untitled",
          meta: "",
          started_at: r.started_at,
          status: r.status,
          overall_score: r.overall_score,
          href: `/replay/${r.id}`,
        })),
        ...mock.map((r) => ({
          key: `mock-${r.id}`,
          type: "Mock Coding",
          typeClass: TYPE_CLASS["Mock Coding"],
          title: r.problem_title,
          meta: r.language,
          started_at: r.started_at,
          status: r.status,
          overall_score: r.overall_score,
          href: `/mock/replay/${r.id}`,
        })),
        ...beh.map((r) => ({
          key: `beh-${r.id}`,
          type: "Behavioral",
          typeClass: TYPE_CLASS["Behavioral"],
          title: r.question_title,
          meta: r.category,
          started_at: r.started_at,
          status: r.status,
          overall_score: r.overall_score,
          href: `/behavioral/replay/${r.id}`,
        })),
      ].sort((a, b) => startedMs(b.started_at) - startedMs(a.started_at));

      setRows(merged);
      setError(hadError && merged.length === 0);
      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#08080a] text-neutral-100">
      <SiteHeader
        actions={
          <Link
            href="/design"
            className="rounded-md bg-neutral-100 px-4 py-1.5 text-sm font-semibold text-neutral-950 transition hover:bg-white"
          >
            New session
          </Link>
        }
      />

      <div className="mx-auto max-w-4xl px-6 py-12">
        <div className="mb-8 border-b border-white/8 pb-6">
          <h1 className="text-2xl font-semibold tracking-tight">Past interviews</h1>
          <p className="mt-1.5 text-sm text-neutral-500">
            Every round across all four practice modes.
          </p>
        </div>
        {loading ? (
          <p className="text-neutral-500">Loading…</p>
        ) : error ? (
          <p className="text-rose-400">Couldn&apos;t reach the server. Is the backend running?</p>
        ) : rows.length === 0 ? (
          <p className="text-neutral-500">No interviews yet. Start one and it&apos;ll show up here.</p>
        ) : (
          <ul className="space-y-3">
            {rows.map((r) => (
              <li key={r.key}>
                <Link
                  href={r.href}
                  className="flex items-center justify-between rounded-lg border border-white/8 bg-white/2 px-5 py-4 transition hover:border-white/20 hover:bg-white/4"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`shrink-0 rounded px-2 py-0.5 text-xs font-medium ${r.typeClass}`}>
                        {r.type}
                      </span>
                      <p className="truncate font-medium text-neutral-100">{r.title}</p>
                    </div>
                    <p className="mt-1 text-xs text-neutral-500">
                      {r.started_at ? new Date(r.started_at).toLocaleString() : "—"}
                      {r.meta ? ` · ${r.meta}` : ""} · {r.status}
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
