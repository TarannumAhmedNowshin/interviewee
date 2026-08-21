"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import FeedbackReport from "../components/FeedbackReport";
import { useInterview } from "../lib/useInterview";

const Canvas = dynamic(() => import("../components/Canvas"), { ssr: false });

export default function Home() {
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
    start,
    sendUser,
    setVoice,
    sendDiagram,
    toggleListening,
    finish,
    dismissFeedback,
    dismissNotice,
  } = useInterview();
  const [input, setInput] = useState("");
  const [started, setStarted] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, thinking]);

  function handleStart() {
    start();
    setStarted(true);
  }

  function handleSend() {
    if (!input.trim()) return;
    sendUser(input);
    setInput("");
  }

  return (
    <div className="flex h-screen flex-col bg-neutral-950 text-neutral-100">
      <header className="flex items-center justify-between border-b border-neutral-800 px-6 py-4">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Interviewwee</h1>
          <p className="text-sm text-neutral-500">System design interview</p>
        </div>
        <div className="flex items-center gap-4 text-sm text-neutral-400">
          <Link href="/arena" className="text-neutral-400 transition hover:text-neutral-200">
            Arena
          </Link>
          <Link href="/history" className="text-neutral-400 transition hover:text-neutral-200">
            History
          </Link>
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
                userSpeaking ? "animate-pulse bg-sky-400" : listening ? "bg-sky-500" : "bg-neutral-600"
              }`}
            />
            {listening ? (userSpeaking ? "Listening \u00b7 you" : "Listening\u2026") : "Hands-free"}
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
              onClick={finish}
              disabled={evaluating}
              className="rounded-md border border-neutral-700 px-3 py-1.5 text-neutral-300 transition hover:border-neutral-500 hover:text-white disabled:opacity-50"
            >
              {evaluating ? "Grading\u2026" : "End & get feedback"}
            </button>
          )}
          <div className="flex items-center gap-2">
            <span
              className={`h-2 w-2 rounded-full ${connected ? "bg-emerald-500" : "bg-neutral-600"}`}
            />
            {connected ? "Connected" : "Connecting\u2026"}
          </div>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col">
        {problem && (
          <div className="border-b border-neutral-800 px-6 py-3">
            <span className="text-xs uppercase tracking-wide text-neutral-500">Prompt</span>
            <p className="text-neutral-200">{problem}</p>
          </div>
        )}

        <div className="flex min-h-0 flex-1">
          <section className="min-h-0 flex-1 bg-neutral-900">
            <Canvas onDiagram={sendDiagram} />
          </section>

          <section className="flex min-h-0 w-100 flex-col border-l border-neutral-800">
            <div ref={scrollRef} className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-5">
              {!started && (
                <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
                  <p className="max-w-xs text-neutral-400">
                    You&apos;ll be interviewed by an AI engineer. Sketch on the whiteboard — it can
                    see your diagram and will probe your trade-offs, just like the real thing.
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
                    placeholder="Type your response…"
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

          <aside className="w-64 shrink-0 border-l border-neutral-800 bg-neutral-900/50 p-5">
            <h2 className="mb-4 text-sm font-semibold text-neutral-300">Interviewer console</h2>
            <dl className="space-y-4 font-mono text-sm">
              <div>
                <dt className="text-neutral-500">stage</dt>
                <dd className="text-emerald-400">{state?.stage ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-neutral-500">move</dt>
                <dd className="text-amber-400">{state?.move ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-neutral-500">note</dt>
                <dd className="whitespace-pre-wrap text-neutral-300">{state?.note || "—"}</dd>
              </div>
            </dl>
            <p className="mt-6 text-xs leading-relaxed text-neutral-600">
              The director (gpt-5-mini) picks the stage &amp; move each turn; the interviewer (gpt-5)
              sees your whiteboard and speaks.
            </p>
          </aside>
        </div>
      </div>

      {feedback && <FeedbackReport report={feedback} onClose={dismissFeedback} />}
    </div>
  );
}
