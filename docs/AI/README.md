
---

## 8) `docs/AI/README.md`
```markdown
# AI Overview

The platform integrates Google Gemini for:
- **AI-Assisted Planning**: capacity-aware assignment hints.
- **Natural Language Console**: English Q&A over logistics.
- **Delay Reasoning**: simple ETA risk analysis.
- **Snapshot Caching**: token/time-efficient analytics.

## Runtime
- Next.js (App Router) with `export const runtime = 'nodejs'` on AI routes.

## Key Helpers
- `askGeminiWithRetry(prompt: string): Promise<string>`
- `isQuotaError(e: unknown): boolean`

## High-level Flow
1. User asks a question (optionally with `useDb: true`).
2. App builds **safe prompt** with schema + samples.
3. If `useDb`, Prisma fetches relevant rows; model grounds answers.
4. AI returns structured text; UI renders answer + explanations.

## Endpoints
- `/api/ai/answer`, `/api/ai/chat`
- `/api/ai/plan-hint`, `/api/voyages/ai-assign`
- `/api/ai/predict-delay`
- `/api/ai/test` (GET/POST)



