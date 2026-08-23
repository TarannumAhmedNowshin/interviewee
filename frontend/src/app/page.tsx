import Link from "next/link";
import SiteHeader from "../components/SiteHeader";

type Mode = {
  index: string;
  href: string;
  title: string;
  blurb: string;
  tags: string[];
  num: string;
  bar: string;
  ring: string;
  glow: string;
  arrow: string;
};

const MODES: Mode[] = [
  {
    index: "01",
    href: "/design",
    title: "System Design",
    blurb:
      "Whiteboard a large-scale system while an AI interviewer reads your diagram and presses on every trade-off you make.",
    tags: ["Whiteboard", "Voice", "Trade-offs"],
    num: "text-sky-400/50",
    bar: "bg-sky-400",
    ring: "hover:border-sky-400/40",
    glow: "hover:shadow-[0_28px_70px_-34px_rgba(56,189,248,0.55)]",
    arrow: "group-hover:text-sky-300",
  },
  {
    index: "02",
    href: "/arena",
    title: "Coding Arena",
    blurb:
      "Drill algorithm patterns with real code execution and an AI review. Spaced repetition resurfaces weak spots on schedule.",
    tags: ["Real execution", "AI review", "Spaced repetition"],
    num: "text-emerald-400/50",
    bar: "bg-emerald-400",
    ring: "hover:border-emerald-400/40",
    glow: "hover:shadow-[0_28px_70px_-34px_rgba(16,185,129,0.55)]",
    arrow: "group-hover:text-emerald-300",
  },
  {
    index: "03",
    href: "/mock",
    title: "Mock Coding",
    blurb:
      "A timed, live coding round in a bare editor. The interviewer watches your code as you type and probes your reasoning.",
    tags: ["Live editor", "25 min", "Follow-ups"],
    num: "text-violet-400/50",
    bar: "bg-violet-400",
    ring: "hover:border-violet-400/40",
    glow: "hover:shadow-[0_28px_70px_-34px_rgba(139,92,246,0.55)]",
    arrow: "group-hover:text-violet-300",
  },
  {
    index: "04",
    href: "/behavioral",
    title: "Behavioral",
    blurb:
      "Tell your story out loud. The interviewer probes for a complete STAR narrative and scores structure, ownership, and impact.",
    tags: ["Voice", "STAR method", "Scored"],
    num: "text-amber-400/50",
    bar: "bg-amber-400",
    ring: "hover:border-amber-400/40",
    glow: "hover:shadow-[0_28px_70px_-34px_rgba(245,158,11,0.55)]",
    arrow: "group-hover:text-amber-300",
  },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-[#08080a] text-neutral-100">
      <SiteHeader />

      <main className="relative">
        <div
          aria-hidden
          className="grid-lines mask-radial pointer-events-none absolute inset-x-0 top-0 h-135"
        />

        <div className="relative mx-auto max-w-6xl px-6">
          <section className="u-rise pt-20 pb-14 md:pt-28">
            <h1 className="max-w-3xl text-4xl leading-[1.05] font-semibold tracking-tight text-balance sm:text-5xl md:text-6xl">
              Every round of the technical interview, rehearsed with an AI that pushes back.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-neutral-400">
              Whiteboard system design, live coding under pressure, algorithm drills, and
              behavioral stories — each with a real-time interviewer that listens, probes your
              reasoning, and grades you like the real thing.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-5">
              <Link
                href="/prep"
                className="rounded-lg bg-neutral-100 px-5 py-2.5 text-sm font-semibold text-neutral-950 transition hover:bg-white"
              >
                Build your prep plan
              </Link>
              <Link
                href="/history"
                className="text-sm font-medium text-neutral-400 transition hover:text-neutral-100"
              >
                Review past interviews →
              </Link>
            </div>
          </section>

          <section className="pb-6">
            <Link
              href="/prep"
              className="group u-rise relative flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/2 p-7 transition duration-300 hover:-translate-y-0.5 hover:border-sky-400/40 hover:shadow-[0_28px_70px_-34px_rgba(56,189,248,0.5)] sm:p-9"
            >
              <div className="max-w-2xl">
                <h2 className="text-xl font-semibold tracking-tight text-neutral-50 sm:text-2xl">
                  Turn a job description into a bespoke prep track
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-neutral-400 sm:text-base">
                  Paste the target JD and your CV. An AI coach reads both, finds the gaps, and
                  curates all four rounds — system design, coding, mock, and behavioral — into one
                  plan aimed at that exact role.
                </p>
              </div>
              <div className="mt-7 flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-sm font-medium text-sky-300">
                  <span>Build your plan</span>
                  <span aria-hidden className="transition group-hover:translate-x-0.5">
                    →
                  </span>
                </div>
                <div className="flex items-center gap-1.5" aria-hidden>
                  <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  <span className="h-1.5 w-1.5 rounded-full bg-violet-400" />
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                </div>
              </div>
            </Link>
          </section>

          <section className="pb-24">
            <div className="mb-6 flex items-baseline justify-between border-b border-white/8 pb-4">
              <h2 className="text-sm font-semibold tracking-tight text-neutral-300">
                Choose a mode
              </h2>
              <span className="font-mono text-xs text-neutral-600">4 rounds</span>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {MODES.map((m, i) => (
                <Link
                  key={m.href}
                  href={m.href}
                  style={{ animationDelay: `${i * 70}ms` }}
                  className={`group u-rise relative flex flex-col overflow-hidden rounded-2xl border border-white/8 bg-white/2 p-7 transition duration-300 hover:-translate-y-0.5 ${m.ring} ${m.glow}`}
                >
                  <span
                    aria-hidden
                    className={`absolute top-5 right-6 font-mono text-5xl font-semibold tabular-nums ${m.num}`}
                  >
                    {m.index}
                  </span>
                  <span
                    aria-hidden
                    className={`absolute top-7 left-0 h-8 w-1 rounded-r-full opacity-70 transition-all duration-300 group-hover:h-12 group-hover:opacity-100 ${m.bar}`}
                  />

                  <h3 className="text-xl font-semibold tracking-tight text-neutral-50">{m.title}</h3>
                  <p className="mt-2.5 max-w-md text-sm leading-relaxed text-neutral-400">
                    {m.blurb}
                  </p>

                  <div className="mt-6 flex flex-wrap items-center gap-2">
                    {m.tags.map((t) => (
                      <span
                        key={t}
                        className="rounded-full border border-white/8 bg-white/2 px-2.5 py-1 text-xs text-neutral-400"
                      >
                        {t}
                      </span>
                    ))}
                  </div>

                  <div className="mt-6 flex items-center gap-1.5 text-sm font-medium text-neutral-500 transition group-hover:gap-2.5">
                    <span className={`transition ${m.arrow}`}>Enter</span>
                    <span className={`transition ${m.arrow}`} aria-hidden>
                      →
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        </div>
      </main>

      <footer className="border-t border-white/8">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-2 px-6 py-8 text-xs text-neutral-600 sm:flex-row sm:items-center">
          <span>Interviewwee — real-time AI interview practice.</span>
          <span className="font-mono">gpt-5 · gpt-5-mini · whisper</span>
        </div>
      </footer>
    </div>
  );
}
