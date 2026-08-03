# Sequential Sorting Therapy Module - Architecture & Feature Documentation

## 1. Executive Overview & Clinical Intent
The Sequential Sorting Therapy Module focuses on visual search, cognitive sequencing, fine motor control, and sequential memory (sorting letters A-Z, numbers 1-20, or color sequences).

- **Therapy Variants**:
  - Uppercase Alphabets (A-Z)
  - Lowercase Alphabets (a-z)
  - Numbers (1-20)
  - Colors
- **Responsive Batching**:
  - Automatically batches items into manageable groups based on device tier (Mobile: 4 items/batch, Tablet: 6 items/batch, Desktop: 8 items/batch) so screens never get overcrowded.

---

## 2. Key Features & Clinical Settings

### ⚙️ Clinical Settings & Controls
- **Parameters**: Patient Name, Letter Size multiplier (`1.8`), Bubble Size (`90px`), Audio toggle.
- **Interactive Gameplay Mechanics**:
  - Top target bar highlights the next required item in sequence.
  - **Correct Tap**: Triggers pop animation, plays audio/haptic feedback, and advances `expectedIndex`.
  - **Wrong Tap**: Triggers error wobble animation (`wrongIds`) and plays error haptic feedback.

### 📦 Dynamic Batch Progression
- Items are presented in progressive batches:
  - **Batch 1**: Items 1 to N (based on device type).
  - **Batch Completion**: When all items in a batch are sorted, automatically generates the next batch until the full set is completed.

### 📊 Results & CSV Export
- Displays session performance via `GameResultsModal`:
  - Total Duration, Accuracy %, Correct/Wrong count, Average Reaction Time.
  - **CSV Export**: One-click download (`exportSessionCSV`).

---

## 3. Shared Cross-Platform Architecture (`@candela/shared`)

Core game logic, constants, overlap prevention, and audio/haptics are imported from `@candela/shared`:

- **`ALPHABETS`, `NUMBERS`, `THERAPY_COLORS`**: Constant data arrays.
- **`checkOverlap()`, `getMinDistancePercent()`**: Overlap prevention algorithms.
- **`getContrastColor()`**: High-contrast text color calculations.
- **`playCorrectSoundAndHaptic()`, `playWrongSoundAndHaptic()`**: Shared audio/haptic engine.

---

## 4. File Map & Locations
- **Main Game Component**: `apps/candela-app/src/components/sortingModule/SortingGame.tsx`
- **Module Styles**: `apps/candela-app/src/components/sortingModule/SortingGame.module.css`
- **Shared Clinical Modal**: `packages/shared/src/ClinicalSettingsModal.tsx`
- **Shared Logic & Types**: `packages/shared/src/game-logic.ts` & `packages/shared/src/types.ts`
