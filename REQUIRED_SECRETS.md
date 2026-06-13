# Viral OS Required Secrets

This file lists every environment variable and secret needed to deploy the Viral OS MVP.

Do not commit real secret values.

## Cloudflare Pages Variables

Set these for the Pages project that builds `viral-os/`.

| Name | Required | Secret | Example | Purpose |
| --- | --- | --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | No | `https://example.supabase.co` | Browser-side Supabase project URL. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | No | `eyJ...` | Browser-side Supabase anon key for Auth. |
| `NEXT_PUBLIC_WORKER_BASE_URL` | Yes | No | `https://viral-os-api.example.workers.dev` | Public URL for the Cloudflare Worker API. |

Local file:

```text
viral-os/.env.local
```

Template:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_WORKER_BASE_URL=
```

## Cloudflare Worker Variables

Worker directory:

```text
cloudflare/workers/viral-os
```

### Plaintext Variables

| Name | Required | Secret | Example | Purpose |
| --- | --- | --- | --- | --- |
| `SUPABASE_URL` | Yes | No | `https://example.supabase.co` | Supabase REST and Auth base URL. |
| `OPENAI_MODEL` | Yes | No | `gpt-5-mini` | OpenAI model used by the Worker. |
| `ALLOWED_ORIGIN` | Yes | No | `https://viral-os.pages.dev` | CORS origin for the deployed Pages app. |

### Worker Secrets

| Name | Required | Secret | Purpose |
| --- | --- | --- | --- |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Yes | Server-side Supabase REST access and Auth user verification. |
| `TAVILY_API_KEY` | Yes | Yes | Tavily research search. |
| `OPENAI_API_KEY` | Yes | Yes | OpenAI Responses API calls. |
| `THREADS_ACCESS_TOKEN` | Yes | Yes | Threads text publishing for the single approved account. |

Set secrets with:

```bash
cd cloudflare/workers/viral-os
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
npx wrangler secret put TAVILY_API_KEY
npx wrangler secret put OPENAI_API_KEY
npx wrangler secret put THREADS_ACCESS_TOKEN
```

Set plaintext variables in the Cloudflare dashboard or keep them in `wrangler.toml` for the target environment:

```toml
[vars]
SUPABASE_URL = "https://example.supabase.co"
OPENAI_MODEL = "gpt-5-mini"
ALLOWED_ORIGIN = "https://viral-os.pages.dev"
```

## Optional Platform Values

The current MVP publishes with `THREADS_ACCESS_TOKEN`. These values may be needed during Meta app setup or future token rotation workflows:

| Name | Required for MVP Runtime | Secret | Purpose |
| --- | --- | --- | --- |
| `THREADS_CLIENT_ID` | No | Yes | Meta/Threads app client ID for setup workflows. |
| `THREADS_CLIENT_SECRET` | No | Yes | Meta/Threads app client secret for setup workflows. |

## Environment Verification Matrix

| Capability | Variable Needed |
| --- | --- |
| Browser Supabase login | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| Browser to Worker API calls | `NEXT_PUBLIC_WORKER_BASE_URL`, `ALLOWED_ORIGIN` |
| Worker user verification | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` |
| Research Agent | `TAVILY_API_KEY`, `OPENAI_API_KEY`, `OPENAI_MODEL` |
| Draft generation and scoring | `OPENAI_API_KEY`, `OPENAI_MODEL`, `SUPABASE_SERVICE_ROLE_KEY` |
| Local fallback persistence | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` |
| Manual publish | `THREADS_ACCESS_TOKEN` |
| Scheduled publish | `THREADS_ACCESS_TOKEN`, Cloudflare Cron |

## Safety Rules

- Keep `SUPABASE_SERVICE_ROLE_KEY`, `TAVILY_API_KEY`, `OPENAI_API_KEY`, and `THREADS_ACCESS_TOKEN` only in Worker secrets.
- Do not expose service role, Tavily, OpenAI, or Threads tokens through `NEXT_PUBLIC_*`.
- Keep the browser app talking only to the Worker.
- Keep `ALLOWED_ORIGIN` restricted to the production Pages origin in production.
