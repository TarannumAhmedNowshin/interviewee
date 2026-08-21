"use client";

import type { Feedback } from "../lib/useInterview";

function scoreColor(score: number): string {
  if (score >= 4) return "bg-emerald-500";
  if (score >= 3) return "bg-amber-500";
  return "bg-rose-500";
}

export default function FeedbackReport({
  report,
  onClose,
}: {
  report: Feedback;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6">
      <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-neutral-800 bg-neutral-950 p-8 shadow-2xl">
        <div className="flex items-start justify-between gap-6">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Interview debrief</h2>
            <p className="mt-2 leading-relaxed text-neutral-400">{report.summary}</p>
          </div>
          <div className="shrink-0 text-right">
            <div className="text-4xl font-bold text-emerald-400">
              {(report.overall_score ?? 0).toFixed(1)}
            </div>
            <div className="text-xs text-neutral-500">out of 5</div>
          </div>
        </div>

        <div className="mt-8 space-y-4">
          {(report.dimensions ?? []).map((d) => (
            <div key={d.name}>
              <div className="flex items-center justify-between text-sm">
                <span className="text-neutral-200">{d.name}</span>
                <span className="font-mono text-neutral-400">{d.score}/5</span>
              </div>
              <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded bg-neutral-800">
                <div
                  className={`h-full rounded ${scoreColor(d.score)}`}
                  style={{ width: `${((d.score ?? 0) / 5) * 100}%` }}
                />
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-neutral-500">{d.comment}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 grid gap-6 sm:grid-cols-2">
          <div>
            <h3 className="mb-2 text-sm font-semibold text-emerald-400">Strengths</h3>
            <ul className="space-y-1.5 text-sm text-neutral-300">
              {(report.strengths ?? []).map((s, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-emerald-500">+</span>
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="mb-2 text-sm font-semibold text-amber-400">To improve</h3>
            <ul className="space-y-1.5 text-sm text-neutral-300">
              {(report.improvements ?? []).map((s, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-amber-500">→</span>
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-8 flex justify-end">
          <button
            onClick={onClose}
            className="rounded-md bg-neutral-800 px-4 py-2 text-sm font-medium hover:bg-neutral-700"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
