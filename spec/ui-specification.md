# Viral OS MVP UI Specification

## Design Principles
- Operational, not decorative.
- Dense enough for daily use.
- Clear approval boundaries.
- Threads-only language.
- Every generated draft must show why it was generated.

## Main Navigation
- Dashboard
- Research
- Drafts
- Approval Queue
- Schedule
- Settings

## Dashboard
Shows:
- Drafts awaiting approval
- Scheduled posts
- Failed publish jobs
- Recent research briefs
- Threads connection status

Primary actions:
- New research
- Generate drafts
- Review queue

## Research Screen
Inputs:
- Topic
- Persona

Outputs:
- Research Summary
- Source table
- Viral elements
- Recommended post angles
- Risk notes

Source table columns:
- Priority
- Source type
- Title
- URL
- Reliability
- Impact
- Extracted elements

## Draft Generation Screen
Inputs:
- Research brief
- Count
- Persona

Draft card:
- Post text
- Category
- Hook type
- Score
- Score breakdown
- Source trace
- Edit button
- Approve button
- Reject button
- Schedule button

## Approval Queue
Only drafts in `scored` state appear.

Required user actions:
- Approve
- Reject
- Edit
- Schedule

Approval warning:
- "Publishing is impossible until a human approves this draft."

## Schedule Screen
Shows:
- Calendar list
- Approved scheduled drafts
- Publish job status
- Retry controls for failed jobs

## Settings
Shows:
- Supabase user profile
- Threads connection
- API health checks
- Cron status

Hidden / unavailable in MVP:
- Image generation
- Multi-account switching
- X integration
- Instagram integration
- TikTok integration
