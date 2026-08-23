"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import FeedbackReport from "../../components/FeedbackReport";
import { useInterview } from "../../lib/useInterview";

const Canvas = dynamic(() => import("../../components/Canvas"), { ssr: false });

const STAGES: { key: string; label: string }[] = [
  { key: "intro", label: "Intro" },
  { key: "requirements", label: "Requirements" },
  { key: "estimation", label: "Estimation" },
  { key: "entities_api", label: "Entities & API" },
  { key: "high_level_design", label: "High-level design" },
  { key: "deep_dives", label: "Deep dives" },
  { key: "wrap_up", label: "Wrap-up" },
];

export default function DesignRoom() {
  // useSearchParams (router-driven) is read reliably on client-side navigation;
  // reading window.location.search in a useState initializer races the URL commit.
  return (
    <Suspense fallback={null}>
      <DesignRoomInner />
    </Suspense>
  );
}

function DesignRoomInner() {
  const problemId = useSearchParams().get("problem") ?? undefined;
  const {
    connected,
    problem,
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
    diagramSyncedAt,
    start,
    sendUser,
    setVoice,
    sendDiagram,
    toggleListening,
    finish,
    dismissFeedback,
    dismissNotice,
  } = useInterview(problemId);
  const [input, setInput] = useState("");
  const [started, setStarted] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, thinking]);

  const currentStageIdx = STAGES.findIndex((x) => x.key === state?.stage);

  function handleStart() {
    start();
    setStarted(true);
  }

  function handleSend() {
    if (!input.trim()) return;
    if (sendUser(input)) setInput("");
  }

  return (
    <div className="flex h-screen flex-col bg-[#08080a] text-neutral-100">
      <header className="flex items-center justify-between border-b border-white/8 px-6 py-3">
        <Link href="/" className="group flex items-center gap-3" aria-label="Back to modes">
          <span className="grid h-8 w-8 place-items-center rounded-md border border-white/12 bg-white/3 transition group-hover:border-white/25">
            <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />
          </span>
          <span className="leading-tight">
            <span className="block text-sm font-semibold tracking-tight">System Design</span>
            <span className="block text-xs text-neutral-500">Whiteboard interview</span>
          </span>
        </Link>

        <div className="flex items-center gap-2.5 text-sm">
          <button
            onClick={toggleListening}
            title="Toggle hands-free voice — the interviewer listens through your mic and replies out loud"
            className={`flex items-center gap-2 rounded-md border px-3 py-1.5 transition ${
              listening
                ? "border-sky-500/50 bg-sky-500/10 text-sky-300"
                : "border-white/10 text-neutral-400 hover:border-white/25 hover:text-neutral-200"
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full ${
                userSpeaking ? "animate-pulse bg-sky-400" : listening ? "bg-sky-500" : "bg-neutral-600"
              }`}
            />
            {listening ? (userSpeaking ? "You\u2019re speaking" : "Listening\u2026") : "Talk"}
          </button>
          <button
            onClick={() => setVoice(!voiceEnabled)}
            title="Toggle whether the interviewer speaks its replies aloud"
            className={`flex items-center gap-2 rounded-md border px-3 py-1.5 transition ${
              voiceEnabled
                ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-300"
                : "border-white/10 text-neutral-400 hover:border-white/25 hover:text-neutral-200"
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
              onClick={finish}
              disabled={evaluating}
              className="rounded-md border border-white/10 px-3 py-1.5 text-neutral-300 transition hover:border-white/30 hover:text-white disabled:opacity-50"
            >
              {evaluating ? "Grading\u2026" : "End & get feedback"}
            </button>
          )}
          <div className="flex items-center gap-2 rounded-md border border-white/8 px-3 py-1.5 text-neutral-400">
            <span
              className={`h-2 w-2 rounded-full ${connected ? "bg-emerald-500" : "bg-neutral-600"}`}
            />
            {connected ? "Connected" : "Connecting\u2026"}
          </div>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col">
        {problem && (
          <div className="border-b border-white/8 bg-white/1.5 px-6 py-3">
            <span className="text-xs font-medium uppercase tracking-wider text-neutral-500">
              Prompt
            </span>
            <p className="mt-0.5 text-neutral-200">{problem}</p>
          </div>
        )}

        <div className="flex min-h-0 flex-1">
          <section className="relative min-h-0 flex-1 bg-neutral-900">
            <Canvas onDiagram={sendDiagram} />
            <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2">
              {diagramSyncedAt ? (
                <span className="flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-1.5 text-xs font-medium text-emerald-300 shadow-lg backdrop-blur">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  Diagram shared — talk it through when you&apos;re ready
                </span>
              ) : (
                <span className="flex items-center gap-2 rounded-full border border-white/10 bg-black/50 px-3.5 py-1.5 text-xs text-neutral-400 shadow-lg backdrop-blur">
                  <span className="h-1.5 w-1.5 rounded-full bg-neutral-500" />
                  Sketch your design — it shares automatically, no button needed
                </span>
              )}
            </div>
          </section>

          <section className="flex min-h-0 w-100 flex-col border-l border-white/8">
            <div ref={scrollRef} className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-5">
              {!started && (
                <div className="flex h-full flex-col items-center justify-center gap-5 text-center">
                  <p className="max-w-xs leading-relaxed text-neutral-400">
                    You&apos;ll be interviewed by an AI engineer that pushes back on your
                    trade-offs. Three ways to work:{" "}
                    <span className="text-neutral-200">talk</span> with the mic,{" "}
                    <span className="text-neutral-200">sketch</span> on the whiteboard (it can see
                    it), or <span className="text-neutral-200">type</span>.
                  </p>
                  <button
                    onClick={handleStart}
                    disabled={!connected}
                    className="rounded-lg bg-sky-500 px-5 py-2.5 font-medium text-white shadow-lg shadow-sky-500/20 transition hover:bg-sky-400 disabled:opacity-40 disabled:shadow-none"
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
                        ? "bg-white/6 text-neutral-100"
                        : "bg-white/2 ring-1 ring-white/8"
                    }`}
                  >
                    <div className="mb-1 text-xs text-neutral-500">
                      {m.role === "candidate" ? "You" : "Interviewer"}
                    </div>
                    <div className="whitespace-pre-wrap leading-relaxed">
                      {m.text}
                      {m.streaming && (
                        <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse bg-sky-500 align-middle" />
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {thinking && <div className="text-sm text-neutral-500">Interviewer is thinking…</div>}
            </div>

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
              <div className="border-t border-white/8 p-4">
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
                    placeholder="Type your response…"
                    className="flex-1 resize-none rounded-md border border-white/10 bg-white/2 px-3 py-2 text-neutral-100 placeholder-neutral-600 focus:border-sky-500/50 focus:outline-none"
                  />
                  <button
                    onClick={handleSend}
                    className="rounded-md bg-sky-500 px-4 py-2 font-medium text-white transition hover:bg-sky-400"
                  >
                    Send
                  </button>
                </div>
              </div>
            )}
          </section>

          <aside className="w-64 shrink-0 overflow-y-auto border-l border-white/8 bg-white/1.5 p-5">
            <h2 className="mb-4 text-sm font-semibold text-neutral-300">Interview progress</h2>
            <ol className="space-y-3">
              {STAGES.map((s, i) => {
                const status =
                  currentStageIdx < 0
                    ? "todo"
                    : i < currentStageIdx
                      ? "done"
                      : i === currentStageIdx
                        ? "current"
                        : "todo";
                return (
                  <li key={s.key} className="flex items-center gap-3">
                    <span
                      className={`h-3.5 w-3.5 shrink-0 rounded-full border-2 ${
                        status === "done"
                          ? "border-emerald-400 bg-emerald-400/30"
                          : status === "current"
                            ? "animate-pulse border-sky-400 bg-sky-400"
                            : "border-white/15 bg-transparent"
                      }`}
                    />
                    <span
                      className={`text-sm ${
                        status === "current"
                          ? "font-medium text-neutral-100"
                          : status === "done"
                            ? "text-neutral-400"
                            : "text-neutral-600"
                      }`}
                    >
                      {s.label}
                    </span>
                  </li>
                );
              })}
            </ol>

            {state?.note && (
              <div className="mt-5 rounded-lg border border-white/8 bg-white/2 p-3">
                <div className="text-[10px] font-medium uppercase tracking-wider text-neutral-500">
                  Interviewer&apos;s focus now
                </div>
                <p className="mt-1 text-sm leading-relaxed text-neutral-300">{state.note}</p>
              </div>
            )}

            <p className="mt-6 text-xs leading-relaxed text-neutral-600">
              A director model (gpt-5-mini) steers the interview; the interviewer (gpt-5) sees your
              whiteboard and responds.
            </p>
          </aside>
        </div>
      </div>

      {feedback && <FeedbackReport report={feedback} onClose={dismissFeedback} />}
    </div>
  );
}
