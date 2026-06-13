# Viral OS MVP Deployment Guide

## 1. Supabase
1. Create a Supabase project.
2. Run `spec/database-schema.sql`.
3. Enable Supabase Auth.
4. Configure allowed redirect URLs for the Cloudflare Pages domain.
5. Store service role key only in Cloudflare Worker secrets.

## 2. Cloudflare Pages
1. Connect the GitHub repository.
2. Framework preset: Next.js.
3. Build command: `npm run build`.
4. Output: Next.js / Cloudflare adapter output.
5. Environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_WORKER_BASE_URL`

## 3. Cloudflare Workers
Worker secrets:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `TAVILY_API_KEY`
- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `THREADS_CLIENT_ID`
- `THREADS_CLIENT_SECRET`
- `THREADS_ACCESS_TOKEN`

Worker routes:
- `/api/research`
- `/api/generate-drafts`
- `/api/drafts/:id`
- `/api/publish/:draftId`
- `/api/cron/publish-due`

## 4. Cloudflare Cron
Schedule:
- Every 5 minutes for `publish-due`.

Cron rule:
```toml
[triggers]
crons = ["*/5 * * * *"]
```

## 5. Threads API
1. Create Meta app with Threads API access.
2. Connect one Threads account only.
3. Store token securely in Worker secrets.
4. Worker must validate draft approval before publish.

## 6. Safety Checks
Before production:
- Verify unapproved draft cannot publish.
- Verify rejected draft cannot publish.
- Verify scheduled post publishes only after schedule time.
- Verify failed publish job records error details.
- Verify generated posts do not copy source text verbatim.
