"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import SiteHeader from "../../../components/SiteHeader";
import { getPlan, type PlanDetail, type PlanItem } from "../../../lib/prep";

type Accent = {
  num: string;
  bar: string;
  ring: string;
  chip: string;
};

const ACCENTS: Record<string, Accent> = {
  sky: {
    num: "text-sky-400/50",
    bar: "bg-sky-400",
    ring: "hover:border-sky-400/40",
    chip: "border-sky-400/30 text-sky-200",
  },
  emerald: {
    num: "text-emerald-400/50",
    bar: "bg-emerald-400",
    ring: "hover:border-emerald-400/40",
    chip: "border-emerald-400/30 text-emerald-200",
  },
  violet: {
    num: "text-violet-400/50",
    bar: "bg-violet-400",
    ring: "hover:border-violet-400/40",
    chip: "border-violet-400/30 text-violet-200",
  },
  amber: {
    num: "text-amber-400/50",
    bar: "bg-amber-400",
    ring: "hover:border-amber-400/40",
    chip: "border-amber-400/30 text-amber-200",
  },
};

function PillarCard({
  index,
  round,
  accent,
  children,
}: {
  index: string;
  round: string;
  accent: Accent;
  children: ReactNode;
}) {
  return (
    <section className="relative overflow-hidden rounded-2xl border border-white/8 bg-white/2 p-6">
      <span
        aria-hidden
        className={`absolute top-5 right-6 font-mono text-4xl font-semibold tabular-nums ${accent.num}`}
      >
        {index}
      </span>
      <span
        aria-hidden
        className={`absolute top-6 left-0 h-8 w-1 rounded-r-full opacity-70 ${accent.bar}`}
      />
      <h2 className="text-lg font-semibold tracking-tight text-neutral-50">{round}</h2>
      <div className="mt-4 space-y-3">{children}</div>
    </section>
  );
}

function ItemRow({
  item,
  href,
  accent,
  meta,
}: {
  item: PlanItem;
  href: string;
  accent: Accent;
  meta?: string;
}) {
  return (
    <Link
      href={href}
      className={`group flex items-start justify-between gap-4 rounded-xl border border-white/8 bg-white/2 px-4 py-3 transition hover:bg-white/4 ${accent.ring}`}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-neutral-100">{item.title}</span>
          {meta && (
            <span className={`rounded-full border px-2 py-0.5 text-[11px] capitalize ${accent.chip}`}>
              {meta}
            </span>
          )}
        </div>
        {item.reason && (
          <p className="mt-1 text-sm leading-relaxed text-neutral-400">{item.reason}</p>
        )}
      </div>
      <span className="mt-0.5 shrink-0 text-sm font-medium text-neutral-500 transition group-hover:text-neutral-200">
        Start →
      </span>
    </Link>
  );
}

export default function PrepPlanView() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<PlanDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getPlan(id)
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#08080a] text-neutral-100">
        <SiteHeader />
        <main className="mx-auto max-w-4xl px-6 py-12 text-neutral-500">Loading your plan…</main>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-[#08080a] text-neutral-100">
        <SiteHeader />
        <main className="mx-auto max-w-4xl px-6 py-12">
          <p className="text-rose-400">Couldn&apos;t load this plan.</p>
          <Link href="/prep" className="mt-4 inline-block text-sm text-neutral-400 hover:text-neutral-100">
            ← Back to prep
          </Link>
        </main>
      </div>
    );
  }

  const { plan } = data;

  return (
    <div className="min-h-screen bg-[#08080a] text-neutral-100">
      <SiteHeader />

      <main className="mx-auto max-w-4xl px-6 py-12">
        <div className="border-b border-white/8 pb-6">
          <Link href="/prep" className="text-sm text-neutral-500 transition hover:text-neutral-300">
            ← All plans
          </Link>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight">
            {data.title || "Interview prep plan"}
          </h1>
          {plan.role_summary && (
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-neutral-400">
              {plan.role_summary}
            </p>
          )}
        </div>

        {(plan.focus_areas.length > 0 || plan.gaps.length > 0) && (
          <div className="mt-8 grid gap-6 md:grid-cols-2">
            {plan.focus_areas.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-neutral-300">What this role emphasizes</h2>
                <div className="mt-3 flex flex-wrap gap-2">
                  {plan.focus_areas.map((f) => (
                    <span
                      key={f}
                      className="rounded-full border border-white/10 bg-white/2 px-3 py-1 text-xs text-neutral-300"
                    >
                      {f}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {plan.gaps.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-neutral-300">Gaps to shore up</h2>
                <ul className="mt-3 space-y-1.5">
                  {plan.gaps.map((g) => (
                    <li key={g} className="flex gap-2 text-sm text-neutral-400">
                      <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-neutral-600" />
                      {g}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <h2 className="mt-12 mb-4 text-sm font-semibold tracking-tight text-neutral-300">
          Your four rounds, tailored
        </h2>
        <div className="grid gap-4">
          <PillarCard index="01" round="System Design" accent={ACCENTS.sky}>
            <ItemRow
              item={plan.system_design}
              href={`/design?problem=${plan.system_design.id}`}
              accent={ACCENTS.sky}
            />
          </PillarCard>

          <PillarCard index="02" round="Coding Arena" accent={ACCENTS.emerald}>
            {plan.coding.map((item) => (
              <ItemRow
                key={item.id}
                item={item}
                href={`/arena/${item.id}`}
                accent={ACCENTS.emerald}
                meta={item.difficulty}
              />
            ))}
          </PillarCard>

          <PillarCard index="03" round="Mock Coding" accent={ACCENTS.violet}>
            <ItemRow
              item={plan.mock}
              href={`/mock/${plan.mock.id}`}
              accent={ACCENTS.violet}
              meta={plan.mock.difficulty}
            />
          </PillarCard>

          <PillarCard index="04" round="Behavioral" accent={ACCENTS.amber}>
            {plan.behavioral.map((item) => (
              <ItemRow
                key={item.id}
                item={item}
                href={`/behavioral/${item.id}`}
                accent={ACCENTS.amber}
                meta={item.category}
              />
            ))}
          </PillarCard>
        </div>

        {plan.closing_advice && (
          <div className="mt-8 rounded-2xl border border-white/8 bg-white/2 p-6">
            <h2 className="text-sm font-semibold text-neutral-300">Coach&apos;s note</h2>
            <p className="mt-2 text-sm leading-relaxed text-neutral-400">{plan.closing_advice}</p>
          </div>
        )}
      </main>
    </div>
  );
}
