# Viral OS Deployment Readiness Report

Review target: PR implementation for Viral OS MVP.

Specification files were not modified during this review.

## Existing Pages

The Next.js app is implemented under `viral-os/app`.

- `viral-os/app/layout.tsx`
- `viral-os/app/page.tsx`

The UI is a single App Router page with tabbed sections:

- Dashboard: exists in `DashboardView`
- Research: exists in `ResearchView`
- Drafts: exists in `DraftList`
- Approval Queue: exists via filtered `scored` drafts
- Schedule: exists in `ScheduleView`
- Settings: exists in `SettingsView`

Analytics exists as Dashboard metrics, not as a separate route:

- awaiting approval
- scheduled
- failed jobs
- published
- average score
- source-backed drafts
- recent research
- learning pipeline audit events

## Existing APIs

Client API calls are implemented in `viral-os/lib/api.ts`.

- `GET /api/dashboard`
- `POST /api/research`
- `POST /api/generate-drafts`
- `PATCH /api/drafts/:id`
- `POST /api/publish/:id`

All client API calls send the Supabase access token through the `Authorization: Bearer` header.

## Existing Workers

Cloudflare Worker implementation:

- `cloudflare/workers/viral-os/src/index.ts`

Worker routes implemented:

- `GET /api/dashboard`
- `POST /api/research`
- `POST /api/generate-drafts`
- `PATCH /api/drafts/:id`
- `POST /api/publish/:draftId`
- `POST /api/cron/publish-due`

The Worker verifies Supabase user identity through `/auth/v1/user` before user-owned reads and writes.

## Existing Cron Jobs

Cron is registered in `cloudflare/workers/viral-os/wrangler.toml`.

```toml
[triggers]
crons = ["*/5 * * * *"]
```

The scheduled handler calls `publishDue(env)`, which processes due queued publish jobs.

## Supabase Migration Verification

Migration file:

- `supabase/migrations/202606130001_viral_os_mvp.sql`

Compared against:

- `spec/database-schema.sql`

Result:

- Schema content matches the specification.
- Only a trailing file-ending difference was detected by `Compare-Object`.

Tables present:

- `profiles`
- `research_briefs`
- `research_sources`
- `viral_elements`
- `post_drafts`
- `publish_jobs`
- `audit_events`

RLS policies are present for user-owned records.

## Import / Route Verification

Static import check:

- `viral-os/app/page.tsx` imports from `../lib/api` and `../lib/types`.
- `viral-os/lib/api.ts` imports from `./types`.
- Package dependencies include `next`, `react`, `react-dom`, and `@supabase/supabase-js`.

JSON config validation passed for:

- `viral-os/package.json`
- `viral-os/tsconfig.json`

Full compile/build was not run because this workspace does not have `npm` on PATH and `node_modules` is not installed.

## OpenAI Integration

Implemented in Worker:

- Endpoint: `https://api.openai.com/v1/responses`
- Auth: `Authorization: Bearer ${OPENAI_API_KEY}`
- Model: `OPENAI_MODEL || "gpt-5-mini"`
- Timeout: 15 seconds through `fetchWithTimeout`
- Output mode: JSON object
- Usage:
  - research extraction fallback path
  - observation/draft/scoring generation path

OpenAI failure falls back to local generation for MVP continuity.

## Tavily Integration

Implemented in Worker:

- Endpoint: `https://api.tavily.com/search`
- Auth: `Authorization: Bearer ${TAVILY_API_KEY}`
- Body includes `api_key`, `query`, `search_depth`, and `max_results`
- Timeout: 15 seconds through `fetchWithTimeout`
- Results are deduped before storage.
- Sources are scored with priority, weight, reliability, and impact.

## Threads Integration

Implemented in Worker:

- Create endpoint: `https://graph.threads.net/v1.0/me/threads`
- Publish endpoint: `https://graph.threads.net/v1.0/me/threads_publish`
- Auth: `THREADS_ACCESS_TOKEN`
- Payload is text-only with `media_type: "TEXT"`

Human approval guard:

- Publish requires status `approved` or `scheduled`.
- Publish requires `approved_by`.
- Publish requires `approved_at`.
- Rejected and unapproved drafts are rejected before Threads API calls.

## Missing Environment Variables

Cloudflare Pages:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_WORKER_BASE_URL`

Cloudflare Worker:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `TAVILY_API_KEY`
- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `THREADS_ACCESS_TOKEN`
- `ALLOWED_ORIGIN`

## Missing Secrets

Required Worker secrets before production:

- `SUPABASE_SERVICE_ROLE_KEY`
- `TAVILY_API_KEY`
- `OPENAI_API_KEY`
- `THREADS_ACCESS_TOKEN`

Optional or platform setup values listed by spec:

- `THREADS_CLIENT_ID`
- `THREADS_CLIENT_SECRET`

## Remaining Blockers Before Deployment

- Install dependencies and run `npm run typecheck`.
- Run `npm run build`.
- Run Cloudflare Pages build through the configured OpenNext command.
- Deploy Worker with required secrets.
- Apply Supabase migration to the target project.
- Configure Supabase Auth redirect URLs for the Pages domain.
- Validate live Tavily search with the deployed Worker.
- Validate live OpenAI Responses API call with the deployed Worker.
- Validate Threads text publish with a manually approved draft.
- Confirm Meta/Threads app review and token validity for the single Threads account.

## Deployment Readiness Status

Status: implementation ready, deployment validation pending external credentials and package installation.

The MVP implementation matches the requested architecture and routes at static review level. Production readiness depends on dependency installation, build execution, Cloudflare deployment, Supabase migration application, and live API credential validation.
