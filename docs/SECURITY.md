# Security Notes

## Auth
- JWT issued on login; stored as httpOnly cookie.
- Always validate JWT on 🔒 endpoints (`/me`, create/update/delete ops).

## Input Validation
- Use Zod schemas at API boundaries.
- Reject unknown/extra properties.

## AI Safety
- The AI Console only calls **whitelisted** DB queries via Prisma.
- No free-form SQL; sanitize user text; avoid prompt injection by constraining tools.

## Secrets
- Never log secrets.
- Keep keys in environment variables.

## Transport
- Enforce HTTPS in production.
