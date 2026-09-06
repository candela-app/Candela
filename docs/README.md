# Candela documentation

Start here. Each file covers one concern; session scoring lives in [SESSION_METRICS_AND_ANALYTICS.md](./SESSION_METRICS_AND_ANALYTICS.md).

## Platform

| Doc | What it covers |
|---|---|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Monorepo, stack, shared package, design principles |
| [AUTH_AND_ROLES_FLOW.md](./AUTH_AND_ROLES_FLOW.md) | Roles, login, cookies vs Bearer, access matrix |
| [DEPLOYMENT_AND_ENV.md](./DEPLOYMENT_AND_ENV.md) | Hosting, env vars (placeholders only — no secrets) |

## Clinical product

| Doc | What it covers |
|---|---|
| [PATIENT_AND_GAMES_FLOW.md](./PATIENT_AND_GAMES_FLOW.md) | Patient journey, module catalog, settings |
| [DOCTOR_GUIDE.md](./DOCTOR_GUIDE.md) | Onboarding, prescriptions, reading patient analytics |
| [ADMIN_GUIDE.md](./ADMIN_GUIDE.md) | Doctors, transfers, patient groupings |
| [DOCID_AND_MAIL.md](./DOCID_AND_MAIL.md) | Attach / change / transfer DocID and confirmation mail |
| [SESSION_METRICS_AND_ANALYTICS.md](./SESSION_METRICS_AND_ANALYTICS.md) | Wrong taps vs misses, formulas, what is saved, session vs visit IDs, charts |

## App walkthroughs (next to code)

| Location | What it covers |
|---|---|
| `apps/candela-backend/WALKTHROUGH.md` | Auth APIs, prescriptions, game-session endpoints |
| `apps/candela-mobile/WALKTHROUGH.md` | Expo screens and shared scoring |
| `apps/candela-app/src/components/*/WALKTHROUGH.md` | Per-module play rules |
