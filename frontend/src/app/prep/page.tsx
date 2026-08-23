"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import SiteHeader from "../../components/SiteHeader";
import { createPlan, listPlans, type PlanSummary } from "../../lib/prep";

export default function PrepLobby() {
  const router = useRouter();
  const [role, setRole] = useState("");
  const [jd, setJd] = useState("");
  const [cv, setCv] = useState("");
  const [building, setBuilding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [plans, setPlans] = useState<PlanSummary[]>([]);

  useEffect(() => {
    listPlans().then(setPlans);
  }, []);

  const ready = jd.trim().length > 0 && cv.trim().length > 0 && !building;

  async function handleBuild() {
    if (!ready) return;
    setBuilding(true);
    setError(null);
    try {
      const res = await createPlan(jd.trim(), cv.trim(), role.trim());
      router.push(`/prep/${res.id}`);
    } catch {
      setError("Couldn't build your plan. Is the backend running?");
      setBuilding(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#08080a] text-neutral-100">
      <SiteHeader />

      <main className="mx-auto max-w-3xl px-6 py-12">
        <div className="border-b border-white/8 pb-6">
          <h1 className="text-2xl font-semibold tracking-tight">Build your prep plan</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-neutral-400">
            Paste a target job description and your CV. An AI coach reads both, finds the gaps, and
            turns all four practice rounds into one personalized track for that specific role.
          </p>
        </div>

        <div className="mt-8 space-y-6">
          <label className="block">
            <span className="text-sm font-medium text-neutral-300">Target role</span>
            <span className="ml-2 text-xs text-neutral-600">optional</span>
            <input
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="e.g. Senior Backend Engineer, Payments"
              className="mt-2 w-full rounded-lg border border-white/10 bg-white/2 px-4 py-2.5 text-sm text-neutral-100 placeholder:text-neutral-600 focus:border-sky-400/50 focus:outline-none"
            />
          </label>

          <div className="grid gap-6 md:grid-cols-2">
            <label className="block">
              <span className="text-sm font-medium text-neutral-300">Job description</span>
              <textarea
                value={jd}
                onChange={(e) => setJd(e.target.value)}
                placeholder="Paste the full JD — required skills, stack, seniority, domain…"
                rows={14}
                className="mt-2 w-full resize-y rounded-lg border border-white/10 bg-white/2 px-4 py-3 font-mono text-xs leading-relaxed text-neutral-100 placeholder:text-neutral-600 focus:border-sky-400/50 focus:outline-none"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-neutral-300">Your CV / resume</span>
              <textarea
                value={cv}
                onChange={(e) => setCv(e.target.value)}
                placeholder="Paste your resume — experience, projects, strengths…"
                rows={14}
                className="mt-2 w-full resize-y rounded-lg border border-white/10 bg-white/2 px-4 py-3 font-mono text-xs leading-relaxed text-neutral-100 placeholder:text-neutral-600 focus:border-sky-400/50 focus:outline-none"
              />
            </label>
          </div>

          {error && <p className="text-sm text-rose-400">{error}</p>}

          <div className="flex items-center gap-4">
            <button
              onClick={handleBuild}
              disabled={!ready}
              className="rounded-lg bg-neutral-100 px-5 py-2.5 text-sm font-semibold text-neutral-950 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              {building ? "Analyzing your fit…" : "Build my plan"}
            </button>
            {building && (
              <span className="text-sm text-neutral-500">
                Reading the JD against your CV — this takes a few seconds.
              </span>
            )}
          </div>
        </div>

        {plans.length > 0 && (
          <>
            <h2 className="mt-14 mb-3 text-sm font-semibold text-neutral-400">Your plans</h2>
            <ul className="space-y-2">
              {plans.map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/prep/${p.id}`}
                    className="flex items-center justify-between rounded-lg border border-white/8 bg-white/2 px-5 py-3 transition hover:border-white/20 hover:bg-white/4"
                  >
                    <span className="truncate font-medium text-neutral-100">
                      {p.title || "Interview prep plan"}
                    </span>
                    <span className="ml-4 shrink-0 text-xs text-neutral-500">
                      {p.created_at ? new Date(p.created_at).toLocaleDateString() : "—"}
                    </span>
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
