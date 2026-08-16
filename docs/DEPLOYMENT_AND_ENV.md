# Deployment & Environment Configuration Guide

## 1. Architecture Deployment Topology

```mermaid
graph LR
    Vercel["Frontend: Next.js (Vercel)\nhttps://candela-app.vercel.app"]
    Render["Backend: NestJS (Render)\nhttps://candela-backend.onrender.com"]
    Neon["Database: PostgreSQL (Neon Serverless)"]

    Vercel -->|HTTPS + withCredentials| Render
    Render -->|TypeORM Connection Pool| Neon
```

---

## 2. Environment Variables

### Backend (`apps/candela-backend/.env`)

| Variable | Required | Description | Example / Default |
|---|---|---|---|
| `PORT` | Optional | Port for the NestJS server | `4000` |
| `NODE_ENV` | Yes | Environment mode | `production` or `development` |
| `DATABASE_URL` | Yes | Pooled connection string for runtime queries | `postgresql://user:pass@ep-xyz-pooler.region.neon.tech/candela?sslmode=require` |
| `DATABASE_URL_DIRECT` | Yes | Direct connection string for TypeORM migrations | `postgresql://user:pass@ep-xyz.region.neon.tech/candela?sslmode=require` |
| `JWT_SECRET` | Yes | Secret key for signing Access Tokens | `min-32-character-cryptographic-secret` |
| `CORS_ORIGINS` | Optional | Comma-separated allowed frontend origins | `https://candela-app.vercel.app,http://localhost:3000` |
| `FRONTEND_URL` | Optional | Primary frontend URL | `https://candela-app.vercel.app` |

### Frontend (`apps/candela-app/.env.local` / Vercel Environment)

| Variable | Required | Description | Example / Default |
|---|---|---|---|
| `NEXT_PUBLIC_API_URL` | Yes | Public API endpoint of the backend | `https://candela-backend.onrender.com` |

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
npm run typeorm:migration:run -w @candela/backend
```

### Initial Admin Seeding
Seed initial system administrators on first startup or via script:
```bash
npm run seed:admins -w @candela/backend
```
