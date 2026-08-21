"use client";

import Editor, { type OnMount } from "@monaco-editor/react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import FeedbackReport from "../../../components/FeedbackReport";
import { getMockProblem, type MockProblemDetail } from "../../../lib/mock";
import { useMockInterview } from "../../../lib/useMockInterview";

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

const TOTAL_SECONDS = 25 * 60; // 25-minute round

// A "bare" editor: no autocomplete, no suggestions, no squiggles — like a real interview pad.
const BARE_OPTIONS = {
  minimap: { enabled: false },
  fontSize: 14,
  scrollBeyondLastLine: false,
  quickSuggestions: false,
  suggestOnTriggerCharacters: false,
  parameterHints: { enabled: false },
  hover: { enabled: false },
  wordBasedSuggestions: "off",
  tabCompletion: "off",
  snippetSuggestions: "none",
  occurrencesHighlight: "off",
  renderValidationDecorations: "off",
  lightbulb: { enabled: false },
} as const;

function fmt(seconds: number): string {
  const s = Math.max(0, seconds);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

export default function MockRoom() {
  const { id } = useParams<{ id: string }>();
  const {
    connected,
    messages,
    state,
    thinking,
    speaking,
    voiceEnabled,
    listening,
    userSpeaking,
    feedback,
    evaluating,
    notice,
    start,
    sendUser,
    sendCode,
    setVoice,
    toggleListening,
    finish,
    dismissFeedback,
    dismissNotice,
  } = useMockInterview();

  const [problem, setProblem] = useState<MockProblemDetail | null>(null);
  const [language, setLanguage] = useState("python");
  const [sources, setSources] = useState<Record<string, string>>({});
  const [input, setInput] = useState("");
  const [started, setStarted] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(TOTAL_SECONDS);
  const [loadError, setLoadError] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const secondsRef = useRef(TOTAL_SECONDS);
  const codeDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const source = sources[language] ?? "";

  useEffect(() => {
    let cancelled = false;
    setLoadError(false);
    getMockProblem(id)
      .then((p) => {
        if (cancelled) return;
        setProblem(p);
        setSources(p.starter);
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, thinking]);

  const doFinish = useCallback(() => {
    finish();
  }, [finish]);

  // Countdown while the interview is running.
  useEffect(() => {
    if (!started) return;
    const t = setInterval(() => {
      setSecondsLeft((prev) => {
        const next = prev - 1;
        secondsRef.current = next;
        if (next <= 0) {
          clearInterval(t);
          doFinish();
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [started, doFinish]);

  const onEditorMount: OnMount = (_editor, monaco) => {
    // Kill JS/TS red squiggles for the bare-pad feel.
    monaco.languages.typescript?.javascriptDefaults.setDiagnosticsOptions({
      noSemanticValidation: true,
      noSyntaxValidation: true,
    });
    monaco.languages.typescript?.typescriptDefaults.setDiagnosticsOptions({
      noSemanticValidation: true,
      noSyntaxValidation: true,
    });
  };

  const pushCode = useCallback(
    (code: string, lang: string) => {
      if (codeDebounceRef.current) clearTimeout(codeDebounceRef.current);
      codeDebounceRef.current = setTimeout(() => {
        sendCode(code, lang, secondsRef.current);
      }, 1200);
    },
    [sendCode],
  );

  function handleStart() {
    start(id, language);
    setStarted(true);
    sendCode(sources[language] ?? "", language, TOTAL_SECONDS);
  }

  function handleSend() {
    if (!input.trim()) return;
    if (sendUser(input)) setInput("");
  }

  function handleLanguage(lang: string) {
    setLanguage(lang);
    if (started) pushCode(sources[lang] ?? "", lang);
  }

  function handleCodeChange(v: string | undefined) {
    const code = v ?? "";
    setSources((s) => ({ ...s, [language]: code }));
    if (started) pushCode(code, language);
  }

  if (loadError) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-neutral-950 text-neutral-300">
        <p>Couldn&apos;t load this problem.</p>
        <Link
          href="/mock"
          className="rounded-md border border-neutral-700 px-4 py-2 text-sm hover:border-neutral-500"
        >
          ← Back to problems
        </Link>
      </div>
    );
  }

  if (!problem) {
    return (
      <div className="flex h-screen items-center justify-center bg-neutral-950 text-neutral-400">
        Loading…
      </div>
    );
  }

  const lowTime = secondsLeft <= 3 * 60;

  return (
    <div className="flex h-screen flex-col bg-neutral-950 text-neutral-100">
      <header className="flex items-center justify-between border-b border-neutral-800 px-6 py-3">
        <div className="flex items-center gap-3">
          <Link href="/mock" className="text-sm text-neutral-500 hover:text-neutral-200">
            ← Mock
          </Link>
          <h1 className="font-semibold">{problem.title}</h1>
          <span className={`text-xs font-medium capitalize ${DIFF[problem.difficulty] ?? ""}`}>
            {problem.difficulty}
          </span>
        </div>
        <div className="flex items-center gap-3 text-sm">
          {started && (
            <span
              className={`rounded-md border px-2.5 py-1 font-mono ${
                lowTime
                  ? "border-rose-800 bg-rose-950/40 text-rose-300"
                  : "border-neutral-700 text-neutral-300"
              }`}
            >
              {fmt(secondsLeft)}
            </span>
          )}
          <select
            value={language}
            onChange={(e) => handleLanguage(e.target.value)}
            disabled={started}
            className="rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1 text-sm disabled:opacity-50"
          >
            {LANGUAGES.map((l) => (
              <option key={l.id} value={l.id}>
                {l.label}
              </option>
            ))}
          </select>
          <button
            onClick={toggleListening}
            className={`flex items-center gap-2 rounded-md border px-3 py-1.5 transition ${
              listening
                ? "border-sky-700 bg-sky-950/40 text-sky-300"
                : "border-neutral-700 text-neutral-400 hover:text-neutral-200"
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full ${
                userSpeaking
                  ? "animate-pulse bg-sky-400"
                  : listening
                    ? "bg-sky-500"
                    : "bg-neutral-600"
              }`}
            />
            {listening ? (userSpeaking ? "You" : "Listening\u2026") : "Hands-free"}
          </button>
          <button
            onClick={() => setVoice(!voiceEnabled)}
            className={`flex items-center gap-2 rounded-md border px-3 py-1.5 transition ${
              voiceEnabled
                ? "border-emerald-700 bg-emerald-950/40 text-emerald-300"
                : "border-neutral-700 text-neutral-400 hover:text-neutral-200"
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full ${
                speaking
                  ? "animate-pulse bg-emerald-400"
                  : voiceEnabled
                    ? "bg-emerald-600"
                    : "bg-neutral-600"
              }`}
            />
            {voiceEnabled ? (speaking ? "Speaking\u2026" : "Voice on") : "Voice off"}
          </button>
          {started && (
            <button
              onClick={doFinish}
              disabled={evaluating}
              className="rounded-md border border-neutral-700 px-3 py-1.5 text-neutral-300 transition hover:border-neutral-500 hover:text-white disabled:opacity-50"
            >
              {evaluating ? "Grading\u2026" : "End & get feedback"}
            </button>
          )}
          <span className={`h-2 w-2 rounded-full ${connected ? "bg-emerald-500" : "bg-neutral-600"}`} />
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* Problem description */}
        <section className="w-80 shrink-0 overflow-y-auto border-r border-neutral-800 p-6">
          <div className="mb-3 flex flex-wrap gap-2 text-xs text-neutral-500">
            {problem.patterns.map((t) => (
              <span key={t} className="rounded bg-neutral-800 px-2 py-0.5">
                {t}
              </span>
            ))}
          </div>
          <p className="leading-relaxed text-neutral-200">{problem.prompt}</p>
          <p className="mt-4 text-sm text-neutral-500">{problem.io_note}</p>
          <p className="mt-6 text-xs leading-relaxed text-neutral-600">
            This is a live round. Think out loud, explain your approach before coding, and expect
            follow-ups. The editor is intentionally bare — no autocomplete or error hints.
          </p>
        </section>

        {/* Bare editor */}
        <section className="min-h-0 flex-1">
          <Editor
            language={LANGUAGES.find((l) => l.id === language)?.monaco ?? "python"}
            theme="vs-dark"
            value={source}
            onMount={onEditorMount}
            onChange={handleCodeChange}
            options={BARE_OPTIONS}
          />
        </section>

        {/* Interviewer transcript */}
        <section className="flex min-h-0 w-96 shrink-0 flex-col border-l border-neutral-800">
          <div ref={scrollRef} className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-5">
            {!started && (
              <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
                <p className="max-w-xs text-neutral-400">
                  A 25-minute live coding interview. The AI interviewer watches your editor, asks you
                  to explain your approach, probes complexity, and challenges edge cases.
                </p>
                <button
                  onClick={handleStart}
                  disabled={!connected}
                  className="rounded-md bg-emerald-600 px-5 py-2.5 font-medium text-white hover:bg-emerald-500 disabled:opacity-40"
                >
                  Start interview
                </button>
              </div>
            )}

            {messages.map((m) => (
              <div
                key={m.id}
                className={m.role === "candidate" ? "flex justify-end" : "flex justify-start"}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                    m.role === "candidate"
                      ? "bg-neutral-800 text-neutral-100"
                      : "bg-neutral-900 ring-1 ring-neutral-800"
                  }`}
                >
                  <div className="mb-1 text-xs text-neutral-500">
                    {m.role === "candidate" ? "You" : "Interviewer"}
                  </div>
                  <div className="whitespace-pre-wrap leading-relaxed">
                    {m.text}
                    {m.streaming && (
                      <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse bg-emerald-500 align-middle" />
                    )}
                  </div>
                </div>
              </div>
            ))}

            {thinking && <div className="text-sm text-neutral-500">Interviewer is thinking…</div>}
          </div>

          {state && (
            <div className="border-t border-neutral-800 px-5 py-2 font-mono text-xs text-neutral-600">
              <span className="text-emerald-500">{state.stage || "—"}</span>
              <span className="mx-2 text-neutral-700">·</span>
              <span className="text-amber-500">{state.move || "—"}</span>
            </div>
          )}

          {notice && (
            <div className="mx-4 mb-2 flex items-center justify-between gap-2 rounded-md border border-amber-800/60 bg-amber-950/40 px-3 py-2 text-xs text-amber-300">
              <span>{notice}</span>
              <button
                onClick={dismissNotice}
                className="shrink-0 text-amber-500 hover:text-amber-200"
                aria-label="Dismiss"
              >
                ×
              </button>
            </div>
          )}

          {started && (
            <div className="border-t border-neutral-800 p-4">
              <div className="flex gap-2">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  rows={1}
                  placeholder="Talk to your interviewer…"
                  className="flex-1 resize-none rounded-md border border-neutral-800 bg-neutral-900 px-3 py-2 text-neutral-100 placeholder-neutral-600 focus:border-neutral-600 focus:outline-none"
                />
                <button
                  onClick={handleSend}
                  className="rounded-md bg-emerald-600 px-4 py-2 font-medium text-white hover:bg-emerald-500"
                >
                  Send
                </button>
              </div>
            </div>
          )}
        </section>
      </div>

      {feedback && <FeedbackReport report={feedback} onClose={dismissFeedback} />}
    </div>
  );
}
