import type { Feedback } from "./useInterview";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export interface BehavioralQuestionSummary {
  id: string;
  title: string;
  category: string;
  tags: string[];
}

export interface BehavioralQuestionDetail extends BehavioralQuestionSummary {
  prompt: string;
}

export interface BehavioralSessionRow {
  id: string;
  question_id: string;
  question_title: string;
  category: string;
  status: string;
  started_at: string | null;
  ended_at: string | null;
  overall_score: number | null;
}

export interface BehavioralTurnRow {
  idx: number;
  role: string;
  text: string;
  stage: string | null;
  move: string | null;
}

export interface BehavioralSessionDetail {
  id: string;
  question_id: string;
  question_title: string;
  category: string;
  status: string;
  report: Feedback | null;
  started_at: string | null;
  ended_at: string | null;
  turns: BehavioralTurnRow[];
}

export async function listBehavioralQuestions(): Promise<BehavioralQuestionSummary[]> {
  const r = await fetch(`${API_BASE}/behavioral/questions`);
  if (!r.ok) throw new Error("failed to load questions");
  return r.json();
}

export async function getBehavioralQuestion(id: string): Promise<BehavioralQuestionDetail> {
  const r = await fetch(`${API_BASE}/behavioral/questions/${id}`);
  if (!r.ok) throw new Error("failed to load question");
  return r.json();
}

export async function listBehavioralSessions(): Promise<BehavioralSessionRow[]> {
  try {
    const r = await fetch(`${API_BASE}/behavioral/sessions`);
    return r.ok ? r.json() : [];
  } catch {
    return [];
  }
}

export async function getBehavioralSession(id: string): Promise<BehavioralSessionDetail | null> {
  try {
    const r = await fetch(`${API_BASE}/behavioral/sessions/${id}`);
    return r.ok ? r.json() : null;
  } catch {
    return null;
  }
}
