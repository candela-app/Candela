# candela-backend

Shared NestJS API for website, mobile, and TV.

Architecture, roles, data model, and HTTP endpoints: **[WALKTHROUGH.md](./WALKTHROUGH.md)**.

## Local run

From repo root (after `npm install`):

```bash
npm run dev:backend
```

Or from this folder:

```bash
npm run start:dev
```

Listens on `PORT` (default **3001**). Website (`candela-app`) rewrites `/api/*` here.

## First-time database

1. Copy `.env.example` → `.env` and fill Neon URLs + JWT secrets.
2. Apply schema (uses `DATABASE_URL_DIRECT`):

```bash
npm run migration:run
```

3. Insert admin users if the `users` table is empty:

```bash
npm run seed:admins
```

Startup also seeds the same admins if they are missing. Confirm with `GET http://localhost:3001/api/health` → `database: connected`.

## Scripts

| Script | What it does |
|--------|----------------|
| `npm run start:dev` / `dev` | Nest watch mode |
| `npm run build` | Compile to `dist/` |
| `npm start` | `node dist/main.js` (Render) |
| `npm run migration:run` | Run pending TypeORM migrations |
| `npm run seed:admins` | Idempotent insert of seeded admins |

## Environment

See `.env.example`. Do not commit `.env`.

| Name | Required | Purpose |
|------|----------|---------|
| `PORT` | no | Default `3001` |
| `FRONTEND_URL` | yes (CORS) | Website origin, e.g. `http://localhost:3000` |
| `DATABASE_URL` | yes | Neon **pooler** (app runtime) |
| `DATABASE_URL_DIRECT` | yes | Neon **direct** (migrations) |
| `JWT_ACCESS_SECRET` | yes | Signs access JWTs |
| `JWT_REFRESH_SECRET` | unused | Reserved; refresh tokens are opaque hashes today |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | unused | Replaced by `seed:admins` |

Production deploy (Render) is documented in [`.github/workflows/README.md`](../../.github/workflows/README.md).
