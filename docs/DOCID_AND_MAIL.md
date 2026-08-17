# DocID Attach, Change, Transfer & Mail

DocID is the existing **6-character doctor referral code**. Patients do not get a new identifier. Linking a patient to a doctor is a **pending request** that must be confirmed by email (SMTP today).

## Who confirms

| Source | Who starts it | Who gets the mail | On Yes | History |
|---|---|---|---|---|
| **Self** | Self-signup patient with no doctor enters a DocID | **Requested doctor** | `NULL` → DocID | No |
| **Change** | Patient who already has a doctor enters a new DocID | **Requested (new) doctor** | Replace current DocID | Yes — keep the old code |
| **Internal** | Admin requests a transfer | **Patient** | Replace current DocID | Yes — keep the old code |

Self and Change are **not** emailed to the patient again. They already typed the DocID. The requested doctor accepts or rejects.

Internal is started by an admin, so the **patient** must confirm.

A **No** (or an expired link) rejects the request. `doctor_id` does not change.

## Why history exists

Successful Change and Internal writes store the **previous** DocID on `patient_docid_history`. Admin can filter patients by current **or previous** DocID.

## Mail

`candela-backend` sends mail through `MailService`. DocID logic never talks to Gmail or SendGrid directly.

| `MAIL_TRANSPORT` | Behavior |
|---|---|
| `smtp` | Nodemailer SMTP (Gmail app password is fine while `$0`) |
| `log` | Do not send. Print confirm/reject URLs in the backend console for local testing |
| `sendgrid` | Not wired yet. Keep `smtp` until you have a domain |

From-address on free SMTP is the mailbox, so messages may land in **spam**. That is expected until a paid provider + your own domain (SPF/DKIM). Swap later by changing env, not the attach/change/transfer code.

Confirm links:

- `{FRONTEND_URL}/docid/confirm?token=…`
- `{FRONTEND_URL}/docid/reject?token=…`

Tokens are random, stored as SHA-256, single-use, default TTL **48 hours** (`DOC_ID_REQUEST_TTL_HOURS`).

If SMTP fails, the pending row is still saved. The recipient can Confirm/Reject in the app (doctor dashboard for Self and Change, patient dashboard for Internal).

## HTTP

| Method | Path | Who | Purpose |
|---|---|---|---|
| POST | `/api/docid/requests` | Patient | Self attach or Change |
| POST | `/api/docid/transfers` | Admin | Internal transfer |
| GET | `/api/docid/incoming` | Doctor | Pending Self and Change requests to this DocID |
| POST | `/api/docid/requests/:id/accept` | Recipient | In-app Yes |
| POST | `/api/docid/requests/:id/reject` | Recipient | In-app No |
| GET | `/api/docid/requests/token/:token` | Public | Preview |
| POST | `/api/docid/requests/token/:token/accept` | Public | Email Yes |
| POST | `/api/docid/requests/token/:token/reject` | Public | Email No |

## After a Self attach is accepted

`origin` stays `self_signup`, but `doctor_id` is set. The patient then sees **only prescribed modules** (same as a doctor-created patient). The doctor should prescribe modules after confirming.

## Schema

```
docid_requests (patient_id, from_doctor_id, from_referral_code, to_doctor_id,
                source, status, token_hash, recipient_user_id, expires_at)

patient_docid_history (patient_id, referral_code, doctor_id, source)
```

TypeORM `synchronize` stays **false**. Apply with `npm run migration:run` in `apps/candela-backend`.

## Website UI

- Patient `/docid` — attach or reassignment (header **DocID** from `/dashboard`). Confirm/Reject here only for Internal transfers
- Doctor `/doctor` — incoming Self attach and Change reassignment list
- Admin `/admin` — Internal transfer + filter patients by current or previous DocID
- Public `/docid/confirm` and `/docid/reject` — email landing pages

Mobile does not include this UI yet.
