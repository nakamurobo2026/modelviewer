# Viral OS MVP API Contracts

All application API routes are implemented through Cloudflare Workers. The Next.js app calls Workers, and Workers call Supabase, Tavily, OpenAI, and Threads API.

## Auth
- Client authenticates with Supabase Auth.
- Client sends Supabase access token to Worker.
- Worker verifies user identity before reading or writing user-owned records.

## POST /api/research
Create a research brief from a topic.

Request:
```json
{
  "topic": "地方スーパーの閉店前",
  "persona": "違和感ノート"
}
```

Response:
```json
{
  "success": true,
  "briefId": "uuid",
  "summary": "...",
  "sources": [
    {
      "sourceType": "threads|web|news|blog|note|reddit|official",
      "priority": "S|A|B|C",
      "weight": 0.8,
      "url": "https://...",
      "title": "...",
      "summary": "...",
      "reliability": 82,
      "impact": 66
    }
  ],
  "viralElements": [
    {
      "elementType": "hook|empathy|discomfort|comment_trigger|phrase|angle",
      "value": "...",
      "score": 87
    }
  ]
}
```

## POST /api/generate-drafts
Generate Threads-only post drafts from a research brief.

Request:
```json
{
  "briefId": "uuid",
  "count": 20,
  "persona": "違和感ノート"
}
```

Response:
```json
{
  "success": true,
  "drafts": [
    {
      "id": "uuid",
      "text": "17時過ぎのスーパー、レジ音だけ残って棚が少し暗く見える",
      "category": "observation",
      "hookType": "違和感",
      "scoreTotal": 84,
      "scoreDetail": {
        "specificity": 91,
        "commentPotential": 80,
        "humanity": 82,
        "novelty": 78,
        "risk": 10
      },
      "sourceTrace": ["source_uuid"]
    }
  ]
}
```

## PATCH /api/drafts/:id
Edit, approve, reject, or schedule a draft.

Request:
```json
{
  "text": "...",
  "status": "approved",
  "scheduledAt": "2026-06-13T12:00:00+09:00"
}
```

Response:
```json
{
  "success": true,
  "draft": {
    "id": "uuid",
    "status": "approved",
    "approvedAt": "2026-06-13T03:00:00Z"
  }
}
```

## POST /api/publish/:draftId
Manual publish action. Only approved drafts may publish.

Response:
```json
{
  "success": true,
  "threadsPostId": "threads_id",
  "publishedAt": "2026-06-13T03:00:00Z"
}
```

## POST /api/cron/publish-due
Called by Cloudflare Cron. Publishes approved scheduled posts whose schedule time has passed.

Response:
```json
{
  "success": true,
  "checked": 12,
  "published": 3,
  "failed": 0
}
```

## Error Shape
```json
{
  "success": false,
  "error": {
    "code": "HUMAN_APPROVAL_REQUIRED",
    "message": "Draft must be approved before publishing.",
    "details": {}
  }
}
```
