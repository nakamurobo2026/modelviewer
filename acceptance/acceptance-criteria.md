# Viral OS MVP Acceptance Criteria

## Global Rules
- The system never publishes without human approval.
- The system supports Threads only.
- The UI does not expose image generation.
- The UI does not expose multi-account controls.
- The UI does not expose X, Instagram, or TikTok integrations.

## Research
- Given a topic, when the user starts research, then Tavily results are stored as research sources.
- Given research sources, when extraction completes, then viral elements are stored.
- Given duplicate URLs, when sources are saved, then duplicates are not shown as separate high-impact sources.

## Drafts
- Given a research brief, when the user generates drafts, then each draft has text, category, hook type, score, and source trace.
- Given generated drafts, then no draft is automatically approved.
- Given generated drafts, then each draft is Threads suitable and text-only.

## Approval
- Given a scored draft, when the user approves it, then `approved_by` and `approved_at` are saved.
- Given an unapproved draft, when publish is requested, then the Worker rejects it.
- Given a rejected draft, when publish is requested, then the Worker rejects it.

## Scheduling
- Given an approved draft with a future schedule, then a publish job is created.
- Given a due approved scheduled draft, when cron runs, then the Worker attempts Threads publish.
- Given Threads API failure, then the draft and job store failure details.

## Audit
- Research creation, draft generation, approval, schedule, publish success, and publish failure create audit events.
