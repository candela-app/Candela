# Backend Auth & Roles - Architecture & Feature Documentation

## 1. Executive Overview

`candela-backend` is the shared NestJS API for website, mobile, and TV. This pass adds **accounts, sessions, and module prescriptions**. Game session metrics are **not** stored yet.

Three roles share one `users` table (`role` column). Extra rows exist only where the role needs them:

| Role | Who creates them | Extra table | What they can do |
|------|------------------|-------------|------------------|
| **Admin** | Seed script | none | Create doctors. List all doctors, doctor-managed patients, and self-signup patients. |
| **Doctor** | Admin | `doctors` (referral code) | Create patients already linked to them. Add/remove prescribed modules. |
| **Patient** | Doctor, or self-signup | `patients` | Play modules: prescribed list if linked to a doctor, **all catalog modules** if self-signup. |

Login is always **email + password**. Self-signup patients can later type a doctor's DocID to request an attach. Display name in the UI is `users.name`.

---

## 2. Key Features

### Referral codes

Generated automatically when an admin creates a doctor. Shown on admin/doctor dashboards and used as the **DocID** for attach / change / transfer.

- Exactly **6 characters**
- **3 letters** (A–Z) and **3 digits** (0–9)
- **First character is always a letter**
- Remaining 5 characters are shuffled (any order)

Implementation: `src/common/referral-code.ts`. Collisions retry up to 20 times. Patient linking: [docs/DOCID_AND_MAIL.md](../../docs/DOCID_AND_MAIL.md).

### Patient origin

| `patients.origin` | How the account is created | `doctor_id` | Modules on `GET /api/me` |
|-------------------|----------------------------|-------------|--------------------------|
| `doctor_created` | Doctor submits name, phone, email, password | that doctor | Only rows in `prescriptions` (empty list until the doctor checks modules) |
| `self_signup` | `POST /api/auth/signup` (same fields, no doctor) | `null` until a doctor confirms an attach | All catalog ids while unlinked; prescribed only after attach |

Catalog ids: `rotatory`, `sorting`, `bee_tracing`, `pursuit`, `mobile_target` (`src/common/catalog.ts`).

### Prescriptions

On/off only. A doctor adds or deletes a `module_id` for **their** patient. Severity is clinical judgment, not a database field. Per-module clinical settings (speed, bubble size, etc.) are **not** stored on the prescription.

### Sessions (JWT)

GitHub-like web session, not GitHub OAuth:

| Token | Lifetime | Storage |
|-------|----------|---------|
| Access JWT | **1 day** | httpOnly cookie `candela_access` **and** JSON `accessToken` (mobile) |
| Refresh (opaque, SHA-256 stored) | **14 days** | httpOnly cookie `candela_refresh` **and** JSON `refreshToken` (mobile) |

Refresh rotates: old token is revoked, a new pair is issued. Logout revokes the current refresh token and clears cookies. `POST /api/auth/refresh` and `POST /api/auth/logout` also accept `{ refreshToken }` in the body for native clients. `SameSite=Lax`; `Secure` only when `NODE_ENV=production`. `JwtAuthGuard` accepts the cookie **or** `Authorization: Bearer`.

The website proxies `/api/*` to this server so cookies stay first-party on the Next.js origin. The mobile app talks to this server directly.

### Seeded admins

Admins are **not** a separate table. They are `users` rows with `role = 'admin'`.

Credentials come from environment variables (`ADMIN_1_EMAIL` / `ADMIN_1_PASSWORD`, plus optional `ADMIN_2_*` …). `npm run seed:admins` and startup `seedAdminUsers()` insert those accounts if they are missing. Set `ADMIN_SEED_OVERWRITE=true` only while rotating passwords, then turn it off. Never commit real admin passwords.

### Explicit non-goals (this pass)

- No game session / metrics tables
- No password-reset email
- No doctor self-registration

---

## 3. Data Model

```
users (id, email unique, password_hash, name, phone, role, created_at)
  role: admin | doctor | patient

doctors (user_id PK → users, referral_code unique CHAR(6))

patients (user_id PK → users, doctor_id → doctors nullable, origin)

prescriptions (id, patient_id → patients, module_id, unique(patient_id, module_id))

docid_requests (pending attach/change/transfer + hashed confirm token)

patient_docid_history (previous DocIDs after change/internal)

refresh_tokens (id, user_id → users, token_hash unique, expires_at, revoked_at)
```

TypeORM `synchronize` is **false**. Schema is applied by migrations (`InitAuth`, prescription levels, DocID requests). Runtime uses `DATABASE_URL` (Supabase session pooler). Migrations use `DATABASE_URL_DIRECT`.

---

## 4. HTTP API

All JSON. Cookie session via `credentials: 'include'` from the website. Bearer access token is also accepted.

Public (no login): `POST /api/auth/signup`, `POST /api/auth/login`, `POST /api/auth/refresh`, `POST /api/auth/logout`, `GET /api/health`, DocID token confirm/reject.

Everyone else needs a valid access cookie/JWT. `@Roles(...)` additionally requires `admin` or `doctor`.

### Auth

| Method | Path | Body | Result |
|--------|------|------|--------|
| POST | `/api/auth/signup` | name, phone, email, password | Self-signup patient + cookies + session JSON |
| POST | `/api/auth/login` | email, password | Cookies + session JSON |
| POST | `/api/auth/refresh` | (refresh cookie) | Rotated cookies + session JSON |
| POST | `/api/auth/logout` | (refresh cookie) | Clears cookies |
| GET | `/api/auth/me` | — | Session JSON |
| GET | `/api/me` | — | Same session JSON |
| GET | `/api/me/modules` | — | `{ allowedModuleIds }` |
| GET | `/api/health` | — | `{ status, database, timestamp }` |

Password min length **8**. Phone min length **6**. Email unique, stored lowercase.

Session JSON shape: `{ user, doctor, patient, allowedModuleIds }`.

### Admin (`role = admin`)

| Method | Path | Body |
|--------|------|------|
| POST | `/api/admin/doctors` | name, phone, email, password |
| GET | `/api/admin/doctors` | — |
| GET | `/api/admin/patients` | — |

Creating a doctor generates `referral_code` and a `doctors` row.

### Doctor (`role = doctor`)

| Method | Path | Body |
|--------|------|------|
| POST | `/api/doctors/me/patients` | name, phone, email, password |
| GET | `/api/doctors/me/patients` | — |
| GET | `/api/doctors/me/patients/:id` | — |
| POST | `/api/doctors/me/patients/:patientId/prescriptions` | `{ moduleId }` |
| DELETE | `/api/doctors/me/patients/:patientId/prescriptions/:moduleId` | — |

Cross-doctor access returns 404/403. Unknown `moduleId` returns 404.

### DocID (`src/docid`)

| Method | Path | Who |
|--------|------|-----|
| POST | `/api/docid/requests` | Patient (Self or Change) |
| POST | `/api/docid/transfers` | Admin (Internal) |
| GET | `/api/docid/incoming` | Doctor |
| POST | `/api/docid/requests/:id/accept` | Recipient |
| POST | `/api/docid/requests/:id/reject` | Recipient |
| GET | `/api/docid/requests/token/:token` | Public |
| POST | `/api/docid/requests/token/:token/accept` | Public |
| POST | `/api/docid/requests/token/:token/reject` | Public |

---

## 5. File Map & Locations

- **Bootstrap / CORS / cookies**: `apps/candela-backend/src/main.ts`
- **Health**: `apps/candela-backend/src/app.controller.ts`, `app.service.ts`
- **Auth + role HTTP**: `apps/candela-backend/src/auth/auth.controller.ts`, `role.controllers.ts`
- **Business logic**: `apps/candela-backend/src/auth/auth.service.ts`
- **DocID requests**: `apps/candela-backend/src/docid/`
- **Mail**: `apps/candela-backend/src/mail/mail.service.ts`
- **DTOs**: `apps/candela-backend/src/auth/dto.ts`
- **Guards**: `apps/candela-backend/src/common/jwt-auth.guard.ts`, `roles.guard.ts`
- **Referral codes**: `apps/candela-backend/src/common/referral-code.ts`
- **Module catalog**: `apps/candela-backend/src/common/catalog.ts`
- **Entities**: `apps/candela-backend/src/entities/`
- **Migration**: `apps/candela-backend/src/migrations/`
- **Admin seed**: `apps/candela-backend/src/common/admin-seed.ts`, `src/seed-admins.ts`
- **Website types**: `packages/shared/src/auth-types.ts`
- **Website UI**: `/login`, `/signup`, `/admin`, `/doctor`, `/dashboard`, `/docid/confirm`, `/docid/reject` in `apps/candela-app`
