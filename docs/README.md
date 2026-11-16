# Candela documentation

Start here. Each file covers one concern; session scoring lives in [SESSION_METRICS_AND_ANALYTICS.md](./SESSION_METRICS_AND_ANALYTICS.md).

## Business plan

| Doc | What it covers |
|---|---|
| [CANDELA_HIGH_LEVEL_BUSINESS_ARCHITECTURE.html](./CANDELA_HIGH_LEVEL_BUSINESS_ARCHITECTURE.html) | Current high-level business plan: roles, journeys, dashboards, what a score means with worked examples, access, transfers, Normal vs Pediatric navigation, and hospital-entered measurements. Open decisions at the end are not finalized requirements. |

## Platform

| Doc | What it covers |
|---|---|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Canonical architecture: roles, ownership, profiles, trial, transfers, emergency audit, Mermaid diagrams |
| [AUTH_AND_ROLES_FLOW.md](./AUTH_AND_ROLES_FLOW.md) | Auth matrix, sessions, patient/org invitations, Google Option C, scoping, token purpose isolation |
| [CANDELA_ARCHITECTURE_CHANGE_LOG.md](./CANDELA_ARCHITECTURE_CHANGE_LOG.md) | Chronological decisions (Option C, profiles/trial, hardening, docs consolidation) |
| [DEPLOYMENT_AND_ENV.md](./DEPLOYMENT_AND_ENV.md) | Env vars, migrations, email/OAuth/Supabase status, outstanding external QA |

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
