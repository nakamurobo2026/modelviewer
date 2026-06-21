# Viral OS Deployment Checklist

Use this checklist to deploy the current Viral OS MVP without changing the specification files or adding product scope.

## Preflight

- [ ] Confirm the implementation branch is the PR branch for Viral OS MVP.
- [ ] Confirm `/spec`, `/agents`, and `/acceptance` are unchanged.
- [ ] Confirm `implementation/deployment-readiness-report.md` has been reviewed.
- [ ] Confirm the Supabase project, Cloudflare account, Tavily account, OpenAI project, and Meta Threads app are ready.
- [ ] Confirm the app remains Threads-only, text-only, single-account, and human-approval gated.

## Local Verification

Run these from `viral-os/` after installing dependencies:

```bash
npm install
npm run typecheck
npm run build
npm run pages:build
```

Expected result:

- TypeScript completes without errors.
- Next.js production build completes.
- OpenNext Cloudflare build creates `.open-next/assets`.

Run these from `cloudflare/workers/viral-os/`:

```bash
npm install
npx wrangler deploy --dry-run
```

Expected result:

- Worker config loads from `cloudflare/workers/viral-os/wrangler.toml`.
- Worker routes and Cron handler compile for Cloudflare Workers.

## Supabase

- [ ] Create or select the production Supabase project.
- [ ] Apply `supabase/migrations/202606130001_viral_os_mvp.sql`.
- [ ] Verify these tables exist:
  - `profiles`
  - `research_briefs`
  - `research_sources`
  - `viral_elements`
  - `post_drafts`
  - `publish_jobs`
  - `audit_events`
- [ ] Verify RLS is enabled and policies exist for user-owned records.
- [ ] Enable email Magic Link auth.
- [ ] Add the Cloudflare Pages production URL to Supabase Auth redirect URLs.
- [ ] Copy `SUPABASE_URL`, anon key, and service role key into the correct Cloudflare environments.

## Cloudflare Worker

Worker directory:

```text
cloudflare/workers/viral-os
```

Worker config:

```text
cloudflare/workers/viral-os/wrangler.toml
```

Expected Worker name:

```text
viral-os-api
```

Routes implemented:

- `GET /api/dashboard`
- `POST /api/research`
- `POST /api/generate-drafts`
- `PATCH /api/drafts/:id`
- `POST /api/publish/:draftId`
- `POST /api/cron/publish-due`

Cron registered:

```toml
[triggers]
crons = ["*/5 * * * *"]
```

Deployment steps:

```bash
cd cloudflare/workers/viral-os
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
npx wrangler secret put TAVILY_API_KEY
npx wrangler secret put OPENAI_API_KEY
npx wrangler secret put THREADS_ACCESS_TOKEN
npx wrangler deploy
```

Set non-secret Worker variables in Cloudflare or `wrangler.toml`:

- `SUPABASE_URL`
- `OPENAI_MODEL`
- `ALLOWED_ORIGIN`

Use:

```text
OPENAI_MODEL=gpt-5-mini
ALLOWED_ORIGIN=https://<your-cloudflare-pages-domain>
```

## Cloudflare Pages

Pages app directory:

```text
viral-os
```

Build command:

```bash
npm install && npm run pages:build
```

Build output directory:

```text
.open-next/assets
```

Set Pages environment variables:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_WORKER_BASE_URL`

After the Worker deploys, set:

```text
NEXT_PUBLIC_WORKER_BASE_URL=https://<viral-os-api-worker-domain>
```

Then deploy Pages:

```bash
cd viral-os
npm run pages:deploy
```

## Tavily

- [ ] Create or select a Tavily API key.
- [ ] Store it as the Worker secret `TAVILY_API_KEY`.
- [ ] Confirm `POST /api/research` returns sources when given a topic.
- [ ] Confirm research sources are saved in `research_sources`.

## OpenAI

- [ ] Create or select an OpenAI API key with Responses API access.
- [ ] Store it as the Worker secret `OPENAI_API_KEY`.
- [ ] Set `OPENAI_MODEL=gpt-5-mini`.
- [ ] Confirm `POST /api/generate-drafts` returns scored drafts.
- [ ] Confirm OpenAI failures fall back to local draft generation.

## Threads

- [ ] Create or select the Meta app with Threads API enabled.
- [ ] Complete any required Meta/Threads app review for publishing.
- [ ] Generate a valid single-account `THREADS_ACCESS_TOKEN`.
- [ ] Store it as the Worker secret `THREADS_ACCESS_TOKEN`.
- [ ] Confirm publishing is text-only.
- [ ] Confirm a draft cannot publish until it has human approval metadata.
- [ ] Validate one manually approved draft with `POST /api/publish/:draftId`.

## Production Smoke Test

- [ ] Open the Cloudflare Pages URL.
- [ ] Sign in with Supabase Magic Link.
- [ ] Refresh session and load Dashboard.
- [ ] Create research from a topic.
- [ ] Generate drafts from the research brief.
- [ ] Approve one draft.
- [ ] Schedule one approved draft.
- [ ] Confirm Cron publishes due queued jobs.
- [ ] Confirm publish success or failure is written to `post_drafts`, `publish_jobs`, and `audit_events`.

## Known External Blockers

These cannot be resolved in code:

- Cloudflare project and domain configuration.
- Supabase project credentials and Auth redirect configuration.
- Tavily API key availability.
- OpenAI API key availability and model access.
- Threads API app review, token validity, and publish permissions.
