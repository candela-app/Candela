# Candela Vision Therapy Platform — Module Technical Specification, Graph Storage & GPT Engine Guide

> **Target Audience:** AI Engineering Agents (GPT / Claude), Senior Full-Stack Engineers, and Clinical Diagnostics Developers.  
> **Mission:** Provide an exhaustive, mathematically rigorous, single-source-of-truth reference covering module mechanics, error taxonomies, trial-level polar telemetry, PostgreSQL persistence schemas, daily attempt-weighted chart aggregation, and an invariant checklist for diagnosing and fixing bugs across all 14 Candela vision therapy games.

---

## Table of Contents

1. [Architectural Overview & Data Flow Pipeline](#1-architectural-overview--data-flow-pipeline)
2. [Universal Error Taxonomy & Clinical Formulas](#2-universal-error-taxonomy--clinical-formulas)
3. [Database Schema & Backend API Persistence](#3-database-schema--backend-api-persistence)
4. [Graph Storage & Analytics Plotting Engine](#4-graph-storage--analytics-plotting-engine)
5. [Spin Field Family: Deep-Dive Specification](#5-spin-field-family-deep-dive-specification)
   - [5.1 Rotatory Wheel (`rotatory`)](#51-rotatory-wheel-rotatory)
   - [5.2 Sequential Sorting (`sorting`)](#52-sequential-sorting-sorting)
6. [Comprehensive Rules & Mechanics: All Other 12 Modules](#6-comprehensive-rules--mechanics-all-other-12-modules)
   - [Tap Timing: `mobile_target`, `pursuit`, `computer_vision`](#61-tap-timing-family)
   - [Look Jumps: `number_search`, `peripheral_view`](#62-look-jumps-family)
   - [Glimpse Hold: `pattern_match`, `location_memory`, `direction_sense`, `familiar_faces`](#63-glimpse-hold-family)
   - [Trace & Build: `bee_tracing`, `geoboard`](#64-trace--build-family)
   - [Pediatric Sensory: `wind_chime`](#65-pediatric-sensory-module)
7. [Common Bugs, Telemetry Pitfalls & Invariant Checklist](#7-common-bugs-telemetry-pitfalls--invariant-checklist)

---

## 1. Architectural Overview & Data Flow Pipeline

The telemetry pipeline converts real-time client touch/pointer interactions into mathematically aggregated longitudinal charts:

```mermaid
flowchart TD
    A[Client Game Interaction Canvas / DOM] -->|Taps, Coordinates, Audio/Haptics| B[Game Core & Trial State Machine]
    B -->|Active Trials + Pause Drift Tracking| C[Clock & Trial Controller]
    C -->|Trial Finished: Onset, Target, Errors, ReactionMs| D[Trial Telemetry Log]
    D -->|Session End: Cleared / Completed / Timeout| E{Persist Gate Check}
    E -->|endedBy === 'abandoned'| F[Drop Session / No Save]
    E -->|endedBy in ['cleared','completed','timeout']| G[buildSessionMetrics & summarizeSession]
    G -->|POST /api/game-sessions with clientEventId| H[NestJS GameSessionsController]
    H -->|pg_advisory_xact_lock & sequential session_number| I[(PostgreSQL: game_sessions table)]
    I -->|GET /api/game-sessions| J[Client SessionAnalyticsPanel]
    J -->|poolSessionsByDate / poolSessionsByMonth| K[Daily / Monthly Aggregated Plot Points]
    K -->|SVG Vector Engine & Portaled Tooltip| L[Clinical Analytics Line Graphs]
```

### Key Modules & File Map
- **Client Session Metrics Engine:** `packages/shared/src/session-metrics.ts`
- **Session Lifecycle & Gate:** `packages/shared/src/game-session.ts`
- **Spin Field Core Logic:** `packages/shared/src/rotatory-logic.ts` & `packages/shared/src/game-logic.ts`
- **Web Game Components:** `apps/candela-app/src/components/rotatoryModule/RotatoryWheelGame.tsx` & `sortingModule/SortingGame.tsx`
- **Database Entity:** `apps/candela-backend/src/entities/game-session.entity.ts`
- **Backend Service:** `apps/candela-backend/src/game-sessions/game-sessions.service.ts`
- **Charts Component:** `apps/candela-app/src/components/shared/SessionAnalyticsPanel.tsx`

---

## 2. Universal Error Taxonomy & Clinical Formulas

Every game module in Candela categorizes user actions into four non-overlapping trial outcomes. Under no circumstances should error types be conflated into a generic "wrong" counter.

| Metric | Definition | Concrete Gameplay Example |
| :--- | :--- | :--- |
| **`correct`** | Valid hit on the active target stimulus | Tapped called letter "G" in Rotatory; tapped sequence item "3" in Sorting |
| **`wrongTaps`** | Discrimination error (tapped a stimulus that is *not* the current target) | Tapped distractor "Q" when target was "O"; tapped "5" when next in Sorting was "4" |
| **`misses`** | Motor / targeting aim error (tapped empty space or non-interactive boundary) | Tapped spinning wheel rim; clicked blank space between bubbles |
| **`timeouts`** | Target or trial countdown expired with no valid touch registered | Countdown reached 0s in Mobile Target Bubble Chase; time cap in Crowded Search |

### Core Mathematical Equations

Let the total attempts denominator be:
$$\text{attempts} = \text{correct} + \text{wrongTaps} + \text{misses} + \text{timeouts}$$

1. **Accuracy (%):**
   $$\text{accuracy} = \begin{cases} \text{round}_1\left(\frac{\text{correct}}{\text{attempts}} \times 100\right), & \text{if } \text{attempts} > 0 \\ 0.0\%, & \text{if } \text{attempts} = 0 \end{cases}$$
   *(Note: An unplayed or empty sitting is strictly 0.0%, never 100%).*

2. **Error Rates (%):**
   $$\text{wrongTapRate} = \text{round}_1\left(\frac{\text{wrongTaps}}{\text{attempts}} \times 100\right)$$
   $$\text{missRate} = \text{round}_1\left(\frac{\text{misses}}{\text{attempts}} \times 100\right)$$
   $$\text{timeoutRate} = \text{round}_1\left(\frac{\text{timeouts}}{\text{attempts}} \times 100\right)$$

3. **Reaction Time Metrics:**
   - **`avgReactionSec`**: Arithmetic mean of valid **correct-hit** reaction times:
     $$\text{avgReactionSec} = \frac{\sum_{i=1}^{N_{\text{valid}}} \text{reactionMs}_i}{1000 \times N_{\text{valid}}}$$
   - **`medianReactionSec`**: 50th percentile (median) of valid correct reaction times.
   - *Crucial Rule:* Error taps and aim misses are **excluded** from reaction time calculations.

4. **Efficiency Index (Index of Performance):**
   $$\text{efficiencyIndex} = \text{round}_1\left(\frac{\text{accuracy}}{\text{avgReactionSec}}\right)$$
   Measures speed-accuracy trade-off. Higher scores reflect faster, more accurate processing.

5. **Legacy Compatibility Rule:**
   $$\text{legacyWrong} = \text{wrongTaps} + \text{misses} + \text{timeouts}$$

---

## 3. Database Schema & Backend API Persistence

### 3.1 The Persist Gate (`sessionResultShouldPersist`)
Before submitting a session to the backend, the client evaluates:
```typescript
export const PERSISTABLE_SESSION_ENDED_BY: readonly SessionEndedBy[] = [
  'cleared',    // Deck/sequence was completed
  'completed',  // Protocol trial/round quota reached
  'timeout',    // Global sitting timer expired (as designed by protocol)
];

export function sessionResultShouldPersist(data: SessionResultData): boolean {
  if (data.abandoned || data.endedBy === 'abandoned') return false;
  if (!data.endedBy || !PERSISTABLE_SESSION_ENDED_BY.includes(data.endedBy)) return false;
  return true;
}
```
*If a user clicks Back, leaves mid-trial, or restarts settings during warmup, the session is discarded completely.*

### 3.2 Database Entity (`GameSession`)
Table: `game_sessions` in PostgreSQL (managed via TypeORM in `candela-backend`):

```sql
CREATE TABLE game_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES patient_profiles(id) ON DELETE CASCADE,
    session_number INT NOT NULL,              -- Monotonic 1..N per patient
    client_event_id VARCHAR(80) NOT NULL,      -- UUID v4 client idempotency key
    game_id VARCHAR(64) NOT NULL,             -- e.g. 'rotatory', 'sorting'
    level_id VARCHAR(64),                     -- e.g. 'uppercase', 'numbers'
    device_tier VARCHAR(32),                   -- 'mobile' | 'tablet' | 'tv'
    recorded_at TIMESTAMPTZ NOT NULL,         -- Client completion timestamp
    duration_sec INT NOT NULL,                -- Active play duration
    correct INT NOT NULL,
    wrong_taps INT NOT NULL,
    misses INT NOT NULL,
    timeouts INT NOT NULL,
    accuracy REAL NOT NULL,
    avg_reaction_sec REAL NOT NULL,
    median_reaction_sec REAL NOT NULL,
    efficiency_index REAL NOT NULL,
    reaction_ms JSONB NOT NULL DEFAULT '[]',  -- Array of millisecond ints
    stimuli_count INT NOT NULL,
    game_name VARCHAR(160) NOT NULL,
    bg_color VARCHAR(16),
    stimulus_color VARCHAR(16),
    contrast_percent INT,
    metrics_version INT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT uq_game_sessions_patient_event UNIQUE (patient_id, client_event_id),
    CONSTRAINT uq_game_sessions_patient_number UNIQUE (patient_id, session_number)
);

CREATE INDEX idx_game_sessions_patient_game_time 
ON game_sessions (patient_id, game_id, recorded_at);
```

### 3.3 Concurrency & Monotonic Numbering
In `GameSessionsService.ts`, sessions execute inside a transaction protected by a PostgreSQL advisory lock:
```typescript
await queryRunner.query(
  `SELECT pg_advisory_xact_lock(8713, hashtext($1))`,
  [patientId]
);
```
This guarantees monotonic incrementation of `session_number` without race conditions across multiple client tabs or rapid retries.

---

## 4. Graph Storage & Analytics Plotting Engine

### 4.1 Temporal Scales & Visual Slots
The analytics dashboard (`SessionAnalyticsPanel.tsx`) plots data across three zoom tiers:

| Scale | Visible Window | Slot Width ($N_{\text{slots}}$) | Tick Formatter | Date Key Unit |
| :--- | :--- | :--- | :--- | :--- |
| **`week`** | 7 calendar days | 7 | Day of month (e.g., `16`) | UTC Day (`YYYY-MM-DD`) |
| **`month`** | ~30 calendar days | 30 | Sparse days (`1, 8, 15, 22`) | UTC Day (`YYYY-MM-DD`) |
| **`year`** | 12 calendar months | 12 | Month name (`Jan, Feb...`) | UTC Month (`YYYY-MM`) |

### 4.2 Attempt-Weighted Daily Pooling (`poolSessionsByDate`)
When multiple sessions of a module occur on the same day, they are **never** averaged naively. They are attempt-weighted so that longer sittings correctly dominate the day's metric dot:

$$\text{totalAttempts} = \sum_{s \in \text{Sessions}} (\text{correct}_s + \text{wrongTaps}_s + \text{misses}_s + \text{timeouts}_s)$$

$$\text{pooledAccuracy} = \frac{\sum_{s} \text{correct}_s}{\text{totalAttempts}} \times 100$$

$$\text{wrongTapRate} = \frac{\sum_{s} \text{wrongTaps}_s}{\text{totalAttempts}} \times 100$$

$$\text{missRate} = \frac{\sum_{s} \text{misses}_s}{\text{totalAttempts}} \times 100$$

$$\text{pooledAvgReactionSec} = \frac{\sum_{s} \sum_{ms \in \text{reactionMs}_s} ms}{1000 \times \sum_{s} |\text{reactionMs}_s|}$$

$$\text{pooledEfficiency} = \frac{\text{pooledAccuracy}}{\text{pooledAvgReactionSec}}$$

$$\text{pooledDurationSec} = \text{mean}\left(\{\text{durationSec}_s \mid \text{durationSec}_s > 0\}\right)$$

### 4.3 Aggregation Modes: Pooled vs Best-of-Day
Users can toggle between `'pooled'` and `'best'` mode in the UI:
- **`pooled` (Default):** Uses the formulas above.
- **`best`:**
  - Accuracy: $\max_{s}(\text{accuracy}_s)$
  - Avg Reaction Time: $\min_{s}(\text{avgReactionSec}_s)$
  - Efficiency: $\max_{s}(\text{efficiencyIndex}_s)$
  - Sitting Length: $\min_{s}(\text{durationSec}_s)$
  - Error Rates: Remain the pooled rate across all attempts.

### 4.4 SVG Chart Engine & Tooltip Portaling
- SVG dimensions: Height = 236px, Left padding = 58px, Right = 16px, Top = 16px, Bottom = 28px.
- Point mapping: $X_i = \text{plotPadL} + i \times \text{slotWidth}$; $Y_v = \text{pad.t} + \text{innerH} - \left(\frac{v - \min}{\max - \min}\right) \times \text{innerH}$.
- Tooltips are portaled directly to `document.body` via `createPortal`:
  ```typescript
  createPortal(<div style={{ position: 'fixed', left, top }}>...</div>, document.body)
  ```
  *This prevents container overflow clipping (`overflow: hidden` on parent containers clipping the chart popover).*

---

## 5. Spin Field Family: Deep-Dive Specification

The `spin_field` family focuses on moving visual search, rotational coordination, hemifield lateralization, and sequential 2D spatial arrangement.

### 5.1 Rotatory Wheel (`rotatory`)

#### 5.1.1 Clinical Goal & Principles
Evaluates target acquisition speed, motor precision, and hemifield asymmetries under continuous rotation. **It is not an acuity, reading, or saccade test.**

#### 5.1.2 Bubble Counts Per Device Tier
Assessment counts are strictly locked:
```typescript
export const ROTATORY_BUBBLES_PER_ROUND: Record<DeviceTier, number> = {
  mobile: 4,
  tablet: 6,
  tv: 5,
};
```

#### 5.1.3 Rotation & Polar Mathematics
The wheel rotates continuously at clinical speed $\omega$ (deg/sec) or CSS animation duration $T_{\text{rot}}$.
Given screen center $(c_x, c_y)$ and touch point $(x, y)$:

1. **Relative Cartesian Offsets:**
   $$dx = x - c_x, \quad dy = y - c_y$$

2. **Clock Angle ($\theta_{\text{clock}}$ in degrees, 0° = 12 o'clock / Top, clockwise):**
   $$\theta_{\text{clock}} = \left(\text{atan2}(dx, -dy) \times \frac{180}{\pi} + 360\right) \pmod{360}$$

3. **Normalized Radius ($r_{\text{norm}}$ relative to wheel radius $R$):**
   $$r_{\text{norm}} = \frac{\sqrt{dx^2 + dy^2}}{R}$$

4. **Midline Deadzone (10% Rule):**
   To prevent false left/right lateralization when a target appears near the vertical meridian:
   $$\text{hemifield} = \begin{cases} \text{'midline'}, & \text{if } \frac{|dx|}{R} < 0.10 \\ \text{'left'}, & \text{if } dx < 0 \\ \text{'right'}, & \text{if } dx > 0 \end{cases}$$

5. **Vertical Meridian & Quadrants:**
   - $\text{vertical} = \text{'upper'}$ if $dy < 0$, else $\text{'lower'}$.
   - **Quadrant 1 (Top-Right):** $0^\circ \le \theta < 90^\circ$
   - **Quadrant 2 (Bottom-Right):** $90^\circ \le \theta < 180^\circ$
   - **Quadrant 3 (Bottom-Left):** $180^\circ \le \theta < 270^\circ$
   - **Quadrant 4 (Top-Left):** $270^\circ \le \theta < 360^\circ$

6. **Instantaneous Angular Separation & Crowding Ratio:**
   $$\Delta\theta = \min(|\theta_1 - \theta_2|, 360 - |\theta_1 - \theta_2|)$$
   $$\text{crowdingRatio} = \Delta\theta \times \frac{\pi}{180} \times r_{\text{norm}}$$

7. **Eccentricity Bins:**
   - `inner`: $r_{\text{norm}} < 0.50$
   - `middle`: $0.50 \le r_{\text{norm}} \le 0.75$
   - `outer`: $r_{\text{norm}} > 0.75$

#### 5.1.4 Collision Mechanics & Error Attribution
When a pointer down occurs at $(x_t, y_t)$:
1. Measure Euclidean distance to every active bubble center $i$:
   $$D_i = \sqrt{(x_t - x_i)^2 + (y_t - y_i)^2}$$
2. If $\min_i(D_i) \le \text{bubbleRadius}$:
   - If bubble $i$ is the target stimulus $\implies$ **`correct`**. Pop bubble, record reaction time, trigger positive sound/haptic.
   - If bubble $i$ is a distractor $\implies$ **`wrongTaps`** (Discrimination error). Trigger wobble animation and negative haptic.
3. If $\min_i(D_i) > \text{bubbleRadius}$ but distance to wheel center $\le R$:
   - Tapped empty wheel surface $\implies$ **`misses`** (`aimTaps`).
4. **Crucial Accounting Rule:**
   HUD shows `aimTaps` for the current target. Final session `misses` is the **sum of all aim taps across all completed targets**. If the patient clicks the wheel rim 4 times while searching for "A", that trial logs `aimTaps = 4`.

#### 5.1.5 Session Flow & Trial Phases
1. **Click-to-Start:** Manual trigger prevents autoplay.
2. **Warmup Phase:** Exactly **3 unscored practice trials**. On the 3rd hit, bubbles pop and re-seed into fresh random positions for scored trials.
3. **Unique Stimulus Deck:**
   - Letters: Exactly 26 unique targets (A–Z or a–z).
   - Numbers: Exactly 10 unique targets (0–9).
   - Colors: Exactly 4 colors $\times$ 6 cycles = 24 unique trials.
4. **Pause Rule:** Pausing an open trial marks `validForRt = false` for that trial, but preserves tap counts.

---

### 5.2 Sequential Sorting (`sorting`)

#### 5.2.1 Clinical Goal & Principles
Visual discrimination, spatial scanning, and cognitive sequencing in 2D space.

#### 5.2.2 Non-Overlapping Radius Packing
Bubbles are dynamically positioned across the container using `findNonOverlappingBubblePosition`:
```typescript
export function checkOverlap(
  pos: BubblePosition,
  existing: BubblePosition[],
  minDistPercent: number
): boolean {
  return existing.some((b) => {
    const dx = pos.x - b.x;
    const dy = pos.y - b.y;
    return Math.sqrt(dx * dx + dy * dy) < minDistPercent;
  });
}
```

#### 5.2.3 Dynamic Batching
To prevent visual clutter on small screens:
- **Mobile:** 4 bubbles per batch.
- **Tablet:** 4 to 6 bubbles per batch.
- **Desktop/TV:** 5 to 8 bubbles per batch.
When batch $K$ is cleared, batch $K+1$ animates in until the entire sequence completes.

#### 5.2.4 Sequential Rules & Error Accounting
- Target HUD shows the required next item (e.g., "Find: D").
- Tapping the exact next item in order $\implies$ `correct`. Advances sequence.
- Tapping a visible symbol out of sequence $\implies$ `wrongTaps`. Bubble triggers wobble animation (`wrongIds`).
- Tapping empty background $\implies$ `misses`.

---

## 6. Comprehensive Rules & Mechanics: All Other 12 Modules

### 6.1 Tap Timing Family

#### 1. Mobile Target Bubble Chase (`mobile_target`)
- **Mechanics:** Exactly 1 target bubble and 1 decoy distractor bubble move across a 2D bounding box with elastic wall bounce.
- **Collisions:** Decoy collision deflects along normal vectors with `scatterTimer` to prevent sticking.
- **Trial Timer:** Each set has a 7s countdown. If timer expires $\implies$ `timeouts` (`outcome: 'timeout'`).
- **Tapping decoy** $\implies$ `wrongTaps`. **Tapping target** $\implies$ `correct`. No empty-field misses logged.

#### 2. Pursuit Module (`pursuit`)
- **Mechanics:** Smooth continuous target tracking along sinusoidal, Lissajous, circular, or figure-eight trajectories.
- **Locking:** Patient taps or holds touch on the moving target.
- **Metrics:** Continuous gaze/touch lock percentage, tracking latency, velocity scaling.

#### 3. Gaze Hold / Look Pursuit (`computer_vision`)
- **Mechanics:** Computer-vision webcam tracking (MediaPipe Face Mesh / WebEyeTrack).
- **Target:** Moving fixation point across 9 calibration zones.
- **Invariants:** Session paused automatically if face confidence drops below threshold; pause-shifted clock compensates for tracking loss.

---

### 6.2 Look Jumps Family

#### 4. Crowded Search (`number_search`)
- **Mechanics:** High-density array of distractors (letters/symbols) hiding target digits.
- **Error Rules:** Tapping a letter distractor $\implies$ `wrongTaps`. Tapping empty space between glyphs $\implies$ `misses`.
- **Time Cap:** When session timer expires, any unfound target digits are logged as `timeouts` in the denominator.

#### 5. Hex-Hive Peripheral View (`peripheral_view`)
- **Mechanics:** Central fixation target with honeycomb peripheral cells. Patient must maintain central gaze while detecting peripheral flash stimuli.
- **Outcomes:** Fast periphery tap $\implies$ `correct`; wrong cell $\implies$ `wrongTaps`; missed flash $\implies$ `misses`; timeout $\implies$ `timeouts`.

---

### 6.3 Glimpse Hold Family

#### 6. Hold the Code (`pattern_match`)
- **Mechanics:** Rapid visual presentation: a code card is displayed for $T_{\text{flash}}$ ms, then hidden. Patient identifies matches in a grid.
- **Errors:** Selecting near-miss distractor $\implies$ `wrongTaps`. Empty space $\implies$ `misses`. Timer expiry $\implies$ `timeouts`.

#### 7. Location Memory (`location_memory`)
- **Mechanics:** Grid of tiles revealing symbols. Patient recalls spatial coordinates and finds matched pairs.
- **Errors:** Mismatched pair $\implies$ `wrongTaps`. No empty misses.

#### 8. Direction Sense (`direction_sense`)
- **Mechanics:** Rotated visual stimuli (e.g., E, C, or directional arrows). Patient identifies target orientation (0°, 90°, 180°, 270°).
- **Errors:** Incorrect rotation choice $\implies$ `wrongTaps`.

#### 9. Familiar Faces (`familiar_faces`)
- **Mechanics:** Facial expression / identity matching under varying contrast and luminance noise.
- **Errors:** Wrong emotion or identity choice $\implies$ `wrongTaps`.

---

### 6.4 Trace & Build Family

#### 10. Bee Path Tracing (`bee_tracing`)
- **Mechanics:** Continuous path traversal along Catmull-Rom spline curves from Hive to Flower.
- **Corridor Tolerance:** $T_{\text{band}}$ (Easy: 60px, Medium: 40px, Hard: 24px).
- **Spiral Wall Lock:** Lookahead search window restricted to $[-15 \dots +35]$ points to prevent jumping across spiral coils.
- **Special Metric Override:** `accuracyPercent` is path adherence percentage; does not generate synthetic miss counts.

#### 11. Geoboard: Draw a Pattern (`geoboard`)
- **Mechanics:** Continuous freehand drawing on a 5×5 peg matrix (indices 0 to 24).
- **Segment Decomposition (`decomposeSegment`):** A single stroke across $0 \to 1 \to 2$ is decomposed into unit vectors `[0,1]` and `[1,2]`.
- **Errors:** Stray stroke $< 1.5\%$ of board discarded. Wrong peg connect $\implies$ `wrongTaps`. Missing segment upon submission $\implies$ `misses`.

---

### 6.5 Pediatric Sensory Module

#### 12. Pediatric Wind Chime (`wind_chime`)
- **Mechanics:** 6 suspended musical chime bars with physical clapper and ambient breeze.
- **Synthesizer:** Modal physical synthesis with exponential decay and stereo spatial panning.
- **Clinical Telemetry:** Bilateral symmetry percentage (Left vs Right strikes) and Force modulation index.

---

## 7. Common Bugs, Telemetry Pitfalls & Invariant Checklist

When fixing or refactoring any Candela game module, GPT agents MUST verify against this checklist:

### Checklist for Bug Diagnosis

1. **Pause Drift Invariant:**
   - *Bug:* Tapping pause or leaving the tab causes reaction times to inflate to dozens of seconds.
   - *Fix:* Ensure the trial timer uses `usePauseShiftedClock` or adjusts `onsetAtMs += (resumeTime - pauseTime)`.

2. **Denominated Attempts Invariant:**
   - *Bug:* Accuracy displays as 100% or `NaN%` when a patient clicks nothing or only misses.
   - *Fix:* Always compute `attempts = correct + wrongTaps + misses + timeouts`. If `attempts === 0`, accuracy is strictly `0.0%`.

3. **Rotatory Miss Counting:**
   - *Bug:* Results card reports `misses = 1` even though the patient clicked the wheel 10 times.
   - *Fix:* The HUD displays misses for the *current target*, but final session `misses` must be the accumulated `sum(aimTaps)` across all completed trials.

4. **Persist Gate Enforcement:**
   - *Bug:* Patient quits during warmup, but an incomplete row appears in the database and lowers their historical average.
   - *Fix:* Verify `sessionResultShouldPersist(data)` is checked. If `endedBy === 'abandoned'`, cancel the `POST` request.

5. **Date Pooling & Timezone Consistency:**
   - *Bug:* Graph shows two separate dots for plays completed 10 minutes apart on the same afternoon.
   - *Fix:* All daily groupings must use the standardized UTC key `utcDateKey(session.recordedAt)` (`YYYY-MM-DD`).

6. **Advisory Lock on Session Numbers:**
   - *Bug:* Duplicate key error `uq_game_sessions_patient_number` on rapid session saves.
   - *Fix:* Ensure backend queries execute under `pg_advisory_xact_lock(8713, hashtext(patientId))` before running `MAX(session_number) + 1`.

7. **SVG Tooltip Clipping:**
   - *Bug:* Hover tooltip is truncated or clipped by the card container boundary.
   - *Fix:* Tooltips must be rendered via `createPortal(..., document.body)` with `position: fixed`.
