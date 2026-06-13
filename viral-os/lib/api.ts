import type { ApiError, DashboardResponse, Draft, ResearchResponse } from "./types";

const workerBaseUrl = process.env.NEXT_PUBLIC_WORKER_BASE_URL ?? "";

async function request<T>(path: string, token: string, init: RequestInit = {}): Promise<T> {
  if (!workerBaseUrl) throw new Error("NEXT_PUBLIC_WORKER_BASE_URL is not configured.");
  const response = await fetch(`${workerBaseUrl}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
      ...(init.headers ?? {}),
    },
  });
  const data = (await response.json()) as T | ApiError;
  if (!response.ok || ("success" in data && data.success === false)) {
    const message = "error" in data ? data.error.message : "Request failed.";
    throw new Error(message);
  }
  return data as T;
}

export function getDashboard(token: string) {
  return request<DashboardResponse>("/api/dashboard", token);
}

export function createResearch(token: string, topic: string, persona: string) {
  return request<ResearchResponse>("/api/research", token, {
    method: "POST",
    body: JSON.stringify({ topic, persona }),
  });
}

export function generateDrafts(token: string, briefId: string, count: number, persona: string) {
  return request<{ success: true; drafts: Draft[] }>("/api/generate-drafts", token, {
    method: "POST",
    body: JSON.stringify({ briefId, count, persona }),
  });
}

export function updateDraft(
  token: string,
  id: string,
  payload: { text?: string; status?: string; scheduledAt?: string },
) {
  return request<{ success: true; draft: Partial<Draft> }>(`/api/drafts/${id}`, token, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function publishDraft(token: string, id: string) {
  return request<{ success: true; threadsPostId: string; publishedAt: string }>(`/api/publish/${id}`, token, {
    method: "POST",
  });
}
