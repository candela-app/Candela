# CI/CD — GitHub Actions

Workflow: [`deploy.yml`](./deploy.yml)

Deploy jobs pull **all deploy credentials from GitHub Actions secrets** — nothing sensitive is committed to the repo.

| Event | CI build | Deploy Vercel | Deploy Render |
|-------|----------|---------------|---------------|
| Pull request → `main` | Yes | No | No |
| Push / merge → `main` | Yes | Yes | Yes |

## Where to put secrets / variables

GitHub repo → **Settings → Secrets and variables → Actions**

### Secrets (sensitive — encrypted)

| Name | Used by | How to get it |
|------|---------|----------------|
| `VERCEL_TOKEN` | Deploy Vercel | [Vercel Account Tokens](https://vercel.com/account/tokens) → Create |
| `VERCEL_ORG_ID` | Deploy Vercel | Vercel project → Settings → General → Org / Team ID |
| `VERCEL_PROJECT_ID` | Deploy Vercel | Same page → Project ID |
| `RENDER_DEPLOY_HOOK_URL` | Deploy Render | Render service → Settings → Deploy Hook → copy URL |

The workflow maps these into job `env` so the Vercel CLI / `curl` pick them up automatically:

```yaml
env:
  VERCEL_TOKEN: ${{ secrets.VERCEL_TOKEN }}
  VERCEL_ORG_ID: ${{ secrets.VERCEL_ORG_ID }}
  VERCEL_PROJECT_ID: ${{ secrets.VERCEL_PROJECT_ID }}
  RENDER_DEPLOY_HOOK_URL: ${{ secrets.RENDER_DEPLOY_HOOK_URL }}
```

### Variables (optional, non-sensitive)

Use **Actions → Variables** for public config later (e.g. `NEXT_PUBLIC_API_URL`). Reference as `${{ vars.NAME }}` in the workflow. None required for the first deploy.

### Not stored in GitHub Actions

Runtime app secrets for the **running** services stay on the host platforms (Actions only *triggers* deploy):

| Platform | Env to set in dashboard |
|----------|-------------------------|
| Render | `DATABASE_URL`, `NODE_ENV=production` |
| Vercel | any `NEXT_PUBLIC_*` app env when you add them |

## Dashboard toggles (avoid double deploys)

**Vercel (`candela-app`):**
- Root Directory: `apps/candela-app`
- Framework: Next.js
- Disable automatic Git production deploys (Actions deploys via CLI)

**Render (`candela-backend`):**
- Branch: `main`
- Root Directory: `apps/candela-backend`
- Build Command: `npm install && npm run build`
- Start Command: `node dist/main.js`
- Env: `DATABASE_URL` (Neon pooler), `NODE_ENV=production`
- **Auto-Deploy: Off** — Actions triggers the Deploy Hook after CI passes

## First-deploy checklist

1. Add the four **Secrets** above under GitHub → Settings → Secrets and variables → Actions.
2. Confirm Vercel root directory + Render build/start/env as listed.
3. Turn off Vercel Git auto-deploy and Render Auto-Deploy.
4. Merge a PR to `main` (or push to `main`).
5. Confirm:
   - GitHub Actions run is green (`CI Build` → `Deploy Vercel` + `Deploy Render`)
   - Vercel shows a new **Production** deployment
   - Render shows a deploy started from the hook
   - `GET https://<your-render-host>/api/health` → `{ "status": "ok", "database": "connected", ... }`
   - Vercel production URL loads the Next app
