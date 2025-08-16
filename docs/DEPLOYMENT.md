# Deployment Guide (Vercel Recommended)

## Prerequisites
- Node.js 18+
- Neon Postgres project
- Gemini API key
- Vercel account

## Env Vars (Vercel → Project → Settings → Environment Variables)
Copy from `.env.example`:
- `DATABASE_URL`
- `DIRECT_URL`
- `JWT_SECRET`
- `NEXTAUTH_URL`
- `NEXTAUTH_SECRET`
- `GEMINI_API_KEY`
- (Optional) `VERCEL_ANALYTICS_ID`

## Steps
1. **Push to GitHub**
2. **Import to Vercel** → New Project → pick repo
3. **Set environment variables**
4. **Build**
   - Vercel runs: `npm install` → `npm run build`
   - Post-install: `npx prisma generate`
5. **Migrations**
   - Option A: locally `npx prisma migrate deploy` then push DB
   - Option B: run a one-off job on Vercel using `npx prisma migrate deploy`
6. **Custom Domain (optional)**

## Local Dev
```bash
npm i
npx prisma generate
npx prisma migrate dev --name init
npm run dev
