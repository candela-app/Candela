# Kandela Mobile — Architecture

## Goal

`apps/candela-mobile` is a React Native / Expo port of `apps/candela-app`. Same roles, same APIs, same five therapy modules, responsive on Android and iOS phones and tablets.

The website still uses httpOnly cookies. Native apps cannot. Login/signup/refresh therefore also return `accessToken` and `refreshToken` in JSON. The mobile client stores them in SecureStore and sends `Authorization: Bearer`. Refresh and logout accept the refresh token in the POST body as well as the cookie.

## Screens (parity with the website)

| Route | Website | Role |
|-------|---------|------|
| `/` | Marketing landing | Public |
| `/login`, `/signup` | Email/password | Public |
| `/admin` | Create doctors, list doctors/patients | Admin |
| `/doctor` | Create patients, prescribe modules | Doctor |
| `/dashboard` | Module picker, variants, analytics placeholder | Patient |
| `/play/rotatory` | Rotatory Wheel | Patient |
| `/play/sorting` | Sorting | Patient |
| `/play/bee` | Bee Path Tracing | Patient |
| `/play/pursuit` | Pursuit | Patient |
| `/play/mobile-target` | Bubble Chase | Patient |

Signed-in logo goes to the role home (`/admin`, `/doctor`, `/dashboard`). Header is Sign in when logged out, name + Sign out when logged in.

## Responsive layout

`src/lib/layout.ts` scales spacing and type from a 390pt short-edge baseline, clamped so small phones stay readable and tablets do not explode. Grids drop from 4 → 3 → 2 → 1 columns by width. Games size the playfield from the live container (`onLayout`), then reuse `@candela/shared` placement math (`getDeviceTier`, `checkOverlap`, `generateBeePath`, `getMovementPath`).

## Shared package

Import **`@candela/shared/rn`**, not the main `@candela/shared` entry. The web entry pulls `ClinicalSettingsModal` (DOM/`className`) which React Native cannot render.

## Files

- `app/` — Expo Router screens
- `src/lib/` — API client, auth context, tokens, speech, haptics, CSV share
- `src/components/` — header, landing, settings/results/menu
- `src/games/` — five modules, same scoring/spawn rules as the website
- `metro.config.js` — watches the monorepo root so `@candela/shared` resolves

## Out of scope (this pass)

- Apple Developer / TestFlight / EAS production builds
- Session metrics persistence (same as website)
- Native fullscreen APIs (no browser fullscreen on RN)
