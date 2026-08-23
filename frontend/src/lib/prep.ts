const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export interface PlanItem {
  id: string;
  title: string;
  reason: string;
  difficulty?: string;
  category?: string;
}

export interface Plan {
  role_summary: string;
  focus_areas: string[];
  gaps: string[];
  system_design: PlanItem;
  coding: PlanItem[];
  mock: PlanItem;
  behavioral: PlanItem[];
  closing_advice: string;
}

export interface PlanSummary {
  id: string;
  title: string;
  target_role: string;
  created_at: string | null;
}

export interface PlanDetail extends PlanSummary {
  plan: Plan;
}

export interface CreatePlanResponse {
  id: string;
  title: string;
  target_role: string;
  plan: Plan;
}

export async function createPlan(
  jd: string,
  cv: string,
  targetRole: string,
): Promise<CreatePlanResponse> {
  const r = await fetch(`${API_BASE}/prep/plans`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jd, cv, target_role: targetRole }),
  });
  if (!r.ok) throw new Error(`request failed: ${r.status}`);
  return r.json();
}

export async function listPlans(): Promise<PlanSummary[]> {
  try {
    const r = await fetch(`${API_BASE}/prep/plans`);
    return r.ok ? r.json() : [];
  } catch {
    return [];
  }
}

export async function getPlan(id: string): Promise<PlanDetail | null> {
  try {
    const r = await fetch(`${API_BASE}/prep/plans/${id}`);
    return r.ok ? r.json() : null;
  } catch {
    return null;
  }
}
