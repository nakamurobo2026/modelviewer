# Viral OS MVP Acceptance Validation

Validation targets used: all files in `/acceptance`.

## Global Rules
- Human approval guard exists in Worker publish paths.
- UI exposes Threads-only wording and no image generation, multi-account, X, Instagram, or TikTok controls.

## Research
- `POST /api/research` calls Tavily and stores research briefs, sources, viral elements, and audit events.
- Source URLs are deduped before storage.

## Drafts
- `POST /api/generate-drafts` stores scored drafts with text, category, hook type, score details, and source trace.
- Drafts are stored as `scored`, not approved.
- Draft generation is text-only.

## Approval
- `PATCH /api/drafts/:id` writes `approved_by` and `approved_at`.
- Publish and schedule paths reject drafts without approval metadata.
- Rejected drafts cannot publish.

## Scheduling
- Scheduling an approved draft creates a queued publish job.
- Cloudflare Cron runs every five minutes and processes due jobs.
- Threads failures are saved on both draft and job records.

## Audit
- Research creation, draft generation, approval/rejection/schedule, and publish success/failure create audit events.

## Dashboard / Analytics / Learning
- `GET /api/dashboard` returns drafts, research briefs, publish jobs, audit events, and aggregate metrics for the authenticated operator.
- Dashboard shows approval, schedule, failure, published, average score, source-backed draft, recent research, and learning pipeline/audit state.
- Learning data is limited to MVP-safe stored signals: source traces, scores, publish outcomes, failures, and audit events.

## External Readiness
- Tavily, OpenAI, and Threads calls are implemented through Cloudflare Worker only.
- Tavily, OpenAI, and Threads network calls use a 15 second timeout.
- Live end-to-end validation requires deployed secrets and platform credentials.
