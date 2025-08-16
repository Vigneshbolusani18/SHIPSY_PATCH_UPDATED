
---

## 4) `docs/TROUBLESHOOTING.md`
```markdown
# Troubleshooting

## Database
- **Connection error**: check `DATABASE_URL`. Try `npx prisma db pull`.
- **Migrations stuck**: run `npx prisma migrate resolve` cautiously.

## Gemini API
- Missing key → set `GEMINI_API_KEY`.
- 429 rate limit → implement exponential backoff in `askGeminiWithRetry`.
- Network issues → verify outbound firewall/HTTPS.

## Next.js Build
- Clear cache: `rm -rf .next && npm run build`.
- Slow FS warning on OneDrive → move project to a local path excluded from sync.

## AI Console Not Hitting DB
- Ensure `useDb: true` in request body.
- Confirm Prisma client generates: `npx prisma generate`.
- Validate Neon roles/permissions.

## Health Check
```bash
curl -s http://localhost:3000/api/ai/test | jq
