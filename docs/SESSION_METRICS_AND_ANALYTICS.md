# Session metrics, persistence, and analytics

How a finished play becomes scores, a saved row, and a chart dot. Web and mobile share this model via `@candela/shared`.

**Contents**

1. [Error taxonomy](#1-error-taxonomy)
2. [Formulas](#2-formulas)
3. [Per-module mapping](#3-per-module-mapping)
4. [What is saved](#4-what-is-saved)
5. [IDs: play vs visit vs chart](#5-ids-play-vs-visit-vs-chart)
6. [Analytics plots](#6-analytics-plots)
7. [How to read the charts](#7-how-to-read-the-charts)
8. [APIs and storage](#8-apis-and-storage)
9. [Code map](#9-code-map)

Related: [ARCHITECTURE.md](./ARCHITECTURE.md) · [PATIENT_AND_GAMES_FLOW.md](./PATIENT_AND_GAMES_FLOW.md) · [DOCTOR_GUIDE.md](./DOCTOR_GUIDE.md)

---

## 1. Error taxonomy

Every stored play splits errors. Do not lump them into one “wrong” count for plots.

| Field | Meaning | Example |
|---|---|---|
| **Correct** | Valid hit on the current target | Tapped the called letter |
| **Wrong taps** | Tapped a **stimulus that is not the target** | Wrong bubble, letter instead of digit, near-miss code |
| **Misses** | Tapped **empty space** / background / wheel (aim miss) | Clicked the Rotatory wheel, Sorting field, Crowded Search empty area |
| **Timeouts** | Target or timer **expired** with no valid hit | Hold the Code time limit with matches left |

Legacy `wrong` on a result row is the **sum** `wrongTaps + misses + timeouts` for older UI. Analytics uses the split fields.

Bee tracing can override accuracy with a path-adherence percent (`accuracyPercent` in `buildSessionMetrics`). That does not invent fake wrong-tap / miss counts.

Code: `packages/shared/src/session-metrics.ts` (`buildSessionMetrics`).

---

## 2. Formulas

Let `attempts = correct + wrongTaps + misses + timeouts`.

| Metric | Formula | Notes |
|---|---|---|
| **Accuracy (%)** | `correct / attempts × 100` | Empty play is **0%**, never 100%. One decimal (`round1`). |
| **Wrong-tap rate** | `wrongTaps / attempts × 100` | |
| **Miss rate** | `misses / attempts × 100` | |
| **Timeout rate** | `timeouts / attempts × 100` | |
| **Avg / median RT** | Mean / median of **correct-hit** reaction times (seconds) | Errors are not in the RT average. |
| **Efficiency** | `accuracy (%) / avg RT (s)` | Index of Performance. Higher = faster and more accurate. |

Store **counts** and plot **rates**. Raw error counts can fall just because the play had fewer trials.

Results card headline: Duration, Accuracy, Avg RT, count (Bubbles / Matches / Rounds / …), Efficiency.

---

## 3. Per-module mapping

Same taxonomy in every game. A module with no empty-tap path does not invent misses.

| Module | Wrong taps | Misses | Timeouts |
|---|---|---|---|
| **Rotatory** | Discrimination: tapped a bubble that is not the target | Each **wheel / empty** tap (`sum of aimTaps`, not “trials with a miss”) | — |
| **Sorting** | Wrong bubble in sequence | Background tap | — |
| **Crowded Search** | Tapped a letter | Empty field | Timer expired with digits left |
| **Hold the Code** | Near-miss / wrong code | Empty field | Timer expired with matches left |
| **Peripheral View** | Trial outcome `wrong` | Trial outcome `miss` | Trial outcome `timeout` |
| **Geoboard** | Wrong-dot / wrong-shape | Incomplete shape (not timed out) | Pattern time limit |
| **Bee tracing** | — | Path deviations (by design) | — |
| **Location Memory, Direction Sense, Familiar Faces** | Wrong choice / wrong cell | No empty-field miss | Timer where the protocol has one |
| **Bubble Chase** | Decoy tap | No empty-field miss | — |
| **Pursuit / Look Pursuit** | Incorrect lock | — | Trial timeout |

**Rotatory tap counting:** HUD “Misses” is wheel taps on the current target. Results **Misses** is the **sum of those taps** across finished targets. Five wheel clicks on one letter → **5**, not 1.

---

## 4. What is saved

Saving is triggered when a **results card opens**, then gated once in `payloadFromSessionResult` / `sessionResultShouldPersist`. The same gate applies to **every** module.

### Persist (enters `game_sessions` and charts)

| `endedBy` | When |
|---|---|
| `cleared` | Protocol finished (deck / last round / last target) |
| `timeout` | Session timer expired — that **is** the protocol |
| `completed` | Finished sitting, including Geoboard **time cap** |

### Do not persist

| Outcome | Why |
|---|---|
| Quit / Leave / Back mid-game | Incomplete; would distort accuracy and Efficiency |
| Reset / settings restart | Same |
| `endedBy: 'abandoned'` or `abandoned: true` | Quit flag |
| Warmup-only then leave | Not a scored sitting |

Rotatory leave matches the other games: progress is **lost**, not saved as abandoned.

Timed-out Hold the Code or Crowded Search with remaining matches/digits **is** saved; leftovers count as **timeouts** in the denominator.

---

## 5. IDs: play vs visit vs chart

Three different ideas. Mixing them breaks plots.

### Current (implemented)

| ID | What it is |
|---|---|
| Client `sessionId` | Local random / timestamp on the results card. **Not** the clinical key. |
| Backend `sessionNumber` | Sequential **1, 2, 3… per finished play** for that patient. Unique per `(patientId, sessionNumber)`. Survives doctor transfer. |
| `clientEventId` | Idempotency so retries do not insert twice. Unique per `(patientId, clientEventId)`. |
| Chart **X-axis** | **Date** (not session number). Same-day plays are **pooled** into one dot. |

Results UI shows the backend `sessionNumber` after a successful POST (`useSavedSessionNumber`).

There is **no** daily visit grouping yet. Two finished games on the same day get **two** session numbers.

### Intended visit model (not implemented yet)

Goal: one **visit** per patient per **local calendar day**, so all games that day share a visit number, without inventing rows for games they skipped.

```
Patient
  └── Visit 12  (local date 2026-09-06)
        ├── Play: Rotatory   (own metrics, own row)
        ├── Play: Sorting
        └── (no Bee row — Bee chart has no dot that day)
```

| Layer | Role |
|---|---|
| **Visit** | Grouping key / display “Visit 12”. First **persisted** play of the local day creates it. Missed calendar days do not consume a number. |
| **Play** | One finished game (current `game_sessions` row). |
| **Plot** | Still **date + module**. No fake plays for skipped games. |

Do **not** build a dense grid of `(session × every game)`. Skipping Bee does not leave a hole that must be filled with a session ID. The Bee line simply has no point that day.

Timezone: visit date should be **patient (or clinic) local**, not UTC. Today’s date key for plots uses UTC (`utcDateKey`).

---

## 6. Analytics plots

Patient dashboard and doctor patient analytics share `SessionAnalyticsPanel`.

| Behaviour | Detail |
|---|---|
| One **date** per dot | Filter one **module** (and optionally one **level**) for a clean line. “All modules” is noisy. |
| **Week / month / year** | **−** zooms out (week → month → year). **+** zooms in. Year uses one pooled dot per month. Axis title is the latest month (`Sep-09` / `September-09`) or year (`2026`). Ticks are day numbers (week), sparse days 1 / 8 / 15 / 22 (month), or month names (year). Hover still shows the full date. |
| **Level filter** | Pick a module first. **All levels** = whole-module plot. A chosen level = that playlist only. |
| Same-day pooling | Default: attempt-weighted **pooled average**. Optional **best of day**. |
| Tooltip | Date, value, each play’s session #, accuracy, RT. Web tooltip is portaled to `document.body` (`position: fixed`) so overflow panes (chooser, overflow-hidden) do not clip it into a thin bar. |
| Preliminary | Fewer than 5 dates with data. |
| Empty state | **No graphs yet** — no sample / fake series. |
| Unfinished plays | Never in the series (section 4). |

Plotted metrics: Accuracy, Avg reaction time, Efficiency, Wrong-tap rate, Miss rate.

Copy lives in `packages/shared/src/session-analytics-copy.ts`.

---

## 7. How to read the charts

Do not treat two dots as a confident “getting better” line. Pick **one module** so the line compares like with like.

| Pattern | Reading |
|---|---|
| Accuracy ↑, RT stable | Finding the target more reliably |
| Accuracy ↑, RT ↓ | Real improvement (also check Efficiency) |
| Accuracy ↑, RT ↑ a lot | Slowing down to stay correct — not necessarily more skilled |
| RT ↓, accuracy ↓ | Rushing — look at wrong taps and misses |
| Efficiency ↑ | Better speed–accuracy together (the “getting better” line when Accuracy and RT disagree) |
| Wrong taps ↓, RT stable, accuracy ↑ | Better discrimination |
| Misses ↓, wrong taps stable | Better aiming / motor control |
| Accuracy ↑ but wrong + miss counts flat | Check if they just did fewer trials — that is why we plot **rates** |

Efficiency = Index of Performance = `accuracy (%) ÷ mean RT (seconds)`.

---

## 8. APIs and storage

| Method | Path | Who |
|---|---|---|
| `POST` | `/api/game-sessions` | Patient — create if persist gate passed |
| `GET` | `/api/game-sessions` | Patient — own history |
| `GET` | `/api/doctors/me/patients/:patientId/game-sessions` | Doctor — that patient’s history |

Table `game_sessions`: counts (`correct`, `wrong_taps`, `misses`, `timeouts`), rates (`accuracy`, `efficiency_index`, reaction stats), `session_number`, `client_event_id`, `game_id`, `recorded_at`.

Session numbers do **not** reset if the patient changes doctor. Rows cascade-delete with the patient profile.

---

## 9. Code map

| Concern | Where |
|---|---|
| Accuracy, rates, Efficiency | `packages/shared/src/session-metrics.ts` |
| How-to-read copy | `packages/shared/src/session-analytics-copy.ts` |
| Persist gate | `packages/shared/src/game-session.ts` → `sessionResultShouldPersist`, `payloadFromSessionResult` |
| `endedBy` / `abandoned` | `packages/shared/src/types.ts` (`SessionEndedBy`, `PERSISTABLE_SESSION_ENDED_BY`) |
| Rotatory tap sums | `packages/shared/src/rotatory-logic.ts` → `summarizeRotatorySession` |
| Daily pooling | `packages/shared/src/game-session.ts` → `poolSessionsByDate` |
| POST after results | `apps/candela-app/src/lib/use-saved-session-number.ts`, `apps/candela-mobile/src/lib/use-saved-session-number.ts` |
| API | `apps/candela-backend/src/game-sessions/` |
| DB row | `apps/candela-backend/src/entities/game-session.entity.ts` |
| Charts | `apps/candela-app/src/components/shared/SessionAnalyticsPanel.tsx` (web), `apps/candela-mobile/src/components/SessionAnalyticsPanel.tsx` |
