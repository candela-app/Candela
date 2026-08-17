# Production Build and Deploy

Workflow: [`deploy.yml`](./deploy.yml) — display name **Production Build and Deploy**

One pipeline, one place — runs only when code is merged (pushed) to `main`.

| Event | What runs |
|-------|-----------|
| Pull request | Nothing |
| Push / merge → `main` | CI Build → Deploy Vercel + Deploy Render (parallel) |
| Push / merge → `main` (mobile paths only) | Also: EAS Android APK build |

If CI fails, deploys and mobile APK build are skipped.

**Slack:** `#web-app` gets frontend + backend deploy notifications. `#mobile-app` gets APK build notifications (only when `apps/candela-mobile/**` or `packages/shared/**` changed).

Deploy credentials come from **GitHub → Settings → Secrets and variables → Actions** (nothing sensitive in the repo).

### Secrets

| Name | Used by | How to get it |
|------|---------|----------------|
| `VERCEL_TOKEN` | Deploy Vercel | [Vercel Account Tokens](https://vercel.com/account/tokens) → Create |
| `VERCEL_ORG_ID` | Deploy Vercel | Vercel project → Settings → General → Org / Team ID |
| `VERCEL_PROJECT_ID` | Deploy Vercel | Same page → Project ID |
| `RENDER_DEPLOY_HOOK_URL` | Deploy Render | Render service → Settings → Deploy Hook → copy URL |
| `SLACK_WEBHOOK_URL_WEB` | Slack `#web-app` | Incoming Webhook for web deploy notifications |
| `SLACK_WEBHOOK_URL_MOBILE` | Slack `#mobile-app` | Incoming Webhook for EAS APK build notifications |
| `EXPO_TOKEN` | EAS Build (mobile job) | [expo.dev → Access tokens](https://expo.dev/settings/access-tokens) |

### Variables (optional, non-sensitive)

Use **Actions → Variables** for public config later (e.g. `NEXT_PUBLIC_API_URL`). Reference as `${{ vars.NAME }}`. None required yet.

### Runtime env (on the platforms, not in Actions)

| Platform | Env |
|----------|-----|
| Render | `DATABASE_URL`, `NODE_ENV=production`, `FRONTEND_URL`, `JWT_ACCESS_SECRET`, `ADMIN_1_*` (and `ADMIN_2_*` if needed). Set `ADMIN_SEED_OVERWRITE=true` only while rotating passwords. |
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
3. One Actions run on `main`: CI then Vercel + Render deploy (+ mobile APK if mobile/shared changed)
4. Confirm:
   - Actions green (`CI Build` → both deploys)
   - Slack `#web-app` shows frontend/backend started/succeeded (or failed)
   - Vercel production updated
   - Render deploy from the hook
   - `GET https://<render-host>/api/health` → `database: connected`
   - Vercel URL loads the app
   - If mobile changed: `#mobile-app` shows APK build + download link

### Mobile APK (first time)

From `apps/candela-mobile`: `eas login` → `eas init` → commit `projectId` in `app.json`. Set `EXPO_TOKEN` in GitHub secrets before the first CI build.
