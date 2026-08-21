"use client";

import Editor from "@monaco-editor/react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  getHint,
  getProblem,
  runCode,
  submitCode,
  type ProblemDetail,
  type RunResult,
} from "../../../lib/arena";

const LANGUAGES = [
  { id: "python", label: "Python", monaco: "python" },
  { id: "javascript", label: "JavaScript", monaco: "javascript" },
  { id: "cpp", label: "C++", monaco: "cpp" },
];

const DIFF: Record<string, string> = {
  easy: "text-emerald-400",
  medium: "text-amber-400",
  hard: "text-rose-400",
};

export default function ArenaProblem() {
  const { id } = useParams<{ id: string }>();
  const [problem, setProblem] = useState<ProblemDetail | null>(null);
  const [language, setLanguage] = useState("python");
  const [sources, setSources] = useState<Record<string, string>>({});
  const [result, setResult] = useState<RunResult | null>(null);
  const [busy, setBusy] = useState<"run" | "submit" | null>(null);
  const [hints, setHints] = useState<string[]>([]);
  const [hintBusy, setHintBusy] = useState(false);

  useEffect(() => {
    getProblem(id)
      .then((p) => {
        setProblem(p);
        setSources(p.starter);
      })
      .catch(() => setProblem(null));
  }, [id]);

  const source = sources[language] ?? "";

  async function handle(kind: "run" | "submit") {
    setBusy(kind);
    setResult(null);
    try {
      const fn = kind === "run" ? runCode : submitCode;
      setResult(await fn(id, language, source));
    } catch {
      setResult({ passed: 0, total: 0, results: [], review: null });
    } finally {
      setBusy(null);
    }
  }

  async function handleHint() {
    if (hints.length >= 3) return;
    setHintBusy(true);
    try {
      const h = await getHint(id, source, hints.length + 1);
      if (h) setHints((prev) => [...prev, h]);
    } finally {
      setHintBusy(false);
    }
  }

  if (!problem) {
    return (
      <div className="flex h-screen items-center justify-center bg-neutral-950 text-neutral-400">
        Loading…
      </div>
    );
  }

  const allPassed = result && result.total > 0 && result.passed === result.total;

  return (
    <div className="flex h-screen flex-col bg-neutral-950 text-neutral-100">
      <header className="flex items-center justify-between border-b border-neutral-800 px-6 py-3">
        <div className="flex items-center gap-3">
          <Link href="/arena" className="text-sm text-neutral-500 hover:text-neutral-200">
            ← Arena
          </Link>
          <h1 className="font-semibold">{problem.title}</h1>
          <span className={`text-xs font-medium capitalize ${DIFF[problem.difficulty] ?? ""}`}>
            {problem.difficulty}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1 text-sm"
          >
            {LANGUAGES.map((l) => (
              <option key={l.id} value={l.id}>
                {l.label}
              </option>
            ))}
          </select>
          <button
            onClick={handleHint}
            disabled={hintBusy || hints.length >= 3}
            className="rounded-md border border-neutral-700 px-3 py-1 text-sm text-amber-300/90 hover:text-amber-200 disabled:opacity-50"
          >
            {hintBusy ? "Thinking\u2026" : hints.length >= 3 ? "No more hints" : `Hint ${hints.length + 1}`}
          </button>
          <button
            onClick={() => setSources(problem.starter)}
            className="rounded-md border border-neutral-700 px-3 py-1 text-sm text-neutral-400 hover:text-neutral-100"
          >
            Reset
          </button>
          <button
            onClick={() => handle("run")}
            disabled={busy !== null}
            className="rounded-md bg-neutral-700 px-4 py-1.5 text-sm font-medium hover:bg-neutral-600 disabled:opacity-50"
          >
            {busy === "run" ? "Running…" : "Run"}
          </button>
          <button
            onClick={() => handle("submit")}
            disabled={busy !== null}
            className="rounded-md bg-emerald-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            {busy === "submit" ? "Submitting…" : "Submit"}
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* Problem description */}
        <section className="w-2/5 overflow-y-auto border-r border-neutral-800 p-6">
          <div className="mb-3 flex flex-wrap gap-2 text-xs text-neutral-500">
            {problem.patterns.map((t) => (
              <span key={t} className="rounded bg-neutral-800 px-2 py-0.5">
                {t}
              </span>
            ))}
          </div>
          <p className="leading-relaxed text-neutral-200">{problem.prompt}</p>
          <p className="mt-4 text-sm text-neutral-500">{problem.io_note}</p>
          <p className="mt-1 text-sm text-neutral-500">{problem.complexity}</p>

          <h3 className="mt-6 mb-2 text-sm font-semibold text-neutral-300">Examples</h3>
          <div className="space-y-3">
            {problem.examples.map((ex, i) => (
              <div key={i} className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-3 font-mono text-xs">
                <div className="text-neutral-500">input</div>
                <pre className="whitespace-pre-wrap text-neutral-200">{ex.input}</pre>
                <div className="mt-2 text-neutral-500">output</div>
                <pre className="whitespace-pre-wrap text-neutral-200">{ex.output}</pre>
              </div>
            ))}
          </div>

          {hints.length > 0 && (
            <div className="mt-6">
              <h3 className="mb-2 text-sm font-semibold text-amber-300">Hints</h3>
              <ol className="space-y-2">
                {hints.map((h, i) => (
                  <li
                    key={i}
                    className="rounded-lg border border-amber-900/40 bg-amber-950/10 p-3 text-sm text-neutral-300"
                  >
                    <span className="mr-1 font-semibold text-amber-400">{i + 1}.</span>
                    {h}
                  </li>
                ))}
              </ol>
            </div>
          )}
        </section>

        {/* Editor + results */}
        <section className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1">
            <Editor
              language={LANGUAGES.find((l) => l.id === language)?.monaco ?? "python"}
              theme="vs-dark"
              value={source}
              onChange={(v) => setSources((s) => ({ ...s, [language]: v ?? "" }))}
              options={{ minimap: { enabled: false }, fontSize: 14, scrollBeyondLastLine: false }}
            />
          </div>

          {result && (
            <div className="max-h-[45%] overflow-y-auto border-t border-neutral-800 bg-neutral-900/40 p-4">
              <div className="mb-3 flex items-center gap-3">
                <span className={`text-sm font-semibold ${allPassed ? "text-emerald-400" : "text-rose-400"}`}>
                  {result.total > 0 ? `${result.passed}/${result.total} tests passed` : "Execution failed"}
                </span>
              </div>

              <div className="space-y-2">
                {result.results.map((r) => (
                  <div
                    key={r.index}
                    className={`rounded-lg border p-3 text-xs ${
                      r.passed ? "border-emerald-900 bg-emerald-950/20" : "border-rose-900 bg-rose-950/20"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">
                        {r.hidden ? `Hidden test #${r.index + 1}` : `Test #${r.index + 1}`}
                      </span>
                      <span className={r.passed ? "text-emerald-400" : "text-rose-400"}>
                        {r.passed ? "passed" : "failed"}
                      </span>
                    </div>
                    {!r.hidden && !r.passed && (
                      <div className="mt-2 grid grid-cols-3 gap-2 font-mono text-neutral-400">
                        <div>
                          <div className="text-neutral-600">input</div>
                          <pre className="whitespace-pre-wrap">{r.input}</pre>
                        </div>
                        <div>
                          <div className="text-neutral-600">expected</div>
                          <pre className="whitespace-pre-wrap">{r.expected}</pre>
                        </div>
                        <div>
                          <div className="text-neutral-600">got</div>
                          <pre className="whitespace-pre-wrap">{r.got}</pre>
                        </div>
                      </div>
                    )}
                    {(r.stderr || r.error) && (
                      <pre className="mt-2 whitespace-pre-wrap font-mono text-rose-400">
                        {r.error ?? r.stderr}
                      </pre>
                    )}
                  </div>
                ))}
              </div>

              {result.review && (
                <div className="mt-4 rounded-lg border border-neutral-800 bg-neutral-900 p-4">
                  <div className="mb-2 flex gap-2 text-xs">
                    <span className="rounded bg-neutral-800 px-2 py-0.5 font-mono">
                      time {result.review.big_o_time}
                    </span>
                    <span className="rounded bg-neutral-800 px-2 py-0.5 font-mono">
                      space {result.review.big_o_space}
                    </span>
                  </div>
                  <p className="text-sm text-neutral-200">{result.review.correctness}</p>
                  <p className="mt-2 text-sm leading-relaxed text-neutral-400">{result.review.review}</p>
                  {result.review.suggestions?.length > 0 && (
                    <ul className="mt-2 space-y-1 text-sm text-neutral-400">
                      {result.review.suggestions.map((s, i) => (
                        <li key={i} className="flex gap-2">
                          <span className="text-amber-500">→</span>
                          <span>{s}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
