# Kandela Mobile (`apps/candela-mobile`)

React Native (Expo) app that matches the Kandela website: same roles, same screens, same five therapy modules.

## Stack

- Expo SDK 54 + Expo Router
- TypeScript
- React Native (Android and iOS)
- Auth via Bearer tokens in SecureStore (the website still uses cookies)

## Run

1. Start the backend (`npm run dev:backend` from the repo root). It must listen on `0.0.0.0:3001`.
2. Copy `.env.example` to `.env` and set `EXPO_PUBLIC_API_URL`:
   - Android emulator: `http://10.0.2.2:3001`
   - iOS simulator: `http://localhost:3001`
   - Physical phone: `http://YOUR_LAN_IP:3001` (same Wi-Fi as the computer)
3. From the repo root:

```bash
npm install
npm run dev:mobile
```

Then scan the QR code with Expo Go, or press `a` / `i` for an emulator.

Layout scales from phone to tablet using `useWindowDimensions` (`src/lib/layout.ts`). Games use the same shared math as the website (`@candela/shared/rn`).

See [WALKTHROUGH.md](./WALKTHROUGH.md) for screens and architecture.

## CI APK builds (EAS)

Pushes to `main` that touch `apps/candela-mobile/**` or `packages/shared/**` trigger an Android APK build on Expo EAS. Slack notifications go to the `#mobile-app` channel.

**One-time setup**

1. Create an Expo account and link the project from `apps/candela-mobile`:
   ```bash
   npm install --global eas-cli
   cd apps/candela-mobile
   eas login
   eas init
   ```
   Commit the `projectId` added to `app.json` under `expo.extra.eas`.
2. Add GitHub Actions secrets:
   - `EXPO_TOKEN` — [candelaapp team access tokens](https://expo.dev/accounts/candelaapp/settings/access-tokens)
   - `EXPO_TOKEN_BACKUP1` — [satvik-27s-team access tokens](https://expo.dev/accounts/satvik-27s-team/settings/access-tokens)
   - `EXPO_TOKEN_BACKUP2` — [srisais-team access tokens](https://expo.dev/accounts/srisais-team/settings/access-tokens)
   - `SLACK_WEBHOOK_URL_MOBILE` — Incoming Webhook for `#mobile-app`

   Access tokens live on the **Expo team** (`/accounts/<slug>/settings/access-tokens`), not on **Project credentials** (that page is only Android/iOS signing).

The `preview` profile in `eas.json` produces an installable APK pointed at the production backend (`https://candela-backend-gbdz.onrender.com`).
