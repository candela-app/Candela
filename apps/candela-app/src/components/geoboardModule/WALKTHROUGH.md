# Geoboard Module (Candela Vision Therapy) - Technical Walkthrough

## Overview
The **Geoboard Module** trains visual-motor integration, form constancy and spatial memory by asking the patient to reproduce a reference figure on a 5&times;5 peg grid. It is a **fixed-playlist** module: the clinician picks a board, configures the session once, and every pattern in that board runs in order before the results report opens.

---

## Session Flow

```
Geoboard module card
  └─ Board picker (Boards 01-05)
       └─ Clinical Settings modal   ← gates the session; Cancel returns to the picker
            └─ Pattern 1 … Pattern N   ← auto-advances, no interruption
                 └─ Session results
```

- The settings modal opens **before** the board, not from inside it. Saving settings starts the session; cancelling exits back to the picker.
- Each pattern ends when the patient presses **Done** (or **Skip**, or the optional timer expires). A pass/fail overlay shows for 1.3 s, then the next pattern loads automatically.
- After the last pattern the session report opens. **Play Again** reopens settings so the protocol can be changed between runs.

### Routing
| URL | View |
| --- | --- |
| `?page=dashboard&therapy=vision&module=geoboard` | Board picker |
| `…&game=geoboard&board=<1-5>` | Live session for that board |

`board` is validated against the known board ids and falls back to Board 01.

---

## Boards & Pattern Library

Patterns live in `packages/shared/src/geoboard-logic.ts` as `GEOBOARD_PATTERNS`; board playlists are declared in `GEOBOARD_BOARDS` and resolved through `getBoardPatterns(boardId, variant)`.

| Board | Contents | Patterns | Clinical focus |
| --- | --- | --- | --- |
| 01 Lines | Single strokes, diagonals, parallels, right angle | 12 | Dot targeting & straight-line motor control |
| 02 Alphabets | A–Z uppercase, or a lowercase set | 26 / 22 | Letter form reproduction & orthographic mapping |
| 03 Shapes | Square, rectangle, triangle, diamond, trapezoid, pentagon, cross, X, chevron, hourglass | 10 | Closure, angle & vertex planning |
| 04 Numbers | Digits 0–9 | 10 | Numeral form reproduction & sequencing |
| 05 Compound | Arrow, kite, house, envelope, boxed X, asterisk, star, double square | 8 | Sequential planning & sustained spatial attention |

### Grid indexing
```
Row 0:  0   1   2   3   4
Row 1:  5   6   7   8   9
Row 2: 10  11  12  13  14
Row 3: 15  16  17  18  19
Row 4: 20  21  22  23  24
```
A pattern is a list of `[startDot, endDot]` pairs. Segments may span several dots; `decomposeSegment` splits them into collinear unit pieces so that scoring is insensitive to whether the patient drew one long line or several short ones.

### Lowercase layout (Board 02)
Five rows cannot hold ascender, x-height and descender zones at normal proportions, so lowercase uses a compressed three-zone layout: **row 0 = ascender**, **rows 1–3 = x-height with the baseline at row 3**, **row 4 = descender**.

- `a`, `e`, `s` and `g` are **deliberately omitted** — their curves collapse into unreadable shapes when reduced to straight segments on this grid. That is why the lowercase set is 22 letters, not 26.
- `i` and `j` carry their tittle as a one-unit stroke one row above the stem, with a visible gap. A segment-based format cannot express a single point.

---

## Settings (`packages/shared/src/ClinicalSettingsModal.tsx`)

The Geoboard controls are a section inside the **shared** settings modal (`showGeoboardControls`), alongside the pursuit and bee-tracing sections, so every module keeps one settings surface.

| Control | Values | Effect |
| --- | --- | --- |
| Patient Name | free text | Recorded on the session |
| Letter Case | Uppercase / Lowercase | **Board 02 only.** Swaps the playlist. Reuses the shared `AlphabetVariant` type |
| Matrix Density | 25 / 17 / 13 / 9 / 5 | Dots removed from the answer grid |
| Response Transform | Duplicate, Mirror H, Mirror V, Rotate 90&deg; CW/CCW | The answer the patient must produce |
| Memory Mode + Preview | on/off, 2–15 s | Model is shown for the preview interval, then hidden |
| Time Limit | Off / 15 / 30 / 45 / 60 s | Per pattern, not per session |
| Metronome + Tempo | on/off, 40–140 BPM | Audible pacing cue |
| Ocularity | Right / Left / Binocular | Recorded on the session (occlusion is physical) |
| Stimulus Contrast | 15–100% | Blends the model colour toward the board colour |
| Palette | Board / Model / Pen | Colour pickers with a live contrast preview |

---

## Implementation Notes

### Matrix density
`getGeoboardGridDots` removes 0 / 8 / 12 / 16 / 20 dots for tiers 1–5, **but never removes a dot that the target pattern uses as a vertex**. On dense patterns fewer dots can be removed than the tier nominally asks for, so the HUD shows the actual live count rather than the tier label.

Density applies to the **answer grid only**. The model grid keeps all 25 dots because it functions as a reference card.

### Transforms
The model grid always renders the pattern as authored. The scored target is `applyTransformToPattern(pattern.segments, transform)`, so under a mirror or rotation the patient must produce the transformed figure rather than copy what they see.

### Drawing — a pen, not a dot-connector
The board is drawn on, not tapped on. The patient presses anywhere and draws with a finger or stylus; the ink follows the hand, and a connection is recorded whenever that ink runs through a dot. No line is ever produced on the patient's behalf, which is what makes the trial a visual-**motor** task rather than a pointing task.

A **stroke** is one pen-down to pen-up gesture, stored as `{ points, dots }`: the raw ink and the ordered dots it ran through. `drawnSegments` — the thing `evaluateDrawing` scores — is derived from consecutive dots across all strokes, so scoring is a read-out of the drawing rather than a parallel state to keep in sync.

- **Ink** is sampled at a minimum spacing of 0.6% of the board and smoothed with quadratic curves through point midpoints, so jitter reads as handwriting instead of a polyline.
- **A press that does not travel** at least 1.5% of the board is discarded as a stray touch. This is what removed the old tap-then-tap behaviour, where touching a dot instantly produced a straight line to the previously selected one.
- **Snap radius** is 9% of the grid box; hidden dots are not selectable.
- Registered connections are drawn faintly beneath the ink and the dots they used light up, so it is always visible what the pen actually caught.
- Strokes are **add-only**; erasing is done through **Undo Stroke** and **Clear Board**, so a wobbly hand cannot delete correct work by drawing back over it.

Performance: the in-progress stroke is held in a ref and written straight to its `<path>` element's `d` attribute, so a 60Hz pen does not re-render the board on every sample. Only stroke completion and dot capture go through React state. Both canvases use a `0 0 100 100` viewBox with `vector-effect="non-scaling-stroke"`, so pattern coordinates are used directly as user units while line weights stay in device pixels.

### Pen colour
`GEOBOARD_PEN_COLORS` (in `geoboard-logic.ts`) offers six named presets spanning long-, medium- and short-wavelength hues, so a pen can be chosen that stays visible for a given colour vision deficiency. Any other colour is available through the free picker; `getPenColorName` resolves a hex back to its preset name or `Custom`.

The chosen colour is carried on the session result as `penColor` + `penColorName` and shown on the results card, so a session can later be repeated under the same visual conditions. It is part of the payload a session row will store once a database exists.

### Responsive layout & scrolling
The module mounts inside a clipped full-screen wrapper, so the scroll container is `.mainLayout` itself (`height: 100dvh; overflow-y: auto`) rather than the page. A `100vh` fallback precedes the `dvh` declaration so browsers without `dvh` still get a bounded, scrollable container.

- **Portrait phones and tablets (&le;900px)**: the two boards stack vertically at `min(86vw, 440px)` instead of shrinking side by side, and the patient scrolls between the model and their own board.
- Neither board carries a visible caption. "Model" / "Your board" labels and the scroll cue were together costing about 60px of stacked height for information the layout already conveys — the model is the board that cannot be drawn on, and in memory mode the model announces itself through its own overlay. The distinction is kept for assistive technology through `role` + `aria-label` on each board.
- **Scroll snap** (portrait only): `.mainLayout` uses `scroll-snap-type: y mandatory` with `scroll-snap-stop: always` on each board. A flick from the model always parks on the drawing board (top border aligned to the top of the screen, with room for the pull-tab above it). A second scroll reaches the Undo / Clear / Skip / Done row (`scroll-snap-stop: normal`, so it is reachable but not a trap). Scrolling back up stops on the drawing board first, then on the model.
- **Landscape phones (&le;560px tall)**: boards are capped by viewport height instead of width.
- The answer grid sets `touch-action: none` so drawing never scrolls the view. Scrolling is done from the surrounding area — the labels, the action row and the margins around the board.
- Each new pattern smooth-scrolls the container back to the top, so the session never resumes with the reference off screen.

### Header vs. compact control dock
The header bar costs roughly 70px of height that a phone cannot spare, so it is not shown everywhere. A single media query — portrait up to 1024px, or landscape under 620px tall — swaps one control surface for the other, with no JavaScript breakpoint (and therefore no hydration mismatch):

| Viewport | Controls |
| --- | --- |
| Desktop / tablet landscape | Sticky header with High Contrast, Settings, Menu, Exit |
| Phones (either orientation), tablets in portrait | Header hidden; transparent left-arrow pull-tab |

On stacked portrait the handle sits in the gap between the two boards, on the right edge, as a transparent left arrow. Pulling it opens the same control panel; the arrow flips right so it can be pushed closed. On landscape phones the tab is pinned to the right edge of the screen so it does not sit between the two side-by-side boards.

The panel holds High Contrast, Clinical Settings, Session Menu, Exit, the drawing hint, and the full trial readout — pattern position, pattern name, visible grid dots, transform and time remaining. Nothing is dropped on small screens — it is relocated, so no clinical setting becomes unreachable. A countdown, when a time limit is set, stays as a badge on the arrow itself rather than behind a tap, and turns amber under 10 seconds. Panel rows are 44px minimum for paediatric touch targets.

### Scoring (`evaluateDrawing`)
Both the drawing and the target are normalised into deduplicated unit segments; a trial is correct only on exact set equality. Failures are classified as:

| Error type | Meaning |
| --- | --- |
| `wrong-dot` | A line reaches a dot that is not part of the target figure |
| `wrong-shape` | All dots used are correct, but they are connected differently |
| `incomplete` | The drawing is a strict subset of the target |

### Contrast
`getContrastAdjustedColor` mixes the model colour toward the board colour per RGB channel. Applying CSS opacity to the grid instead would fade the background and the dots as well, which is not what a contrast-sensitivity setting is supposed to vary.

### Fatigue detection
After six trials, a banner appears if mean reaction time over the last three trials exceeds **1.8&times;** the mean of the first three, or if accuracy across the last four drops below **40%**. It is advisory and never interrupts the session.

### Session time cap
A **10-minute** cap is checked as each trial is committed. A session cut short by the cap is reported with `status: 'incomplete'`.

---

## Metrics

### Per trial (`GeoboardTrialMetric`)
`reactionTimeMs`, `firstDotLatencyMs` (planning time before the first connection), `corrections` (undo/clear presses), `segmentsDrawn` vs `segmentsTarget`, `errorType`, `timedOut`, `dotTapSequence`, and a `halfField` tally.

### Hemifield tally
Each target unit segment is assigned to the left or right half by its midpoint column against the grid midline; segments centred exactly on the midline are excluded from both. A persistent gap on one side across a session is the signal worth reading — it can indicate hemifield neglect.

### Session (`GeoboardSessionResultData`)
Accuracy, average reaction time, average planning time, total corrections, timeout count, left/right hemifield accuracy, an error-type breakdown, pen colour, and a 1–5 star rating (&ge;90% = 5, &ge;75% = 4, &ge;60% = 3, &ge;40% = 2, else 1).

The results card (`components/shared/GameResultsModal.tsx`) renders a Geoboard-specific block when the payload carries `boardId` + `leftHalfAccuracy`, and swaps the two generic placeholder tiles for real planning-time and correction figures.

---

## Colour Rationale

Defaults are chosen for clinical legibility rather than aesthetics:

| Role | Value | Reason |
| --- | --- | --- |
| Board | `#FFFFFF` | Matches the printed geoboard the patient already works on, and gives the model the maximum available luminance contrast |
| Model | `#000000` | Maximum contrast against the board, so the target is never the limiting factor in a trial |
| Pen | `#FBBF24` | Separated from the black model on hue as well as luminance, so the patient's own work stays distinguishable from the target |

All three are clinician-adjustable per session. Note that amber on white is a deliberate trade: it is chosen so the pen never reads as part of the model, at the cost of pen-to-board luminance contrast. For a patient with reduced contrast sensitivity, either darken the pen or switch the board to a dim navy (`#0B1220`), which is what the surrounding shell is built around.

A high-contrast accessibility toggle swaps the shell — not the board — to a black/white/yellow token set. The hidden-model overlay carries its own scrim so it stays legible whatever the board is set to.

---

## Deliberately Not Implemented

- **Adaptive difficulty.** `geoboardDifficultyProgression` still exists in shared but is unused here — per-trial difficulty jumps are incompatible with a fixed playlist. Difficulty is set once, in settings.
- **Persistence.** No database is configured for this phase. Sessions live in component state and leave via PNG card or CSV export only.
- **Ocularity enforcement.** The field is recorded on the session; occlusion is physical and not simulated on screen.
- **Metronome scoring.** The beat is a pacing cue; connections are not scored against it.
- Legacy `GeoboardProtocol` fields `patternId` and `complexityTier` are vestigial in the board flow — trial complexity is read from each pattern instead.

---

## Files

| File | Role |
| --- | --- |
| `geoboardModule/GeoboardGame.tsx` | Fixed-playlist engine, drawing surface, HUD |
| `geoboardModule/GeoboardGame.module.css` | Therapy-grade palette tokens & layout |
| `shared/src/geoboard-logic.ts` | Pattern library, board manifests, transforms, scoring, snap helpers, metrics |
| `shared/src/types.ts` | `GeoboardBoardId`, protocol, trial & session result types |
| `shared/src/ClinicalSettingsModal.tsx` | Geoboard settings section |
| `app/page.tsx` | Board picker view and `board` query param |
| `components/shared/GameResultsModal.tsx` | Geoboard results block |

---

## Verification & Testing
- Rendered the entire pattern library as ASCII to confirm every authored letter, digit and figure is legible on a 5&times;5 grid before committing.
- Type-checked `packages/shared` and `apps/candela-app`; production build of the app passes.
- Confirmed both Geoboard routes (picker and live board) respond 200 in dev.
