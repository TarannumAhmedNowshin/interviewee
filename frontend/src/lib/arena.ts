const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export interface ProblemSummary {
  id: string;
  title: string;
  difficulty: "easy" | "medium" | "hard";
  patterns: string[];
}

export interface ProblemDetail extends ProblemSummary {
  prompt: string;
  io_note: string;
  complexity: string;
  starter: Record<string, string>;
  examples: { input: string; output: string }[];
}

export interface TestResult {
  index: number;
  passed: boolean;
  hidden: boolean;
  input?: string;
  expected?: string;
  got?: string;
  stderr?: string;
  error?: string;
}

export interface Review {
  big_o_time: string;
  big_o_space: string;
  correctness: string;
  review: string;
  suggestions: string[];
}

export interface RunResult {
  passed: number;
  total: number;
  results: TestResult[];
  review?: Review | null;
  solved?: boolean;
}

export interface ProblemProgress {
  attempts: number;
  solved: boolean;
  due: boolean;
  due_at: string | null;
}

export async function listProblems(): Promise<ProblemSummary[]> {
  const r = await fetch(`${API_BASE}/arena/problems`);
  if (!r.ok) throw new Error("failed to load problems");
  return r.json();
}

export async function getProblem(id: string): Promise<ProblemDetail> {
  const r = await fetch(`${API_BASE}/arena/problems/${id}`);
  if (!r.ok) throw new Error("failed to load problem");
  return r.json();
}

async function post(path: string, body: unknown): Promise<RunResult> {
  const r = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`request failed: ${r.status}`);
  return r.json();
}

export function runCode(problemId: string, language: string, source: string): Promise<RunResult> {
  return post("/arena/run", { problem_id: problemId, language, source });
}

export function submitCode(problemId: string, language: string, source: string): Promise<RunResult> {
  return post("/arena/submit", { problem_id: problemId, language, source });
}

export async function getProgress(): Promise<Record<string, ProblemProgress>> {
  try {
    const r = await fetch(`${API_BASE}/arena/progress`);
    return r.ok ? r.json() : {};
  } catch {
    return {};
  }
}

export async function getHint(problemId: string, source: string, level: number): Promise<string> {
  try {
    const r = await fetch(`${API_BASE}/arena/hint`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ problem_id: problemId, source, level }),
    });
    if (!r.ok) return "";
    return (await r.json()).hint ?? "";
  } catch {
    return "";
  }
}
