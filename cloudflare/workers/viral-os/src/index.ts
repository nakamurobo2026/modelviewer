type Env = {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  TAVILY_API_KEY: string;
  OPENAI_API_KEY: string;
  OPENAI_MODEL?: string;
  THREADS_ACCESS_TOKEN: string;
  ALLOWED_ORIGIN?: string;
};

type User = { id: string; email?: string };
type Row = Record<string, any>;

const sourcePriority: Record<string, "S" | "A" | "B" | "C"> = {
  threads: "S",
  reddit: "A",
  note: "A",
  news: "B",
  blog: "B",
  official: "B",
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") return new Response(null, { headers: headers(env) });
    try {
      const url = new URL(request.url);
      if (request.method === "POST" && url.pathname === "/api/research") return research(request, env);
      if (request.method === "POST" && url.pathname === "/api/generate-drafts") return generateDrafts(request, env);
      if (request.method === "PATCH" && url.pathname.startsWith("/api/drafts/")) return patchDraft(request, env, url);
      if (request.method === "POST" && url.pathname.startsWith("/api/publish/")) return publishDraft(request, env, url);
      if (request.method === "POST" && url.pathname === "/api/cron/publish-due") return publishDue(env);
      return fail(env, "NOT_FOUND", "Route not found.", 404);
    } catch (error) {
      if (error instanceof HttpError) return fail(env, error.code, error.message, error.status);
      console.error("viral-os-worker", error);
      return fail(env, "INTERNAL_ERROR", error instanceof Error ? error.message : "Unexpected error.", 500);
    }
  },
  async scheduled(_event: ScheduledEvent, env: Env): Promise<void> {
    await publishDue(env);
  },
};

async function research(request: Request, env: Env) {
  const user = await requireUser(request, env);
  const body = (await request.json()) as { topic?: string; persona?: string };
  if (!body.topic) return fail(env, "TOPIC_REQUIRED", "Topic is required.", 400);
  await upsertProfile(env, user);

  const sources = scoreSources(dedupe(await tavily(env, body.topic)));
  const extracted = await openAiJson(env, {
    agent: "Research Agent",
    rules: "Threads only. Do not write posts. Do not copy source text. Return JSON with summary and viralElements.",
    topic: body.topic,
    persona: body.persona,
    sources,
  }).catch(() => localResearch(body.topic!, sources));

  const brief = await insertOne(env, "research_briefs", {
    user_id: user.id,
    topic: body.topic,
    query: body.topic,
    summary: String(extracted.summary || ""),
    source_count: sources.length,
  });
  const savedSources = await insertMany(env, "research_sources", sources.map((source) => ({
    brief_id: brief.id,
    source_type: source.sourceType,
    priority: source.priority,
    weight: source.weight,
    reliability: source.reliability,
    impact: source.impact,
    url: source.url,
    title: source.title,
    summary: source.summary,
    extracted_elements: source.extractedElements || [],
  })));
  const viralElements = normalizeElements(extracted.viralElements);
  await insertMany(env, "viral_elements", viralElements.map((element) => ({
    brief_id: brief.id,
    element_type: element.elementType,
    value: element.value,
    score: element.score,
    evidence_source_ids: savedSources.map((source) => source.id),
  })));
  await audit(env, user.id, "research_brief", brief.id, "research_created", { topic: body.topic });
  return ok(env, { success: true, briefId: brief.id, summary: brief.summary, sources, viralElements });
}

async function generateDrafts(request: Request, env: Env) {
  const user = await requireUser(request, env);
  const body = (await request.json()) as { briefId?: string; count?: number; persona?: string };
  if (!body.briefId) return fail(env, "BRIEF_REQUIRED", "briefId is required.", 400);
  const brief = await selectOne(env, `research_briefs?id=eq.${body.briefId}&user_id=eq.${user.id}`);
  const sources = await select(env, `research_sources?brief_id=eq.${body.briefId}`);
  const elements = await select(env, `viral_elements?brief_id=eq.${body.briefId}`);
  const count = Math.max(1, Math.min(body.count || 20, 20));

  const ai = await openAiJson(env, {
    agent: "Observation, Draft Generator, Buzz Judge",
    rules: "Threads only. Text only. Original. No source copying. Return JSON { drafts: [{ text, category, hookType, scoreTotal, scoreDetail, sourceTrace }] }.",
    persona: body.persona,
    brief,
    sources,
    elements,
    count,
  }).catch(() => ({ drafts: localDrafts(brief, sources, count) }));
  const drafts = normalizeDrafts(ai.drafts, sources).slice(0, count);
  const saved = await insertMany(env, "post_drafts", drafts.map((draft) => ({
    user_id: user.id,
    brief_id: body.briefId,
    text: draft.text,
    status: "scored",
    category: draft.category,
    hook_type: draft.hookType,
    persona: body.persona || "違和感ノート",
    score_total: draft.scoreTotal,
    score_detail: draft.scoreDetail,
    source_trace: draft.sourceTrace,
    model: env.OPENAI_MODEL || "gpt-5-mini",
  })));
  await audit(env, user.id, "research_brief", body.briefId, "drafts_generated", { count: saved.length });
  return ok(env, { success: true, drafts: saved.map(toClientDraft) });
}

async function patchDraft(request: Request, env: Env, url: URL) {
  const user = await requireUser(request, env);
  const id = url.pathname.split("/").pop() || "";
  const body = (await request.json()) as { text?: string; status?: string; scheduledAt?: string };
  const draft = await selectOne(env, `post_drafts?id=eq.${id}&user_id=eq.${user.id}`);
  const patch: Row = { updated_at: new Date().toISOString() };
  if (body.text) patch.text = body.text;
  if (body.status === "approved") {
    patch.status = "approved";
    patch.approved_by = user.id;
    patch.approved_at = new Date().toISOString();
  }
  if (body.status === "rejected") patch.status = "rejected";
  if (body.status === "scheduled") {
    if (!draft.approved_by || !draft.approved_at) return fail(env, "HUMAN_APPROVAL_REQUIRED", "Draft must be approved before scheduling.", 409);
    if (!body.scheduledAt) return fail(env, "SCHEDULE_REQUIRED", "scheduledAt is required.", 400);
    patch.status = "scheduled";
    patch.scheduled_at = new Date(body.scheduledAt).toISOString();
  }
  const updated = await patchOne(env, "post_drafts", id, patch);
  if (body.status === "scheduled") {
    await insertOne(env, "publish_jobs", { draft_id: id, user_id: user.id, status: "queued", scheduled_at: updated.scheduled_at });
  }
  await audit(env, user.id, "post_draft", id, `draft_${body.status || "edited"}`, {});
  return ok(env, { success: true, draft: toClientDraft(updated) });
}

async function publishDraft(request: Request, env: Env, url: URL) {
  const user = await requireUser(request, env);
  const id = url.pathname.split("/").pop() || "";
  const draft = await selectOne(env, `post_drafts?id=eq.${id}&user_id=eq.${user.id}`);
  return publishOne(env, draft, user.id);
}

async function publishDue(env: Env) {
  const jobs = await select(env, `publish_jobs?status=eq.queued&scheduled_at=lte.${encodeURIComponent(new Date().toISOString())}&limit=10`);
  let published = 0;
  let failed = 0;
  for (const job of jobs) {
    try {
      await patchOne(env, "publish_jobs", job.id, { status: "running", locked_at: new Date().toISOString(), attempt_count: (job.attempt_count || 0) + 1 });
      const draft = await selectOne(env, `post_drafts?id=eq.${job.draft_id}&user_id=eq.${job.user_id}`);
      const result = await publishOne(env, draft, job.user_id);
      if (!result.ok) throw new Error(await result.text());
      await patchOne(env, "publish_jobs", job.id, { status: "succeeded", updated_at: new Date().toISOString() });
      published += 1;
    } catch (error) {
      failed += 1;
      const message = error instanceof Error ? error.message : "Publish failed.";
      await patchOne(env, "publish_jobs", job.id, { status: "failed", last_error: message, updated_at: new Date().toISOString() });
      await patchOne(env, "post_drafts", job.draft_id, { status: "failed", failure_reason: message, updated_at: new Date().toISOString() });
    }
  }
  return ok(env, { success: true, checked: jobs.length, published, failed });
}

async function publishOne(env: Env, draft: Row, userId: string) {
  if ((draft.status !== "approved" && draft.status !== "scheduled") || !draft.approved_by || !draft.approved_at) {
    return fail(env, "HUMAN_APPROVAL_REQUIRED", "Draft must be approved before publishing.", 409);
  }
  if (!draft.text) return fail(env, "EMPTY_DRAFT", "Draft text is empty.", 400);
  await patchOne(env, "post_drafts", draft.id, { status: "publishing", updated_at: new Date().toISOString() });
  try {
    const threadsPostId = await threadsPublish(env, draft.text);
    const publishedAt = new Date().toISOString();
    await patchOne(env, "post_drafts", draft.id, { status: "published", threads_post_id: threadsPostId, published_at: publishedAt, updated_at: publishedAt });
    await audit(env, userId, "post_draft", draft.id, "publish_success", { threadsPostId });
    return ok(env, { success: true, threadsPostId, publishedAt });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Threads API failure.";
    await patchOne(env, "post_drafts", draft.id, { status: "failed", failure_reason: message, updated_at: new Date().toISOString() });
    await audit(env, userId, "post_draft", draft.id, "publish_failure", { message });
    return fail(env, "THREADS_API_FAILURE", message, 502);
  }
}

async function requireUser(request: Request, env: Env): Promise<User> {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) throw new HttpError("AUTH_REQUIRED", "Supabase access token is required.", 401);
  const response = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, { headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, authorization } });
  if (!response.ok) throw new HttpError("AUTH_INVALID", "Supabase access token is invalid.", 401);
  const user = (await response.json()) as User;
  return { id: user.id, email: user.email };
}

async function tavily(env: Env, topic: string) {
  const response = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ api_key: env.TAVILY_API_KEY, query: `${topic} Threads 話題 共感`, search_depth: "basic", max_results: 8 }),
  });
  if (!response.ok) throw new Error(await response.text());
  const data = (await response.json()) as { results?: Array<{ url: string; title: string; content: string; score?: number }> };
  return (data.results || []).map((item) => ({ url: item.url, title: item.title, summary: item.content, sourceType: inferSourceType(item.url), weight: item.score || 0.3 }));
}

async function openAiJson(env: Env, payload: unknown): Promise<Row> {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${env.OPENAI_API_KEY}` },
    body: JSON.stringify({ model: env.OPENAI_MODEL || "gpt-5-mini", input: [{ role: "user", content: [{ type: "input_text", text: JSON.stringify(payload) }] }], text: { format: { type: "json_object" } } }),
  });
  const raw = await response.text();
  if (!response.ok) throw new Error(raw);
  const parsed = JSON.parse(raw);
  const text = parsed.output_text || parsed.output?.flatMap((item: Row) => item.content || []).map((item: Row) => item.text || "").join("");
  if (!text) throw new Error("OpenAI response missing JSON text.");
  return JSON.parse(text);
}

async function threadsPublish(env: Env, text: string) {
  const created = await graph(env, "me/threads", { media_type: "TEXT", text });
  const published = await graph(env, "me/threads_publish", { creation_id: created.id });
  return published.id || created.id;
}

async function graph(env: Env, path: string, body: Row) {
  const response = await fetch(`https://graph.threads.net/v1.0/${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...body, access_token: env.THREADS_ACCESS_TOKEN }),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(text);
  return JSON.parse(text);
}

function localResearch(topic: string, sources: Row[]) {
  return { summary: `${topic}を起点に、兛体描写とコメント余白のあるThreads投稿へ変換する。`, viralElements: [{ elementType: "hook", value: topic, score: 70 }, { elementType: "angle", value: sources[0]?.title || "日常観察", score: 65 }] };
}

function localDrafts(brief: Row, sources: Row[], count: number) {
  const topic = String(brief.topic || "日常の観察");
  const ids = sources.slice(0, 2).map((source) => String(source.id));
  const lines = [`${topic}、音だけ残る瞬間がある`, `${topic}って、明るいのに少しだけ店内が遠く見える`, `${topic}、人が減ってから棚の色が変わる気がする`];
  return Array.from({ length: count }, (_, index) => ({ text: lines[index % lines.length], category: "observation", hookType: index % 2 ? "共感" : "違和感", scoreTotal: 76, scoreDetail: { specificity: 80, commentPotential: 72, humanity: 76, novelty: 70, risk: 5 }, sourceTrace: ids }));
}

function normalizeElements(value: unknown) {
  const items = Array.isArray(value) ? value : [];
  return items.map((item: Row) => ({ elementType: item.elementType || "angle", value: String(item.value || ""), score: Number(item.score || 60) })).filter((item) => item.value);
}

function normalizeDrafts(value: unknown, sources: Row[]) {
  const ids = sources.slice(0, 2).map((source) => String(source.id));
  const items = Array.isArray(value) ? value : [];
  return items.map((item: Row) => ({ text: String(item.text || ""), category: item.category || "observation", hookType: item.hookType || "観察", scoreTotal: Number(item.scoreTotal || 70), scoreDetail: item.scoreDetail || { specificity: 70, commentPotential: 70, humanity: 70, novelty: 70, risk: 5 }, sourceTrace: Array.isArray(item.sourceTrace) ? item.sourceTrace.map(String) : ids })).filter((item) => item.text);
}

function scoreSources(sources: Row[]) {
  return sources.map((source) => {
    const priority = sourcePriority[source.sourceType] || "C";
    const weight = priority === "S" ? 1 : priority === "A" ? 0.8 : priority === "B" ? 0.5 : 0.3;
    return { ...source, priority, weight, reliability: Math.round(weight * 70), impact: Math.round(weight * 65), extractedElements: [] };
  });
}

function dedupe(sources: Row[]) {
  const seen = new Set<string>();
  return sources.filter((source) => (seen.has(source.url) ? false : (seen.add(source.url), true)));
}

function inferSourceType(url = "") {
  const host = url.toLowerCase();
  if (host.includes("threads.net")) return "threads";
  if (host.includes("reddit.com")) return "reddit";
  if (host.includes("note.com")) return "note";
  if (host.includes("news") || host.includes("yahoo.co.jp")) return "news";
  if (host.includes("wikipedia.org")) return "official";
  return "blog";
}

function toClientDraft(row: Row) {
  return { id: row.id, text: row.text, status: row.status, category: row.category, hookType: row.hook_type, scoreTotal: row.score_total, scoreDetail: row.score_detail, sourceTrace: row.source_trace || [], scheduledAt: row.scheduled_at, failureReason: row.failure_reason };
}

async function upsertProfile(env: Env, user: User) {
  const response = await fetch(`${env.SUPABASE_URL}/rest/v1/profiles`, { method: "POST", headers: dbHeaders(env, { Prefer: "resolution=merge-duplicates" }), body: JSON.stringify({ id: user.id, display_name: user.email || user.id }) });
  if (!response.ok) throw new Error(await response.text());
}

async function audit(env: Env, userId: string, entityType: string, entityId: string, action: string, metadata: Row) {
  await insertOne(env, "audit_events", { user_id: userId, entity_type: entityType, entity_id: entityId, action, metadata });
}

async function select(env: Env, query: string) {
  const response = await fetch(`${env.SUPABASE_URL}/rest/v1/${query}`, { headers: dbHeaders(env) });
  if (!response.ok) throw new Error(await response.text());
  return response.json<Row[]>();
}

async function selectOne(env: Env, query: string) {
  const rows = await select(env, `${query}&limit=1`);
  if (!rows.length) throw new HttpError("NOT_FOUND", "Record not found.", 404);
  return rows[0];
}

async function insertOne(env: Env, table: string, row: Row) {
  return (await insertMany(env, table, [row]))[0];
}

async function insertMany(env: Env, table: string, rows: Row[]) {
  if (!rows.length) return [];
  const response = await fetch(`${env.SUPABASE_URL}/rest/v1/${table}`, { method: "POST", headers: dbHeaders(env, { Prefer: "return=representation" }), body: JSON.stringify(rows) });
  if (!response.ok) throw new Error(await response.text());
  return response.json<Row[]>();
}

async function patchOne(env: Env, table: string, id: string, patch: Row) {
  const response = await fetch(`${env.SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, { method: "PATCH", headers: dbHeaders(env, { Prefer: "return=representation" }), body: JSON.stringify(patch) });
  if (!response.ok) throw new Error(await response.text());
  return (await response.json<Row[]>())[0];
}

function dbHeaders(env: Env, extra: Record<string, string> = {}) {
  return { apikey: env.SUPABASE_SERVICE_ROLE_KEY, authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, "content-type": "application/json", ...extra };
}

function ok(env: Env, body: unknown) {
  return new Response(JSON.stringify(body), { headers: headers(env) });
}

function fail(env: Env, code: string, message: string, status = 400) {
  return new Response(JSON.stringify({ success: false, error: { code, message, details: {} } }), { status, headers: headers(env) });
}

function headers(env: Env) {
  return { "content-type": "application/json; charset=utf-8", "access-control-allow-origin": env.ALLOWED_ORIGIN || "*", "access-control-allow-methods": "GET,POST,PATCH,OPTIONS", "access-control-allow-headers": "authorization,content-type" };
}

class HttpError extends Error {
  constructor(public code: string, message: string, public status: number) {
    super(message);
  }
}
