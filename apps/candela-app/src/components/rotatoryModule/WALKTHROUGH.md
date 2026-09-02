# Rotatory Wheel Therapy Module - Architecture & Feature Documentation

## 1. Executive Overview & Clinical Intent
The Rotatory Wheel Therapy Module trains continuous visual pursuit, saccadic targeting, dynamic visual acuity, and rapid target identification on a rotating circular wheel.

- **Therapy Modes**: Alphabets (Uppercase/Lowercase), Numbers, Colors.
- **Unique session deck**: 26 letters, 10 digits (0–9), or 6 unique color cycles (24). No random repeats on the wheel.
- **Dynamic Rotation**: Speed presets (0.5x, 1x, 1.5x, 2x, 2.5x) or customized speed.
- **Audio Feedback**: Text-to-Speech (Indian English voice priority `en-IN`), bubble pop sound effects, and haptic feedback.
- **Device Awareness**: Adapts bubble count per round (2 / 3 / 5), overlap avoidance (`getMinDistancePercent`), and responsive layout for Mobile, Tablet, and Desktop. Last batch is never a single bubble.

---

## 2. Key Features & Clinical Settings

### ⚙️ Clinical Settings & Customization
- **Wheel Customization**: Custom wheel background color (`#000000` default dark), letter size multiplier (`1.8`), bubble diameter (`90px`).
- **Interactive Gameplay Mechanics**:
  - Target banner displays current required symbol/color with audio pronunciation.
  - **Correct Tap**: Triggers pop animation (`poppingIds`), plays audio/haptic feedback, and calculates reaction time.
  - **Wrong Tap**: Triggers shake animation (`wrongIds`) and plays error haptic feedback.

### 📱 Responsive Device Tier Support
- Automatically detects device tier via `getDeviceTier()`:
  - **Mobile**: Optimizes wheel diameter and font scale.
  - **Tablet**: Scales target banner and touch zones.
  - **Desktop / TV**: Renders high-DPI broad canvas layout.

### 📊 Results & CSV Export
- Displays session performance via `GameResultsModal`:
  - Accuracy %, median search time, left/right field, form-class search times (not an alphabet score).
  - **CSV Export**: session summary plus one row per trial (`exportSessionCSV` / `sessionResultToCsv`).

---

## 3. Shared Cross-Platform Architecture (`@candela/shared`)

Core game logic, mathematical placement, overlap detection, and audio/haptics are imported from `@candela/shared`:

- **`buildRotatoryDeck` / `createRotatorySession`**: Unique A–Z, 0–9, or unique color cycles.
- **`rotatoryScreenPolar`**: Screen-space hemifield / clock angle for ML and reports.
- **`checkOverlap(pos, existingPositions, minDistance)`**: Overlap prevention math.
- **`getMinDistancePercent(bubbleSize, containerSize)`**: Dynamic margin math.
- **`getSlotFallbackPosition(slotIndex, totalSlots, containerSize, bubbleSize)`**: Deterministic fallback placement.
- **`getDeviceTier()`**: Responsive device tier detector.

---

## 4. File Map & Locations
- **Main Game Component**: `apps/candela-app/src/components/rotatoryModule/RotatoryWheelGame.tsx`
- **Module Styles**: `apps/candela-app/src/components/rotatoryModule/RotatoryWheelGame.module.css`
- **Shared Clinical Modal**: `packages/shared/src/ClinicalSettingsModal.tsx`
- **Shared Logic & Types**: `packages/shared/src/game-logic.ts` & `packages/shared/src/types.ts`
