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
