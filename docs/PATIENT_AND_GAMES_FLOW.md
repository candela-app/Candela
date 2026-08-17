# Patient Experience & Vision Therapy Modules

## 1. Patient Journey

```mermaid
graph TD
    Patient[Patient Dashboard /dashboard]
    Patient --> PrescribedFilter{"Is patient linked to Doctor?"}

    PrescribedFilter -->|Yes (Doctor-Managed)| PrescribedView["Displays Doctor's Prescribed Modules & Levels"]
    PrescribedFilter -->|No (unlinked)| FullCatalogView["Displays All Platform Therapy Modules"]

    PrescribedView --> LaunchGame["Launch Interactive Exercise"]
    FullCatalogView --> LaunchGame

    LaunchGame --> ClinicalSettings["Configure Clinical Settings\n(Speed, Size, Contrast, Audio, Haptics)"]
    ClinicalSettings --> PlaySession["Play Therapy Exercise"]
    PlaySession --> ResultsReport["Clinical Results Modal\n(Accuracy, Reaction Time, Completion Rate)"]
```

Unlinked patients (self-signup, or unlinked after a doctor is deleted) see the full catalog. They attach or switch from **`/docid`** (header **DocID** on the dashboard), not from the module grid. Attach and reassignment are confirmed by the **requested doctor**. Admin transfers are confirmed by the **patient**. After a successful attach, only prescribed modules remain. Details: [DOCID_AND_MAIL.md](./DOCID_AND_MAIL.md).

---

## 2. Therapy Modules Catalog

| Module ID | Display Name | Clinical Objective | Interactive Mechanism |
|---|---|---|---|
| `rotatory` | **Rotating Wheel & Bubble Pop** | Fixation stability, oculomotor tracking, saccadic accuracy | Rotating peripheral ring with spawning color-coded target bubbles requiring timed burst interaction. |
| `sorting` | **Visual-Motor Sorting** | Visual discrimination, category classification, spatial motor coordination | Active drag-and-drop or tap-sorting of geometric shapes, colors, and clinical stimuli into target buckets. |
| `bee_tracing` | **Bee Flight Tracing** | Continuous pursuit, fine hand-eye motor tracking, form constancy | Guided animated bee following complex paths (linear, sinusoidal, figure-8, spiral) within clinical tolerance bands. |
| `pursuit` | **Smooth Pursuit Tracker** | Continuous foveal tracking, visual pursuit velocity calibration | Dynamically moving target stimulus with selectable trajectory patterns, velocity curves, and background distractors. |
| `mobile_target` | **Mobile Target Saccades** | Rapid saccadic relocation, visual attention, peripheral detection | Rapidly moving and jumping target requiring precise touch/click registration within strict reaction time windows. |
| `geoboard` | **Geoboard Visual Memory** | Spatial memory, visual-motor integration, pattern reproduction | 5x5 peg grid pattern reproduction training working spatial memory and orientation. |

---

## 3. In-Game Clinical Settings & Analytics

Every game module provides a standardized **Clinical Settings Modal** allowing clinicians and patients to calibrate:
- **Stimulus Speed**: Slow, Normal, Fast, Progressive Acceleration.
- **Target Size & Contrast**: High contrast, Low contrast, Dynamic chromatic scales.
- **Audio & Haptic Feedback**: Positive reinforcement chime, error cue, vibration triggers.
- **Session Results Modal**: Immediate post-session metrics summarizing hits, misses, latency, and visual field accuracy.
