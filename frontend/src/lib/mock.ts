import type { Feedback } from "./useInterview";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export interface MockProblemSummary {
  id: string;
  title: string;
  difficulty: "easy" | "medium" | "hard";
  patterns: string[];
}

export interface MockProblemDetail extends MockProblemSummary {
  prompt: string;
  io_note: string;
  starter: Record<string, string>;
}

export interface MockSessionRow {
  id: string;
  problem_id: string;
  problem_title: string;
  language: string;
  status: string;
  started_at: string | null;
  ended_at: string | null;
  overall_score: number | null;
}

export interface MockTurnRow {
  idx: number;
  role: string;
  text: string;
  stage: string | null;
  move: string | null;
}

export interface MockSessionDetail {
  id: string;
  problem_id: string;
  problem_title: string;
  language: string;
  code: string | null;
  status: string;
  report: Feedback | null;
  started_at: string | null;
  ended_at: string | null;
  turns: MockTurnRow[];
}

export async function listMockProblems(): Promise<MockProblemSummary[]> {
  const r = await fetch(`${API_BASE}/mock/problems`);
  if (!r.ok) throw new Error("failed to load problems");
  return r.json();
}

export async function getMockProblem(id: string): Promise<MockProblemDetail> {
  const r = await fetch(`${API_BASE}/mock/problems/${id}`);
  if (!r.ok) throw new Error("failed to load problem");
  return r.json();
}

export async function listMockSessions(): Promise<MockSessionRow[]> {
  try {
    const r = await fetch(`${API_BASE}/mock/sessions`);
    return r.ok ? r.json() : [];
  } catch {
    return [];
  }
}

export async function getMockSession(id: string): Promise<MockSessionDetail | null> {
  try {
    const r = await fetch(`${API_BASE}/mock/sessions/${id}`);
    return r.ok ? r.json() : null;
  } catch {
    return null;
  }
}
