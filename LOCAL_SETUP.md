# Viral OS Local Setup

These steps prepare the MVP for local validation before Cloudflare deployment.

## Requirements

- Node.js 20 or newer
- npm
- Cloudflare Wrangler access
- Supabase project access
- Tavily API key
- OpenAI API key
- Threads API access token for one account

## Repository Layout

```text
viral-os/                         Next.js 15 app
cloudflare/workers/viral-os/      Cloudflare Worker API and Cron
supabase/migrations/              Supabase schema migration
implementation/                   Implementation and readiness notes
```

## Install the Next.js App

```bash
cd viral-os
npm install
cp .env.example .env.local
```

Fill `viral-os/.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<supabase-anon-key>
NEXT_PUBLIC_WORKER_BASE_URL=http://127.0.0.1:8787
```

Run local checks:

```bash
npm run typecheck
npm run build
```

Run the local app:

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

## Install the Worker

```bash
cd cloudflare/workers/viral-os
npm install
cp .env.example .dev.vars
```

Fill `.dev.vars` for local Worker testing:

```env
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<supabase-service-role-key>
TAVILY_API_KEY=<tavily-api-key>
OPENAI_API_KEY=<openai-api-key>
OPENAI_MODEL=gpt-5-mini
THREADS_ACCESS_TOKEN=<threads-access-token>
ALLOWED_ORIGIN=http://localhost:3000
```

Run the Worker locally:

```bash
npx wrangler dev
```

The local Worker should be available at:

```text
http://127.0.0.1:8787
```

## Apply Supabase Migration

Apply:

```text
supabase/migrations/202606130001_viral_os_mvp.sql
```

Using the Supabase dashboard:

1. Open the target Supabase project.
2. Go to SQL Editor.
3. Paste the migration SQL.
4. Run it once.
5. Confirm all tables and RLS policies were created.

Using Supabase CLI, if configured:

```bash
supabase db push
```

## Supabase Auth Setup

Enable Magic Link sign-in and add redirect URLs:

```text
http://localhost:3000
https://<your-cloudflare-pages-domain>
```

The app uses the Supabase browser anon key for Auth and sends the session access token to the Worker.

## Verify Integrations Locally

1. Start the Worker:

```bash
cd cloudflare/workers/viral-os
npx wrangler dev
```

2. Start the app:

```bash
cd viral-os
npm run dev
```

3. In the app:

- Sign in with Magic Link.
- Refresh session.
- Enter a topic.
- Run research.
- Generate drafts.
- Approve a draft.
- Schedule a draft.

4. In Supabase, confirm rows are created in:

- `profiles`
- `research_briefs`
- `research_sources`
- `viral_elements`
- `post_drafts`
- `publish_jobs`
- `audit_events`

## Verify Wrangler Configuration

Worker config:

```text
cloudflare/workers/viral-os/wrangler.toml
```

Expected values:

```toml
name = "viral-os-api"
main = "src/index.ts"
compatibility_date = "2026-06-13"

[triggers]
crons = ["*/5 * * * *"]

[vars]
OPENAI_MODEL = "gpt-5-mini"
```

Pages config:

```text
viral-os/wrangler.toml
```

Expected values:

```toml
name = "viral-os-pages"
compatibility_date = "2026-06-13"
pages_build_output_dir = ".open-next/assets"
```

## Verify Next.js Build Configuration

Next config:

```text
viral-os/next.config.ts
```

Expected:

```ts
const nextConfig = {
  reactStrictMode: true,
};
```

Package scripts:

```json
{
  "build": "next build",
  "typecheck": "tsc --noEmit",
  "pages:build": "npx @opennextjs/cloudflare build",
  "pages:deploy": "npx wrangler pages deploy .open-next/assets --project-name viral-os"
}
```

## Known Local Limits

- Cloudflare Cron does not run automatically in the local app flow; test scheduled publishing through deployed Worker Cron or by calling `POST /api/cron/publish-due`.
- Threads publishing requires a valid token and Meta/Threads platform approval.
- Real Tavily, OpenAI, and Threads calls require live credentials.
