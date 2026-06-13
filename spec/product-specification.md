# Viral OS MVP Product Specification

## Purpose
Viral OS is a Threads-only operating system for turning market signals into approved, scheduled post drafts. The MVP focuses on a controlled workflow: research, insight extraction, post generation, scoring, human approval, and queueing. It does not publish without explicit human approval.

## Stack
- Next.js 15 with App Router
- TypeScript
- TailwindCSS
- Cloudflare Pages for the web app
- Cloudflare Workers for API orchestration
- Cloudflare Cron Triggers for scheduled background jobs
- Supabase for auth, database, storage of drafts, approvals, and schedules
- Tavily for web research
- OpenAI API for analysis, observation extraction, scoring, and draft generation
- Threads API for approved Threads publishing only

## Product Rules
- Human approval is required before any Threads post is published.
- Threads is the only publishing target.
- No image generation.
- No multi-account support in MVP.
- No X integration.
- No Instagram integration.
- No TikTok integration.
- Research may reference public web content but generated posts must be original.
- Source content must not be copied verbatim into generated posts.
- Every generated post must carry traceable source summaries and scoring metadata.

## MVP User
The MVP user is a single operator managing one Threads presence. They need fast research, grounded post ideas, approval control, and predictable scheduling without handling raw API details.

## Core Workflow
1. User enters a topic or selects an existing research brief.
2. Worker calls Tavily to collect public source material.
3. OpenAI extracts viral elements, observations, hooks, angles, and risk notes.
4. OpenAI generates Threads-only post drafts.
5. Buzz Judge scores drafts for specificity, comment potential, humanity, novelty, and brand fit.
6. User approves, rejects, edits, or schedules drafts.
7. Cron checks approved scheduled posts.
8. Worker publishes approved due posts to Threads API.
9. Results and post status are saved to Supabase.

## MVP Features
- Single workspace
- Topic-driven research
- Research source list with priority and reliability
- Viral element extraction
- Observation-driven post generation
- Draft scoring
- Draft editing
- Human approval
- Schedule queue
- Threads publish worker
- Cron-based due-post processor
- Audit log
- Failure and retry states

## Out of Scope
- Image generation
- Media upload
- Multi-account management
- X, Instagram, TikTok integrations
- Autonomous publishing without approval
- Team permissions
- Billing
- Analytics ingestion from Threads beyond publish status

## Success Metrics
- 95% of generated drafts are under 500 characters.
- 100% of published posts have a prior human approval record.
- 100% of generated posts store source summaries.
- Due approved posts publish within 5 minutes of schedule under normal operation.
- Failed publishing jobs expose actionable error states in the UI.
