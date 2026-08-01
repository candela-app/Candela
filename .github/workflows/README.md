# Production Build and Deploy

Workflow: [`deploy.yml`](./deploy.yml) — display name **Production Build and Deploy**

One pipeline, one place — runs only when code is merged (pushed) to `main`.

| Event | What runs |
|-------|-----------|
| Pull request | Nothing |
| Push / merge → `main` | CI Build → Deploy Vercel + Deploy Render |

If CI fails, deploys are skipped.

Deploy credentials come from **GitHub → Settings → Secrets and variables → Actions** (nothing sensitive in the repo).

### Secrets

| Name | Used by | How to get it |
|------|---------|----------------|
| `VERCEL_TOKEN` | Deploy Vercel | [Vercel Account Tokens](https://vercel.com/account/tokens) → Create |
| `VERCEL_ORG_ID` | Deploy Vercel | Vercel project → Settings → General → Org / Team ID |
| `VERCEL_PROJECT_ID` | Deploy Vercel | Same page → Project ID |
| `RENDER_DEPLOY_HOOK_URL` | Deploy Render | Render service → Settings → Deploy Hook → copy URL |

### Variables (optional, non-sensitive)

Use **Actions → Variables** for public config later (e.g. `NEXT_PUBLIC_API_URL`). Reference as `${{ vars.NAME }}`. None required yet.

### Runtime env (on the platforms, not in Actions)

| Platform | Env |
|----------|-----|
| Render | `DATABASE_URL`, `NODE_ENV=production` |
| Vercel | any `NEXT_PUBLIC_*` when you add them |

## Dashboard toggles (avoid double deploys)

**Vercel (`candela-app`):**
- Root Directory: `apps/candela-app`
- Framework: Next.js
- Disable automatic Git production deploys (Actions deploys via CLI)

**Render (`candela-backend`):**
- Branch: `main`
- Build Command: `cd apps/candela-backend && npm install && npm run build`
- Start Command: `cd apps/candela-backend && node dist/main.js`
- Env: `DATABASE_URL` (Neon pooler), `NODE_ENV=production`
- **Auto-Deploy: Off** — Actions triggers the Deploy Hook after CI on `main`

## Release flow

1. Branch from `develop` → PR → merge to `develop`
2. PR `develop` → `main` → merge
3. One Actions run on `main`: CI then Vercel + Render deploy
4. Confirm:
   - Actions green (`CI Build` → both deploys)
   - Vercel production updated
   - Render deploy from the hook
   - `GET https://<render-host>/api/health` → `database: connected`
   - Vercel URL loads the app
