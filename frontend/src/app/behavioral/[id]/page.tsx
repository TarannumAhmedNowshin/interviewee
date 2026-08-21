"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import FeedbackReport from "../../../components/FeedbackReport";
import { getBehavioralQuestion, type BehavioralQuestionDetail } from "../../../lib/behavioral";
import { useBehavioral } from "../../../lib/useBehavioral";

export default function BehavioralRoom() {
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
    setVoice,
    toggleListening,
    finish,
    dismissFeedback,
    dismissNotice,
  } = useBehavioral();

  const [question, setQuestion] = useState<BehavioralQuestionDetail | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [input, setInput] = useState("");
  const [started, setStarted] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    setLoadError(false);
    getBehavioralQuestion(id)
      .then((q) => {
        if (!cancelled) setQuestion(q);
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

  function handleStart() {
    start(id);
    setStarted(true);
  }

  function handleSend() {
    if (!input.trim()) return;
    if (sendUser(input)) setInput("");
  }

  if (loadError) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-neutral-950 text-neutral-300">
        <p>Couldn&apos;t load this question.</p>
        <Link
          href="/behavioral"
          className="rounded-md border border-neutral-700 px-4 py-2 text-sm hover:border-neutral-500"
        >
          ← Back to questions
        </Link>
      </div>
    );
  }

  if (!question) {
    return (
      <div className="flex h-screen items-center justify-center bg-neutral-950 text-neutral-400">
        Loading…
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-neutral-950 text-neutral-100">
      <header className="flex items-center justify-between border-b border-neutral-800 px-6 py-3">
        <div className="flex items-center gap-3">
          <Link href="/behavioral" className="text-sm text-neutral-500 hover:text-neutral-200">
            ← Behavioral
          </Link>
          <h1 className="font-semibold">{question.title}</h1>
          <span className="rounded bg-neutral-800 px-2 py-0.5 text-xs text-neutral-400">
            {question.category}
          </span>
        </div>
        <div className="flex items-center gap-3 text-sm">
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
              onClick={finish}
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
        {/* Question + guidance */}
        <section className="w-96 shrink-0 overflow-y-auto border-r border-neutral-800 p-6">
          <div className="mb-2 flex flex-wrap gap-2 text-xs text-neutral-500">
            {question.tags.map((t) => (
              <span key={t} className="rounded bg-neutral-800 px-2 py-0.5">
                {t}
              </span>
            ))}
          </div>
          <p className="text-lg leading-relaxed text-neutral-100">{question.prompt}</p>
          <div className="mt-6 rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
            <p className="text-xs font-semibold text-neutral-400">Answer with STAR</p>
            <ul className="mt-2 space-y-1 text-xs leading-relaxed text-neutral-500">
              <li>
                <span className="text-neutral-300">Situation</span> — set the context
              </li>
              <li>
                <span className="text-neutral-300">Task</span> — your responsibility
              </li>
              <li>
                <span className="text-neutral-300">Action</span> — what you personally did
              </li>
              <li>
                <span className="text-neutral-300">Result</span> — the measurable outcome
              </li>
            </ul>
          </div>
          {state && (
            <div className="mt-6 font-mono text-xs text-neutral-600">
              <span className="text-emerald-500">{state.stage || "—"}</span>
              <span className="mx-2 text-neutral-700">·</span>
              <span className="text-amber-500">{state.move || "—"}</span>
            </div>
          )}
        </section>

        {/* Transcript */}
        <section className="flex min-h-0 flex-1 flex-col">
          <div ref={scrollRef} className="mx-auto w-full max-w-2xl flex-1 space-y-4 overflow-y-auto px-6 py-6">
            {!started && (
              <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
                <p className="max-w-md text-neutral-400">
                  A spoken behavioral interview. Turn on hands-free and talk through a real example
                  out loud — the AI interviewer will probe for specifics and score your STAR story.
                  You can also type if you prefer.
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
            <div className="mx-auto mb-2 flex w-full max-w-2xl items-center justify-between gap-2 rounded-md border border-amber-800/60 bg-amber-950/40 px-3 py-2 text-xs text-amber-300">
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
              <div className="mx-auto flex w-full max-w-2xl gap-2">
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
                  placeholder="Speak, or type your answer…"
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
