# Pursuit Module (Candela Vision Therapy) - Technical Walkthrough

## Overview
The **Pursuit Module** is a clinical game module built for Candela to train continuous visual pursuit and selective attention under motion in partially blind children.

---

## Clinical Architecture & Game Mechanics

### 1. Scene & Visual Contrast System
- **Bare Field**: Background is solid dark near-black (`#000000`) with zero decorative distractions or noise, ensuring maximum contrast salience.
- **High-Luminance Target**: Bright single-color target bubble (Cyan `#00E5FF`, Yellow `#FFD600`, or White `#FFFFFF`) with glowing border.
- **Selective Attention Decoys**: Decoy bubbles use a dimmer/lower-saturation version of the target color (dimmed opacity/salience). Visual differentiation is driven by **luminance/salience**, avoiding red-green color dependency for patients with color vision deficiency (CVD).

### 2. Trial & Session Progression
- **20 Trials Total**: Grouped into 4 blocks of 5 trials.
- **1.5s Neutral Pause**: Brief neutral transition pause between blocks displaying block progress indicator ("Block 2 of 4 Starting...").
- **Simultaneous Element Scaling**:
  - Block 1 (Entry level): 2 elements (1 Target + 1 Decoy).
  - Blocks 2–4: 3–4 elements (1 Target + 2–3 Decoys).
  - Maximum simultaneous elements on screen is capped at 4 across all device tiers (TV expands canvas bounds, NOT simultaneous element count).
- **Trial Completion Conditions**:
  - Correct tap on moving target bubble.
  - Incorrect tap on moving decoy bubble.
  - Trial timeout (4–6s, logged as miss/timeout, auto-advances to next trial).

### 3. Movement Trajectory Math (`packages/shared/src/pursuit-motion-logic.ts`)
- **Linear Bounce**: Straight-line motion bouncing off container edges with angle reflection.
- **Circular Orbit**: Smooth elliptical/circular orbit centered inside usable canvas.
- **Figure-8 Wave**: Parametric Lissajous curve ($x(t) = A \sin(\omega t)$, $y(t) = B \sin(2\omega t)$).
- **Random Walk with Momentum**: Continuous multi-harmonic sine summation ($A_1 \sin(\omega_1 t) + A_2 \sin(\omega_2 t) + \dots$) with continuous acceleration and velocity derivatives (no sharp angle jumps or teleportation).
- **Freeze & Drift**: Slow continuous drift interspersed with brief random freeze windows (freeze duration shrinks as difficulty increases).

### 4. Telemetry & Metrics Engine
- **Tracking Error (px)**: Euclidean distance $\sqrt{(x_{tap}-x_{target})^2 + (y_{tap}-y_{target})^2}$ at tap moment.
- **Vector Alignment (Anticipation vs. Lag)**: Dot product of tap offset vector with target velocity vector:
  $$\text{Dot} = (x_{tap} - x_{target}) \cdot v_x + (y_{tap} - y_{target}) \cdot v_y$$
  - $\text{Dot} > 0$: Anticipation (tapping ahead of target's motion vector).
  - $\text{Dot} < 0$: Lag (tapping behind target's motion vector).
- **Block-by-Block Fatigue Trend**: Aggregates accuracy % and avg tracking error px per block of 5 trials across the 4 blocks.

### 5. Results & Session Summary
- **Child-Facing Card**: Displays max 2 headline numbers (Overall Accuracy % + Star Rating) with celebratory tone.
- **Doctor / Parent Dashboard**: Complete metric breakdown, block-by-block trend analysis, pursuit vector alignment score, PNG card download, and CSV export.

---

## Verification & Testing
- Validated all 5 movement patterns.
- Verified orientation lock during active trials.
- Confirmed cap of 4 simultaneous elements.
- Exported session CSV via `exportSessionCSV()`.
