# AGENTS.md — Candela (Conversion Phase)

## Current Task
Converting an existing vanilla HTML/CSS/JS game prototype (rotating wheel bubble-pop game) into the target stack, inside the existing monorepo. Keep the conversion **minimal and functionally equivalent** first — do not redesign game logic, UI, or architecture during this pass. That comes later.

## Repo Structure (already set up — do not restructure)
```
Candela/
├── .github/
├── apps/
│   ├── website/       ← Next.js frontend + NestJS backend live here
│   │   ├── frontend/   (create if missing)
│   │   └── backend/    (create if missing)
│   ├── mobile/         ← React Native Expo (not in scope for this pass)
│   └── tv/             ← TV app (not in scope for this pass, platform TBD)
├── packages/
│   └── shared/         ← code shared across games, devices, and modules
├── CODEOWNERS
├── AGENTS.md
└── README.md
```
- All new work for this task goes inside `apps/website/frontend` and `apps/website/backend`.
- Anything reusable across more than one game, device, or module (game logic, types, constants, utils) goes in `packages/shared` — not duplicated inside `apps/website`.
- Do not create new top-level folders, rename existing ones, or touch `apps/mobile` / `apps/tv` for this task.

## Tech Stack (target)
- Frontend (`apps/website/frontend`): Next.js (App Router), TypeScript
- Backend (`apps/website/backend`): NestJS, TypeScript
- Database: **not configured yet — do not add Postgres, Prisma/TypeORM, migrations, or any DB connection code in this pass.** If the ported logic needs persistence, stub it (in-memory / local state) and leave a `// TODO: persist once DB is configured` comment instead.
- Styling: keep existing CSS as close to original as possible; port to CSS Modules — do not introduce Tailwind during this conversion pass

## Conversion Rules
- Preserve existing game behavior exactly: wheel speed, bubble spawn logic, click detection, scoring — do not "improve" logic while converting. Flag anything unclear instead of guessing at intended behavior.
- Port vanilla JS into a React component (e.g. `WheelGame.tsx`) in `apps/website/frontend`, using `useEffect`/`useRef` for canvas or DOM manipulation if the original relied on direct DOM access — do not force a full rewrite into idiomatic React state management yet.
- Anything in the original code that is game-agnostic or device-agnostic (scoring helpers, timing utils, shared types) should be lifted into `packages/shared`, not left duplicated inside `apps/website/frontend`.
- Do not split into a full Game Core / Device Config / Renderer architecture yet. That refactor happens in a later pass. Note spots that will need to become config-driven later with a `// TODO: device-config` comment, but don't build the system now.
- Hardcoded values in the original (bubble counts, colors, timers) should be lifted to named constants at the top of the file — just enough to make the later refactor easier, not a full config system.
- Backend (`apps/website/backend`): only introduce NestJS endpoints/modules if the original code has logic that must move server-side. If the original is purely client-side, say so rather than inventing endpoints.

## Explicit Non-Goals for This Pass
- No database of any kind — none is configured
- No Game Core / Device Config abstraction yet
- No auth, subscriptions, or B2B/B2C account modeling
- No changes to `apps/mobile` or `apps/tv`
- No new game logic or rule changes — pure conversion, same behavior in a new stack

## Package Manager
- [not yet decided — confirm before scaffolding `apps/website/frontend` and `apps/website/backend` package.json files]

## When Unsure
Ask rather than assume. If the original JS mixes concerns (e.g. rendering + scoring + input handling in one file), it's fine to split into separate functions/files during the port — but don't change *what* it does, only *where* the code lives. If something looks reusable but you're not sure it belongs in `packages/shared` yet, leave it in `apps/website/frontend` and flag it rather than moving it prematurely.