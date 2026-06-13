# Viral OS MVP State Machine

## Draft State Machine

```mermaid
stateDiagram-v2
  [*] --> draft
  draft --> scored: score generated
  scored --> approved: human approves
  scored --> rejected: human rejects
  scored --> draft: human edits
  approved --> scheduled: human sets schedule
  approved --> publishing: human publishes now
  scheduled --> publishing: cron finds due approved draft
  publishing --> published: Threads API success
  publishing --> failed: Threads API failure
  failed --> scheduled: human retries with schedule
  failed --> publishing: human retries now
  scheduled --> cancelled: human cancels
  rejected --> [*]
  published --> [*]
  cancelled --> [*]
```

## Guard Conditions
- `approved -> publishing` requires `approved_by` and `approved_at`.
- `scheduled -> publishing` requires `status = scheduled` and `scheduled_at <= now()`.
- `publishing -> published` requires Threads API success.
- `publishing -> failed` stores error details.
- No automated path may skip `approved`.

## Research State Machine

```mermaid
stateDiagram-v2
  [*] --> queued
  queued --> researching: Worker starts
  researching --> extracting: Tavily complete
  extracting --> summarized: OpenAI extraction complete
  summarized --> generating: user requests drafts
  generating --> scored: draft generation and scoring complete
  researching --> failed: Tavily failure
  extracting --> failed: OpenAI failure
  generating --> failed: generation failure
```

## Publish Job State Machine

```mermaid
stateDiagram-v2
  [*] --> queued
  queued --> running: cron lock acquired
  running --> succeeded: Threads post created
  running --> failed: API or validation failure
  failed --> queued: retry
  queued --> cancelled: draft cancelled
```
