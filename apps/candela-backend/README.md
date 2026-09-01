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

1. Copy `.env.example` → `.env` and fill Supabase URLs + JWT secrets.
2. Apply schema (uses `DATABASE_URL_DIRECT`):

```bash
npm run migration:run
```

3. Set `ADMIN_1_EMAIL` / `ADMIN_1_PASSWORD` (and optional `ADMIN_2_*`) in `.env`, then seed:

```bash
npm run seed:admins
```

Startup also seeds from those env vars if the accounts are missing. Confirm with `GET http://localhost:3001/api/health` → `database: connected`.

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
| `DATABASE_URL` | yes | Supabase **session pooler** (app runtime) |
| `DATABASE_URL_DIRECT` | yes | Supabase **session pooler** (migrations; use the `db.*` direct host only if your network has IPv6) |
| `JWT_ACCESS_SECRET` | yes | Signs access JWTs |
| `JWT_REFRESH_SECRET` | unused | Reserved; refresh tokens are opaque hashes today |
| `ADMIN_1_EMAIL` / `ADMIN_1_PASSWORD` / `ADMIN_1_NAME` | seed | First admin; extra admins use `ADMIN_2_*` … `ADMIN_9_*` |
| `ADMIN_SEED_OVERWRITE` | no | `true` updates passwords for emails that already exist; leave `false` after rotating |
| `MAIL_TRANSPORT` | no | `smtp` to send, `log` to print confirm links locally |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `MAIL_FROM` | for smtp | Placeholders only in `.env.example`. Real values in local `.env` / Render |
| `SUPABASE_URL` | Familiar Faces | Project URL |
| `SUPABASE_SECRET_KEY` | Familiar Faces | Server-only secret key — never put this on the website |
| `SUPABASE_STORAGE_BUCKET` | no | Default `familiar-faces` |

DocID attach/change/transfer: [docs/DOCID_AND_MAIL.md](../../docs/DOCID_AND_MAIL.md).

Production deploy (Render) is documented in [`.github/workflows/README.md`](../../.github/workflows/README.md).
