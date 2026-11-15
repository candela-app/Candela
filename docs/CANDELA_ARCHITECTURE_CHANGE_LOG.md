# Candela Architecture Change Log

## Entry 005 — Documentation consolidation (post-hardening)

**Date:** 2026-11-15  
**Status:** Documentation only. No application or schema behaviour change.

### Purpose

Align `ARCHITECTURE.md`, `AUTH_AND_ROLES_FLOW.md`, `DEPLOYMENT_AND_ENV.md`, `README.md`, and the docs index with the implemented post-hardening system (Entries 002–004), including Mermaid diagrams and an explicit split between application implementation and pending external configuration/QA (especially email).

### What was not changed

- No new product wave.
- No code or migration changes in this entry.
- Entry 004 remains the implementation record for M4–M6, L4, H3, and trial atomicity.

---

## Entry 004 — Final hardening: org invitations, legacy org sync, transactional patient create, L4, H3, trial atomicity

**Date:** 2026-11-15  
**Status:** Implementation completed (automated tests + typecheck). Live email provider/domain, OAuth invitee QA, and Supabase live bucket QA remain environment-dependent. Migration `AddEmergencyAuditLogs1800000000000` must be present in each target database (may already be applied via startup migration runner).

### Problem

Closing the current implementation wave required: authenticated doctor organisation-invitation acceptance (M4), legacy `users.organization_id` sync on primary membership changes (M5), transactional doctor patient create + invitation (M6), login enumeration hardening (L4), Super Admin emergency justification + append-only audit (H3), and stronger trial-start atomicity.

### M4 — Doctor organisation invitation acceptance

- Public preview: `GET /api/doctor-organization-invitations/:token/preview` (never activates membership).
- Accept / decline require authenticated **doctor** whose `user.id` matches `invitation.doctorId`.
- Web: `/org-invitation` (token in sessionStorage across login `?next=`).
- Mobile: `org-invitation` screen + `candela://` deep-link path; in-memory token store.
- Email link target: `{FRONTEND_URL}/org-invitation?token=…`.

### M5 — Legacy organisation reference

- Authoritative access remains `doctor_organization_memberships`.
- On primary change / membership end / suspend / accept-invite primary: sync `users.organization_id` to active primary or **clear** when none.
- Does not auto-promote another membership; does not touch patient ownership.

### M6 — Patient create + invitation

- Single DB transaction: user (`password_hash` null) + patient ownership + hashed `patient_invitation` token.
- Email sent **after** commit; API returns `emailSent` without raw token.
- Resend remains recoverable when delivery fails.

### L4 — Login enumeration

- Password login always returns `Invalid email or password` for missing / unactivated / Google-only / wrong password.
- Forgot-password remains opaque.
- Invitation and Google Option C flows keep actionable messages inside invitation context.

### H3 — Super Admin emergency access

- Header: `X-Emergency-Reason` / shared `EMERGENCY_REASON_HEADER`.
- Required for sensitive SA ops (org detail, self-users list, ownership repair, invite resend, `/api/admin/*` when SA, cross-org DocID transfer).
- Not required for ordinary platform ops (list/create orgs, metrics, announcements).
- Append-only table `emergency_audit_logs` (migration `1800000000000`).
- Successful mutating interventions notify hospital admins (action category + audit reference; no clinical payloads).
- Ownership / membership / transfer integrity rules preserved.

### Trial concurrency

- `ensurePatientTrialStarted` uses atomic `UPDATE … WHERE trial_started_at IS NULL RETURNING …`.
- Still starts on first successful session build (login), not game play or profile completion.

### API / schema

| Item | Change |
|------|--------|
| Org invite preview / accept / decline | Authenticated accept/decline; public preview |
| `X-Emergency-Reason` | Required on sensitive SA routes |
| `emergency_audit_logs` | New append-only audit table |

### Manual QA still required

- Org invitation email → web/mobile accept as correct doctor; wrong doctor rejection
- SA emergency reason UX + audit row inspection after migration
- Concurrent first-login trial under real Postgres
- Patient create with email failure then resend

---

## Entry 003 — Identity profiles, soft onboarding, media upload & trial foundation

**Date:** 2026-11-15  
**Status:** Implementation completed (automated tests + typecheck). Live photo upload and OAuth journeys require manual QA / Supabase bucket setup.

### Problem

Backend identity columns, `ProfilesService`, and `/api/me/profile` APIs existed, but web and mobile never fetched or rendered them. Login routed straight to role dashboards with no completion prompt. Photo/logo paths existed without upload. Patient trial tracking was absent.

### Architecture

- **Source of truth:** existing `patients` / `doctors` / `organizations` identity columns + shared `profile-completion` helpers.
- **Soft onboarding:** after auth, clients `GET /api/me/profile`; if incomplete, show a dismissible banner (24h local dismiss). Games are **not** gated.
- **Completion:** explicit `POST …/profile/complete`; PATCH clears `identity_profile_completed_at` when required fields become missing.
- **Media:** server-side upload to Supabase bucket `profile-photos` (configurable via `SUPABASE_PROFILE_PHOTOS_BUCKET`) with path prefixes `patients/`, `doctors/`, `organizations/`. Clients cannot set storage paths via PATCH.
- **Trial:** `patients.trial_started_at` / `trial_ends_at` set once on first successful session build (`AuthService.ensurePatientTrialStarted`). Independent of identity completion, activation, and subscriptions. No payment integration.
- **Legacy name edit:** `PATCH /api/auth/profile` still updates name only, then returns a fresh `SessionUser`.

### API additions

| Endpoint | Purpose |
|----------|---------|
| `POST /api/me/profile/photo` | Patient/doctor photo upload |
| `DELETE /api/me/profile/photo` | Remove personal photo |
| `POST /api/organizations/:id/profile/logo` | Org logo upload |
| `DELETE /api/organizations/:id/profile/logo` | Remove org logo |

Profile GET responses now include `profilePhotoUrl` / `logoUrl` (signed) and patient `trial` status. Session patient payload includes `trial`.

### Clients

- Web: `/profile`, `/doctor/profile`, `/admin/organization-profile`, global `ProfileCompletionBanner`, DocID cross-org `organizationId` field, doctor patient identity panel.
- Mobile: `/profile`, `/doctor-profile`, `/organization-profile`, banner, DocID org field, account/settings entry points.

### Database

Migration: `AddPatientTrialWindows1799000000000` (`trial_started_at`, `trial_ends_at`).

### External setup required

Create a **private** Supabase Storage bucket named `profile-photos` (or the value of `SUPABASE_PROFILE_PHOTOS_BUCKET`) and set backend env `SUPABASE_URL` + `SUPABASE_SECRET_KEY`.

### Tests

Shared patient-trial helpers; backend profiles + patient-trial suites. Full shared suite may include a pre-existing slow prescription-coverage timeout unrelated to this change.

---

## Entry 002 — Invitation-aware Google authentication (Option C)

**Date:** 2026-11-15  
**Status:** Implementation completed (automated tests + typecheck/build). Production Google invite path requires manual QA.

### Problem and security rationale

Doctor-created patients start without a password and receive a `patient_invitation` email. The previous Google Sign-In path matched by email, linked `googleId`, and issued a full Candela session immediately — bypassing explicit invitation acceptance.

### Locked product decision

**Option C:** Authenticate with Google first, explicitly accept the invitation, then activate.

Google authentication and invitation acceptance are separate operations. Activated Google-only patients may have no password and continue to use Google Sign-In.

### Related: H1 patient ownership null orgs

**Resolved — expected behaviour.** Patients with `organization_id IS NULL` who are `origin = self_signup` and `doctor_id IS NULL` are legitimate unlinked self-signup users. They must not be auto-assigned an organisation. Ownership is set only through the approved DocID association workflow.

### Updated Google authentication sequence

1. Validate Google identity (verified email + `sub`).
2. If matching patient is `doctor_created` and `account_activated_at` is null → return `invitation_acceptance_required` with a short-lived challenge (no session, no permanent `googleId`).
3. Client shows acceptance UI with trusted clinician/org details from the backend.
4. `POST /api/auth/invitations/accept-google` validates the challenge + outstanding invitation, then transactionally links Google, consumes invitation tokens, sets `account_activated_at`, and only then issues the normal session.

Password invitation accept (`POST /api/auth/invitations/accept`) remains Method A and also sets `account_activated_at`.

### Temporary acceptance-context design

Table `google_invitation_challenges`: hashed single-use token bound to user, invitation row, Google `sub`, and verified email. Default TTL 15 minutes (`GOOGLE_INVITATION_ACCEPT_TTL_MINUTES`). Stored client-side in sessionStorage (web) or in-memory (mobile) — not in deep-link URLs.

### Invitation activation state

Column `patients.account_activated_at` (nullable). Independent of `password_hash` and of `identity_profile_completed_at`. Migration `179800…` backfills rows that already had a password or linked Google identity.

### API changes

| Endpoint | Change |
|----------|--------|
| `POST /api/auth/google` | May return `status: invitation_acceptance_required` instead of a session |
| `POST /api/auth/invitations/accept-google` | New — consume challenge + activate + session |
| `POST /api/auth/invitations/accept` | Sets `account_activated_at` |

### Web / mobile

- Web: `/accept-google-invitation`
- Mobile: `accept-google-invitation` screen
- Login/signup Google handlers detect the restricted response

### Database

Migration: `AddAccountActivationAndGoogleInviteChallenge1798000000000`

### Security invariants

- No Candela session until explicit accept for pending invitees
- Client cannot supply patient/invitation IDs for Google accept
- Purpose isolation of `patient_invitation` vs `password_reset` unchanged
- Ownership fields (`doctor_id`, `organization_id`, origin) unchanged by activation

### Tests

Backend vitest: Wave 3 invitation tests + `google-invitation-h2.test.ts`

### Manual QA still required

- Live Google OAuth with a doctor-created invitee email
- Accept / decline / refresh / replay
- Activated Google-only re-login
