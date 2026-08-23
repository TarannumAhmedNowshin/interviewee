"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { clearPersistentSessionId, getPersistentSessionId } from "./session";

export type Role = "interviewer" | "candidate";

export interface Message {
  id: string;
  role: Role;
  text: string;
  streaming?: boolean;
}

export interface InterviewState {
  stage: string;
  move: string;
  note: string;
}

export interface Dimension {
  name: string;
  score: number;
  comment: string;
}

export interface Feedback {
  overall_score: number;
  summary: string;
  dimensions: Dimension[];
  strengths: string[];
  improvements: string[];
}

interface ServerMessage {
  type: string;
  session_id?: string;
  problem?: string;
  stage?: string;
  move?: string;
  note?: string;
  text?: string;
  data?: string;
  report?: Feedback;
}

const WS_BASE = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:8000";

// Energy-based VAD tuning (client-side, no deps).
const VAD_THRESHOLD = 0.02; // RMS above this counts as speech (higher = ignores background noise)
const SILENCE_MS = 1400; // trailing silence that ends an utterance (allows natural thinking pauses)
const MIN_SPEECH_MS = 500; // ignore clips shorter than this (drops silent blips Whisper hallucinates on)
const MAX_RECONNECT_ATTEMPTS = 8; // after this many failed retries, give up with a terminal banner

export function useInterview(problemId?: string) {
  const [connected, setConnected] = useState(false);
  const [problem, setProblem] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [state, setState] = useState<InterviewState | null>(null);
  const [thinking, setThinking] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [listening, setListening] = useState(false);
  const [userSpeaking, setUserSpeaking] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [evaluating, setEvaluating] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [diagramSyncedAt, setDiagramSyncedAt] = useState<number | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const streamingIdRef = useRef<string | null>(null);
  const sessionIdRef = useRef<string>("");
  const problemIdRef = useRef<string | undefined>(problemId);
  problemIdRef.current = problemId;
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const intentionalCloseRef = useRef(false);
  const evaluatingRef = useRef(false);

  // AI audio playback (refs so barge-in can stop it from the VAD loop)
  const audioQueueRef = useRef<string[]>([]);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const aiSpeakingRef = useRef(false);
  const stopAudioRef = useRef<() => void>(() => {});

  // continuous listening / VAD
  const listeningRef = useRef(false);
  const micStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    intentionalCloseRef.current = false;
    if (!sessionIdRef.current) sessionIdRef.current = getPersistentSessionId();

    function playNext() {
      const url = audioQueueRef.current.shift();
      if (!url) {
        aiSpeakingRef.current = false;
        setSpeaking(false);
        return;
      }
      aiSpeakingRef.current = true;
      setSpeaking(true);
      const audio = new Audio(url);
      currentAudioRef.current = audio;
      const done = () => {
        URL.revokeObjectURL(url);
        if (currentAudioRef.current === audio) currentAudioRef.current = null;
        playNext();
      };
      audio.onended = done;
      audio.onerror = done;
      void audio.play().catch(done);
    }

    function enqueueAudio(b64: string) {
      const bin = atob(b64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const url = URL.createObjectURL(new Blob([bytes], { type: "audio/mpeg" }));
      audioQueueRef.current.push(url);
      if (!aiSpeakingRef.current) playNext();
    }

    function stopAudio() {
      audioQueueRef.current.forEach((u) => URL.revokeObjectURL(u));
      audioQueueRef.current = [];
      const cur = currentAudioRef.current;
      if (cur) {
        cur.pause();
        currentAudioRef.current = null;
      }
      aiSpeakingRef.current = false;
      setSpeaking(false);
    }
    stopAudioRef.current = stopAudio;

    function connect() {
      const q = problemIdRef.current
        ? `?problem=${encodeURIComponent(problemIdRef.current)}`
        : "";
      const ws = new WebSocket(`${WS_BASE}/ws/interview/${sessionIdRef.current}${q}`);
      wsRef.current = ws;
      ws.onmessage = handleMessage;
      ws.onopen = () => {
        setConnected(true);
        if (reconnectAttemptsRef.current > 0) setNotice(null);
        reconnectAttemptsRef.current = 0;
      };
      ws.onclose = () => {
        if (wsRef.current !== ws) return;
        setConnected(false);
        setThinking(false);
        evaluatingRef.current = false;
        setEvaluating(false);
        if (intentionalCloseRef.current) return;
        if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
          setNotice("Can\u2019t reach the server. Refresh the page to try again.");
          return;
        }
        setNotice("Connection lost \u2014 reconnecting\u2026");
        const delay = Math.min(5000, 500 * 2 ** reconnectAttemptsRef.current);
        reconnectAttemptsRef.current += 1;
        reconnectTimerRef.current = setTimeout(connect, delay);
      };
    }

    function handleMessage(ev: MessageEvent) {
      const msg: ServerMessage = JSON.parse(ev.data);
      switch (msg.type) {
        case "session":
          setProblem(msg.problem ?? "");
          break;
        case "state":
          setState({ stage: msg.stage ?? "", move: msg.move ?? "", note: msg.note ?? "" });
          setThinking(true);
          setNotice(null);
          break;
        case "assistant_delta": {
          setThinking(false);
          const delta = msg.text ?? "";
          const existing = streamingIdRef.current;
          if (existing) {
            setMessages((prev) =>
              prev.map((m) => (m.id === existing ? { ...m, text: m.text + delta } : m)),
            );
          } else {
            const newId = crypto.randomUUID();
            streamingIdRef.current = newId;
            setMessages((prev) => [
              ...prev,
              { id: newId, role: "interviewer", text: delta, streaming: true },
            ]);
          }
          break;
        }
        case "assistant_done": {
          const doneId = streamingIdRef.current;
          streamingIdRef.current = null;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === doneId ? { ...m, text: msg.text ?? m.text, streaming: false } : m,
            ),
          );
          setThinking(false);
          break;
        }
        case "audio_chunk":
          if (msg.data) enqueueAudio(msg.data);
          break;
        case "transcript":
          setMessages((prev) => [
            ...prev,
            { id: crypto.randomUUID(), role: "candidate", text: msg.text ?? "" },
          ]);
          setThinking(true);
          setNotice(null);
          break;
        case "interrupted": {
          const intId = streamingIdRef.current;
          streamingIdRef.current = null;
          setMessages((prev) => prev.map((m) => (m.id === intId ? { ...m, streaming: false } : m)));
          setThinking(false);
          break;
        }
        case "evaluating":
          setEvaluating(true);
          break;
        case "feedback":
          evaluatingRef.current = false;
          setEvaluating(false);
          if (msg.report) setFeedback(msg.report);
          clearPersistentSessionId(); // round is graded — the next visit starts fresh
          break;
        case "feedback_error":
          evaluatingRef.current = false;
          setNotice("Couldn't generate the report. Please try again.");
          setEvaluating(false);
          break;
        case "stt_error":
          setNotice("Transcription failed \u2014 possibly the Whisper rate limit. Try again.");
          setThinking(false);
          break;
        case "stt_empty":
          // Usually a phantom clip (breath/silence); clear the spinner quietly, no scary banner.
          setThinking(false);
          break;
      }
    }

    connect();

    return () => {
      intentionalCloseRef.current = true;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      wsRef.current?.close();
      stopAudioRef.current();
      listeningRef.current = false;
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      micStreamRef.current?.getTracks().forEach((t) => t.stop());
      void audioContextRef.current?.close();
    };
  }, []);

  const send = useCallback((obj: Record<string, unknown>): boolean => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return false;
    ws.send(JSON.stringify(obj));
    return true;
  }, []);

  const start = useCallback(() => {
    if (!send({ type: "start" })) {
      setNotice("Not connected yet \u2014 give it a second and try again.");
      return;
    }
    setThinking(true);
  }, [send]);

  const sendUser = useCallback(
    (text: string): boolean => {
      const trimmed = text.trim();
      if (!trimmed) return false;
      if (!send({ type: "user_message", text: trimmed })) {
        setNotice(
          "Not connected \u2014 reconnecting. Your message wasn't sent; try again in a moment.",
        );
        return false;
      }
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: "candidate", text: trimmed },
      ]);
      setThinking(true);
      return true;
    },
    [send],
  );

  const setVoice = useCallback(
    (enabled: boolean) => {
      setVoiceEnabled(enabled);
      send({ type: "set_voice", enabled });
    },
    [send],
  );

  const sendDiagram = useCallback(
    (base64: string) => {
      if (send({ type: "diagram", data: base64 })) setDiagramSyncedAt(Date.now());
    },
    [send],
  );

  const sendAudioBlob = useCallback(
    async (blob: Blob) => {
      const buf = new Uint8Array(await blob.arrayBuffer());
      let bin = "";
      for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
      if (!send({ type: "audio", data: btoa(bin), filename: "utterance.webm" })) {
        setNotice("Not connected \u2014 couldn't send your audio. Reconnecting\u2026");
        return;
      }
      setThinking(true);
    },
    [send],
  );

  const stopListening = useCallback(() => {
    listeningRef.current = false;
    setListening(false);
    setUserSpeaking(false);
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    micStreamRef.current?.getTracks().forEach((t) => t.stop());
    void audioContextRef.current?.close();
    micStreamRef.current = null;
    audioContextRef.current = null;
  }, []);

  const startListening = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;
      const ac = new AudioContext();
      audioContextRef.current = ac;
      const source = ac.createMediaStreamSource(stream);
      const analyser = ac.createAnalyser();
      analyser.fftSize = 1024;
      source.connect(analyser);
      const buf = new Float32Array(analyser.fftSize);

      let speakingNow = false;
      let silenceStart = 0;
      let speechStart = 0;
      let recorder: MediaRecorder | null = null;
      let chunks: Blob[] = [];

      const tick = () => {
        if (!listeningRef.current) return;
        analyser.getFloatTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
        const rms = Math.sqrt(sum / buf.length);
        const now = performance.now();

        if (rms > VAD_THRESHOLD) {
          silenceStart = 0;
          if (!speakingNow) {
            speakingNow = true;
            speechStart = now;
            setUserSpeaking(true);
            if (aiSpeakingRef.current) {
              stopAudioRef.current();
              send({ type: "interrupt" });
            }
            chunks = [];
            recorder = new MediaRecorder(stream);
            recorder.ondataavailable = (e) => {
              if (e.data.size > 0) chunks.push(e.data);
            };
            recorder.start();
          }
        } else if (speakingNow) {
          if (silenceStart === 0) {
            silenceStart = now;
          } else if (now - silenceStart > SILENCE_MS) {
            speakingNow = false;
            setUserSpeaking(false);
            const speechMs = silenceStart - speechStart;
            const rec = recorder;
            recorder = null;
            if (rec && rec.state !== "inactive") {
              const captured = chunks;
              rec.onstop = () => {
                if (speechMs < MIN_SPEECH_MS) return;
                void sendAudioBlob(new Blob(captured, { type: rec.mimeType || "audio/webm" }));
              };
              rec.stop();
            }
          }
        }
        rafRef.current = requestAnimationFrame(tick);
      };

      listeningRef.current = true;
      setListening(true);
      rafRef.current = requestAnimationFrame(tick);
    } catch (err) {
      console.error("microphone error", err);
    }
  }, [send, sendAudioBlob]);

  const toggleListening = useCallback(() => {
    if (listeningRef.current) stopListening();
    else void startListening();
  }, [startListening, stopListening]);

  const finish = useCallback((): boolean => {
    if (evaluatingRef.current) return false;
    if (!send({ type: "finish" })) {
      setNotice("Not connected \u2014 reconnecting. Try \u201cEnd\u201d again in a moment.");
      return false;
    }
    evaluatingRef.current = true;
    setEvaluating(true);
    return true;
  }, [send]);

  const dismissFeedback = useCallback(() => setFeedback(null), []);

  return {
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
    dismissNotice: () => setNotice(null),
  };
}
