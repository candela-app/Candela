# Deployment & Environment Configuration Guide

## 1. Architecture Deployment Topology

```mermaid
graph LR
    Vercel["Frontend: Next.js (Vercel)\nhttps://candela-app.vercel.app"]
    Render["Backend: NestJS (Render)\nhttps://candela-backend-gbdz.onrender.com"]
    Supabase["Database: PostgreSQL + Storage (Supabase)"]

    Vercel -->|HTTPS + withCredentials| Render
    Render -->|TypeORM Connection Pool| Supabase
```

---

## 2. Environment Variables

### Backend (`apps/candela-backend/.env`)

| Variable | Required | Description | Example / Default |
|---|---|---|---|
| `PORT` | Optional | Port for the NestJS server | `4000` |
| `NODE_ENV` | Yes | Environment mode | `production` or `development` |
| `DATABASE_URL` | Yes | Supabase session pooler for runtime queries | `postgresql://postgres.PROJECT_REF:PASSWORD@aws-0-REGION.pooler.supabase.com:5432/postgres?sslmode=require` |
| `DATABASE_URL_DIRECT` | Yes | Same pooler for TypeORM migrations (direct `db.*` host is often IPv6-only) | `postgresql://postgres.PROJECT_REF:PASSWORD@aws-0-REGION.pooler.supabase.com:5432/postgres?sslmode=require` |
| `JWT_ACCESS_SECRET` | Yes | Secret key for signing access tokens | long random string (never commit the real value) |
| `FRONTEND_URL` | Yes | Website origin for CORS | `https://candela-app-eta.vercel.app` |
| `ADMIN_1_EMAIL` / `ADMIN_1_PASSWORD` | Seed | First admin; add `ADMIN_2_*` for more | set on Render / local `.env` only |
| `ADMIN_SEED_OVERWRITE` | No | `true` updates existing admin passwords from env | `false` |
| `MAIL_TRANSPORT` | No | `smtp` (default for sending), `log` (print links, no send) | `smtp` |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` | If `smtp` | SMTP mailbox. Use an app password. Never commit real values | `smtp.gmail.com` / `587` |
| `SMTP_SECURE` | No | `true` for port 465 | `false` |
| `MAIL_FROM` | No | From header; defaults to `SMTP_USER` | same as SMTP user |
| `DOC_ID_REQUEST_TTL_HOURS` | No | Confirm-link lifetime | `48` |
| `GOOGLE_CLIENT_ID_WEB` | Google Sign-In | Web OAuth client ID | `….apps.googleusercontent.com` |
| `GOOGLE_CLIENT_ID_ANDROID` | Google Sign-In | Android OAuth client ID | `….apps.googleusercontent.com` |

### Frontend (`apps/candela-app/.env.local` / Vercel Environment)

| Variable | Required | Description | Example / Default |
|---|---|---|---|
| `NEXT_PUBLIC_API_URL` | Yes | Public API endpoint of the backend | `https://candela-backend-gbdz.onrender.com` |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Google Sign-In | Same as `GOOGLE_CLIENT_ID_WEB` (public) | web client ID |

---

## 3. Production Deployment Notes

### Cross-Domain Cookie Authentication
- When frontend and backend run on different domains (e.g. `*.vercel.app` and `*.onrender.com`), browsers enforce third-party cookie restrictions unless:
  1. `sameSite: 'none'`
  2. `secure: true`
  3. `credentials: 'include'` (in all `fetch` / `api()` client requests)
  4. Backend reflects matching `Access-Control-Allow-Origin` (not wildcard `*`) with `Access-Control-Allow-Credentials: true`.

### Database Migrations
Run schema migrations against direct database connection:
```bash
npm run migration:run -w @candela/backend
```

### Initial Admin Seeding
Seed initial system administrators on first startup or via script:
```bash
npm run seed:admins -w @candela/backend
```

---

## 4. GitHub Actions & Slack

Production deploys run on every push to `main` (`.github/workflows/deploy.yml`).

| Secret | Purpose |
|---|---|
| `SLACK_WEBHOOK_URL_WEB` | `#web-app` — frontend (Vercel) and backend (Render) deploy notifications |
| `SLACK_WEBHOOK_URL_MOBILE` | `#mobile-app` — EAS Android APK build notifications |
| `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` | Vercel CLI deploy |
| `RENDER_DEPLOY_HOOK_URL` | Render backend deploy hook |
| `EXPO_TOKEN` | EAS APK — candelaapp (first) |
| `EXPO_TOKEN_BACKUP1` | EAS APK — satvik-27s-team if candelaapp quota is exhausted |
| `EXPO_TOKEN_BACKUP2` | EAS APK — srisais-team if the first two are exhausted |

**Web channel:** started / succeeded / failed for Vercel frontend; started / triggered / failed for Render backend hook.

**Mobile channel:** APK build runs only when `apps/candela-mobile/**` or `packages/shared/**` change. Success message includes the expo.dev build page and direct APK URL.

Never commit webhook URLs or tokens to the repo.
