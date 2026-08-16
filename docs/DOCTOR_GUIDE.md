# Doctor Portal Clinical Guide

## Overview

The **Doctor Portal** (`/doctor`) gives ophthalmologists, optometrists, and vision therapists a dedicated workspace to onboard patients, customize therapy prescriptions, and track assignments.

---

## 1. Clinician Workflow

```mermaid
graph TD
    Doctor[Doctor Dashboard /doctor]
    Doctor --> HeaderBadge["Clinic DocID Badge"]
    Doctor --> CreatePatient["Onboard New Patient"]
    Doctor --> SearchPatients["Real-Time Patient Search"]
    Doctor --> SelectPatient["Select Patient"]

    SelectPatient --> PrescribeModules["Toggle Module Prescriptions"]
    PrescribeModules --> ConfigLevels["Granular Level Playlist Selection"]
```

---

## 2. Onboarding Patients

1. Enter patient **Name**, **Phone**, **Email**, and initial **Password**.
2. Click **Create patient**.
3. The patient is automatically linked to the clinician's **DocID** (`origin: doctor_created`).
4. A success toast confirms patient creation and auto-selects the patient for immediate prescription setup.

---

## 3. Real-Time Patient Search

- **Search Bar**: Positioned at the top of the Patients list.
- **Search Scope**: Instantly filters by patient **name**, **email**, or **phone number** as you type.
- **Quick Clear**: Click the `X` icon inside the search input to reset the filter.

---

## 4. Customizing Prescriptions & Level Playlists

### Module Toggling
- Switch any therapy module **ON** or **OFF** for the selected patient.
- When a module is turned **ON**, all difficulty levels are enabled by default for clinical flexibility.

### Granular Level Playlist Customization
- Expand any prescribed module to view its individual difficulty tiers (e.g. Level 1 Easy, Level 2 Medium, Level 3 Complex, Speed/Contrast variations).
- Check or uncheck specific levels to assign tailored playlists matching the patient's visual motor recovery stage.
- Changes save instantly to the backend with confirmation toast notifications.
