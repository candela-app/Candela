# Bee Path Tracing Therapy Module - Complete Architecture & Feature Documentation

## 1. Executive Overview & Clinical Intent
The Bee Path Tracing Therapy Module is designed for oculomotor tracking, smooth pursuit training, and visual-motor integration for low-vision patients and children.

- **Core Objective**: The patient guides a realistic Bee sprite from its Hive (Start target) to a Target Flower (End target) along a structured visual path corridor.
- **Therapy Modes**:
  1. **Active Trace (Default)**: The path corridor remains visible throughout. The patient traces the path while the bee pursues their touch/cursor with speed-calibrated responsiveness.
  2. **Guided Trace**: The bee automatically plays a smooth demonstration traversal along the path at the configured speed, after which the patient re-traces it.

---

## 2. Comprehensive Feature Breakdown

### 🐝 Realistic High-Resolution Bee Sprite
- **Asset Location**: `packages/shared/assets/bee.png`
- **Native RGBA Transparency**: Crisp, high-DPI rendering with an ambient amber glow (`bg-amber-400/25 blur-md`) and drop shadow filter.
- **Cross-Device Responsiveness**:
  - **Mobile (`<600px`)**: `40px × 40px` (`w-10 h-10`)
  - **Tablet (`600-1024px`)**: `56px × 56px` (`w-14 h-14`)
  - **Desktop/TV (`>1024px`)**: `64px × 64px` (`w-16 h-16`)

### 🌀 Spiral & Loop Crossing Shortcut Fix
- **Sequential Window Lookahead (`findNearestPathPointInWindow`)**:
  - Replaced unrestricted global path searches with a strict forward lookahead window (`[currentPathIndex - 15 ... currentPathIndex + 35]`).
  - Prevents patients from cutting across spiral walls or jumping loops. Out-of-sequence moves trigger a soft wobble warning (*"Stay on the path!"*) and snap the bee back to the active coil position.

### ✨ Dynamic Path Types & Procedural Generator
Available path options in clinical settings:
1. `auto`: Progressive auto-advancement through **10 rounds**. Rounds 1–7 are the core path types in order (straight, curve, zigzag, wave, spiral, branching, dotted). Rounds 8–10 repeat straight, curve, and zigzag so the full set is played.
2. `procedural_random` (**✨ Fully Procedural Dynamic Path**):
   - Generates random Hive (Start) and Flower (Destination) screen positions for every round.
   - Spawns 2–4 intermediate control waypoints and connects them using Catmull-Rom spline curves.
   - Provides infinite, un-repeatable path variations.
3. `random` (**🎲 Random Preset Path**): Selects a random path template shape per round.
4. `straight`: 1. Straight Line (Horizontal / Diagonal)
5. `curve`: 2. Gentle Curve (Broad Arc)
6. `zigzag`: 3. Zigzag Shifts (Sharp Direction Changes)
7. `wave`: 4. S-Curve Wave (Sinusoidal Motion)
8. `spiral`: 5. Spiral Pursuit (Inward Arc). Path width is locked to **narrow**; the bee does not zoom on grab.
9. `branching`: 6. Branching Path — **correct path** plus a **faded distractor branch** and faded flower.
10. `dotted`: 7. Dotted Gap Fill — the guide is a **dotted** line (not a solid path).

Default session length is **10 rounds**. Completing a round cannot skip the next (R4 / wave is always played in auto mode).

### ⏱️ Bee Speed & Pursuit Responsiveness
Configurable across ALL tracing modes in `ClinicalSettingsModal`:
- **Slow (10s)**: 10-second demo duration or smooth damped pursuit (lerp factor `0.18`) for low-vision patients building tracking confidence.
- **Normal (5s)**: 5-second demo duration or standard pursuit (lerp factor `0.50`).
- **Fast (2.5s)**: 2.5-second demo duration or instant tracking (lerp factor `1.00`).

### 🎮 Smart Header Controls & Fullscreen Persistence
- **`▶ Play Demo` / `↺ Replay Demo`**:
  - Dynamic state transition: `▶ Play Demo` -> `▶ Playing Demo...` -> `↺ Replay Demo`.
  - Resets to `▶ Play Demo` on new round initialization.
- **`⛶ Fullscreen` Toggle**:
  - Dedicated header button with real-time `fullscreenchange` event listener.
- **State Preservation**:
  - Screen resize events and exiting full screen will **NEVER** reset the active round or bee position.
- **Seamless Control Pickup**:
  - Patients can touch or drag near the start Hive, near the bee (`<= 140px`), or anywhere along the path corridor to grab or resume control.

### 📊 Results Card & Custom Scrollbar
- **Card Styling**: Sleek dark-mode modal with `overflow-x-hidden`.
- **Custom Scrollbar**: `.custom-scrollbar` with a 6px rounded glassmorphism emerald thumb (`rgba(16, 185, 129, 0.35)`). Vertical scrollbar activates only if screen height is too small for full content.

---

## 3. Shared Cross-Platform Architecture (`@candela/shared`)

All core mathematical models, path algorithms, and metrics evaluation are exported from `@candela/shared` (`packages/shared/src/bee-path-logic.ts`) for reusability across Mobile (React Native / iOS / Android), Tablet, and Web apps:

- **`generateBeePath(type, width, height, tier, complexity)`**
- **`findNearestPathPoint(p, pathPoints)`**
- **`findNearestPathPointInWindow(p, pathPoints, currentIndex, lookaheadWindow)`**
- **`evaluateTracingMetrics(tracedPoints, targetPoints, toleranceBandPx, timestamps)`**
- **`BeeTracingSettings` & `BeeSessionResultData`**

---

## 4. File Map & Locations
- **Shared Path Logic**: `packages/shared/src/bee-path-logic.ts`
- **Shared Types**: `packages/shared/src/types.ts`
- **Clinical Settings Modal**: `packages/shared/src/ClinicalSettingsModal.tsx`
- **Bee Tracing Game View**: `apps/candela-app/src/components/beeTrackingModule/BeeTracingGame.tsx`
- **Local Re-exporter**: `apps/candela-app/src/components/beeTrackingModule/BeePathGenerator.ts`
- **Bee Image Asset**: `packages/shared/assets/bee.png`
- **Global CSS**: `apps/candela-app/src/app/globals.css`
