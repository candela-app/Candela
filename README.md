# Candela

Precision visual and cognitive therapy across web and mobile, with a shared NestJS backend.

## Monorepo

| Path | Role |
|---|---|
| `apps/candela-app` | Next.js website and role applications |
| `apps/candela-backend` | Authoritative API (auth, ownership, sessions, invitations, audit) |
| `apps/candela-mobile` | Expo / React Native app |
| `apps/candela-tv` | TV client (future) |
| `packages/shared` | Catalog, scoring, profile/trial contracts |

Game walkthroughs live next to modules under `apps/candela-app/src/components/*/WALKTHROUGH.md`. Backend walkthrough: [`apps/candela-backend/WALKTHROUGH.md`](apps/candela-backend/WALKTHROUGH.md). Mobile: [`apps/candela-mobile/README.md`](apps/candela-mobile/README.md).

## Documentation

| Doc | Use |
|---|---|
| [`docs/README.md`](docs/README.md) | Documentation index |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | System architecture, relationships, diagrams |
| [`docs/AUTH_AND_ROLES_FLOW.md`](docs/AUTH_AND_ROLES_FLOW.md) | Roles, login, invitations, Option C, scoping |
| [`docs/DEPLOYMENT_AND_ENV.md`](docs/DEPLOYMENT_AND_ENV.md) | Env vars, migrations, email/OAuth/Supabase status |
| [`docs/CANDELA_ARCHITECTURE_CHANGE_LOG.md`](docs/CANDELA_ARCHITECTURE_CHANGE_LOG.md) | Chronological architecture decisions (Entries 002–005) |
| [`docs/SESSION_METRICS_AND_ANALYTICS.md`](docs/SESSION_METRICS_AND_ANALYTICS.md) | Scoring and analytics |

## Local development (typical)

```bash
# From repo root — install once
npm install

# Backend (migrations run on start)
npm run dev -w @candela/backend

# Web
npm run dev -w @candela/app

# Mobile — see apps/candela-mobile/README.md
```

Copy `apps/candela-backend/.env.example` to `.env` and set secrets locally. Never commit real credentials.

## External setup (not claimed complete)

- **Email:** application `MailService` exists; production provider/domain and live delivery QA are **pending** — see Deployment doc.
- **Google OAuth** client IDs and live Option C invitee testing.
- **Supabase** private storage buckets (`profile-photos`, `familiar-faces`).
- **PostgreSQL** via `DATABASE_URL` / `DATABASE_URL_DIRECT`.

## Implementation status

Identity profiles, memberships, patient ownership, invitations (password + Google Option C), doctor org invitations, seven-day trial on first login, Super Admin emergency audit, and related hardening are implemented in code (change log Entries 002–004). Documentation consolidation: Entry 005.
