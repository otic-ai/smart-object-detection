# SYNTHETIC_EYE — Smart Object Detection (Mobile AI Pipeline)

## Overview

**SYNTHETIC_EYE** is a real-time AI object detection mobile app built with **Expo React Native** and **TypeScript**. It features a futuristic dark UI with neon green/cyan accents, bounding-box camera overlays, a correction & learning system, and a detection history log.

The detection pipeline follows a multi-layer architecture:

> **Detect → Understand → Match → Learn**

This system is designed to be:

- **Real-time** — low-latency camera-based detection
- **Mobile-first** — runs entirely on-device (no cloud dependency)
- **Intelligent** — context-aware object identification
- **Self-improving** — learns from user corrections over time

---

## Current Status: Camera Live (Phase 2)

The app foundation is complete and the live camera feed is active. `CameraView` from `expo-camera` is wired into the Scan screen with a full runtime permission request flow. Detection state is managed in `App.tsx` and flows down to all screens. The real YOLOv8 AI pipeline is the next integration step.

### What's been built

| Area | Status |
|---|---|
| Expo + TypeScript project (SDK 54) | ✅ Done |
| `useAppTheme()` dark token system | ✅ Done |
| Custom `useState` router (no React Navigation) | ✅ Done |
| `MobileBottomNav` — Scan / Learn / History tabs | ✅ Done |
| `TopAppBar` — logo + AI ACTIVE badge | ✅ Done |
| `ScreenContainer` — dark wrapper component | ✅ Done |
| Detection state lifted to `App.tsx` (single source of truth) | ✅ Done |
| Camera Detection screen — empty/waiting state, live bounding box overlay | ✅ Done |
| Correction & Learning screen — live detection prop, no hardcoded data | ✅ Done |
| Detection History screen — computed stats from live history array | ✅ Done |
| Confirm / Correct flow wired end-to-end across screens | ✅ Done |
| `expo-camera` — `CameraView` + runtime permission flow | ✅ Done |
| Real YOLOv8 / TFLite model integration | 🔌 Placeholder ready |
| `expo-sqlite` detection database | 🔌 Placeholder ready |

---

## Objectives

- Detect objects from a live camera feed using YOLOv8
- Extract additional signals (OCR text, colour, size)
- Match detections to structured data with a confidence score
- Handle unknown objects gracefully
- Learn and improve from user corrections over time

---

## Getting Started

### Prerequisites

- Node.js 18+
- Expo CLI (`npm install -g expo-cli`)
- Expo Go app on your phone, or an Android/iOS emulator

### Install & Run

```bash
# Clone the repo
git clone https://github.com/otic-ai/smart-object-detection.git
cd smart-object-detection

# Install dependencies
npm install

# Start the dev server
npx expo start
```

Then press `a` for Android, `i` for iOS simulator, or scan the QR code with **Expo Go**.

### Run on a USB-connected Android device

From the project root, with the device connected by USB and USB debugging enabled:

```bash
# Confirm the device is visible
adb devices

# Start the Metro/Expo server
npx expo start --localhost --clear

# In another terminal, connect the device to Metro
adb reverse tcp:8081 tcp:8081

# Rebuild and install the debug app for the connected device ABI
npx expo run:android --variant debug --active-arch-only

# Launch the installed app
adb shell monkey -p com.otic.syntheticeye -c android.intent.category.LAUNCHER 1
```

For this project, the package name is `com.otic.syntheticeye`.

---

## Project Structure

```
App.tsx                          ← Root: router + shared detection state (activeDetection, history)
index.ts                         ← registerRootComponent (Expo entry)
app.json                         ← SYNTHETIC_EYE name/slug + camera permissions
src/
  theme/
    appTheme.ts                  ← useAppTheme() — typed dark token system (neon green + cyan)
  types/
    navigation.ts                ← AppRoute = 'scan' | 'learn' | 'history' + NavigationProps
    detection.ts                 ← Detection, BoundingBox, SuggestionMatch interfaces
  components/
    MobileBottomNav.tsx          ← Custom state-driven tab bar (no RN Navigation lib)
    TopAppBar.tsx                ← SYNTHETIC_EYE logo + AI ACTIVE badge
    ScreenContainer.tsx          ← SafeAreaView dark background wrapper
  screens/
    CameraDetectionScreen.tsx    ← Scan tab — waiting state → live bounding boxes + result panel
    CorrectionLearningScreen.tsx ← Learn tab — live detection prop + search + Save Correction
    DetectionHistoryScreen.tsx   ← History tab — computed stats + FlatList (empty until model runs)
```

---

## Screens

### Scan — `CameraDetectionScreen`
Requests camera permission on first launch. Once granted, shows a live `CameraView` with sci-fi corner bracket overlays. Starts in a **"Waiting for detection…"** state. Once the YOLOv8 model calls `onDetectionResult()`, bounding boxes render as absolute overlays on the camera feed and the bottom panel shows the top detection label and confidence score. **Confirm** and **Correct** buttons are disabled until the model produces output.

### Learn — `CorrectionLearningScreen`
Shows a **"Nothing to correct"** empty state when no active detection is pending. When the user taps **Correct** on the Scan screen, this screen receives the live detection via props, displays it, and lets the user type the correct label. Saving calls `onSaveCorrection()` in `App.tsx`, which records the corrected entry to the history array.

### History — `DetectionHistoryScreen`
Starts completely empty. Detections confirmed or corrected on the Scan screen append to a live array in `App.tsx`. Stats (total, accuracy %, last scan time) are computed dynamically from that array — no hardcoded values. Items are colour-coded by status: **Corrected** (green border), **Ambiguous** (red border), **Verified** (default).

---

## UI Logic

### State Machine (`App.tsx`)

All state lives in `App.tsx` — screens are purely presentational.

```
activeDetection: Detection | null   ← null until model fires
activeBoundingBoxes: BoundingBox[]  ← [] until model fires
detectionHistory: Detection[]       ← [] until user confirms/corrects
```

### Screen Behaviour

#### Scan — `CameraDetectionScreen`

| Condition | UI |
|---|---|
| Permission not yet determined | Checking camera permission… (loading state) |
| Permission denied | "Camera access required" screen + **Grant Permission** button |
| Permission granted, `detection === null` | Live `CameraView` + "Waiting for detection…" + buttons **disabled** |
| Permission granted, `detection !== null` | Label + confidence in result panel + buttons **enabled** |
| `boundingBoxes.length > 0` | Boxes rendered as absolute overlays on the live camera feed |

- **Confirm** → `onConfirm()` → marks `verified`, appends to history, clears active state
- **Correct** → `navigateTo('learn')` → Learn screen receives the active detection

#### Learn — `CorrectionLearningScreen`

| Condition | UI |
|---|---|
| `currentDetection === null` | "Nothing to correct" empty state |
| `currentDetection !== null` | Detection card (live label / confidence / status) + text input |
| `searchText.trim() === ''` | Save button **disabled** |
| `searchText.trim() !== ''` | Save button **enabled** |

- **Save Correction** → `onSaveCorrection(label)` → marks `corrected`, appends to history, clears active state, navigates back to Scan

#### History — `DetectionHistoryScreen`

| Condition | UI |
|---|---|
| `history.length === 0` | "No detections yet" empty state + stats showing `0 / 0% / —` |
| `history.length > 0` | Stats computed live + FlatList colour-coded by status |

### Data Flow

```
YOLOv8 model
     │  onDetectionResult(detection, boxes)
     ▼
App.tsx  ──── activeDetection ────► CameraDetectionScreen
         ──── activeBoundingBoxes ──► (bounding box overlay)
         ◄─── onConfirm() ──────────── Confirm button
         ◄─── navigateTo('learn') ──── Correct button
              │
              ▼
         CorrectionLearningScreen ◄── currentDetection (prop)
         ◄─── onSaveCorrection(label) ─ Save button
              │
              ▼
         detectionHistory[] ─────────► DetectionHistoryScreen
                                        (computed stats + FlatList)
```

### Key Rules
- **No screen owns any state** — they only receive props and call callbacks
- **Buttons are disabled** until there is something to act on (guards in JSX, not callbacks)
- **History is append-only** — confirmed = `verified`, corrected = `corrected`; active state clears after either action

---

## Dependencies

| Package | Purpose |
|---|---|
| `expo` ~54 | Expo SDK |
| `expo-status-bar` | Status bar |
| `expo-camera` | Live camera feed — `CameraView` + `useCameraPermissions` wired into Scan screen |
| `expo-linear-gradient` | Background gradients |
| `react-native-safe-area-context` | Notch / Dynamic Island safe areas |
| `@expo/vector-icons` | MaterialCommunityIcons |

> **No React Navigation.** Routing is a custom `useState<AppRoute>` machine in `App.tsx`.

---

## System Architecture

The app is structured around 5 pipeline layers. The frontend (Phase 1) is complete. Layers 1–5 require AI/backend integration.

### 1. Detection Layer — YOLOv8 (Client Side)

**Status:** 🔌 Camera live — model integration pending

The live camera feed is active via `CameraView`. The next step is attaching a frame processor to feed frames into an on-device YOLOv8 / TFLite model.

- ✅ `CameraView` rendering with `cameraRef` ready for frame capture
- 🔌 Attach frame processor (e.g. `react-native-fast-tflite` or `react-native-vision-camera`)
- 🔌 Call `onDetectionResult(detection, boxes)` with model output each frame
- Target: 10–30 FPS

```json
{ "class": "bottle", "confidence": 0.87, "bbox": [x, y, width, height] }
```

### 2. Feature Extraction Layer

**Status:** 🔌 Not yet implemented

Enhances raw detections with additional signals (OCR text, dominant colour, bounding box ratio).

```json
{ "class": "bottle", "ocr_text": "coca cola", "color": "red", "confidence": 0.87 }
```

### 3. Normalization Layer

**Status:** 🔌 Not yet implemented

Converts raw detection data into a standardised object identity using rule-based and similarity-based matching.

```json
{ "label": "soft_drink", "normalized_name": "cola", "confidence": 0.82 }
```

### 4. Matching & Scoring Layer

**Status:** 🔌 Not yet implemented

Scores are composed of:

```
score = OCR similarity (50%) + class match (20%) + color match (10%) + historical match (20%)
```

| Confidence | Action |
|---|---|
| ≥ 0.8 | Accept match |
| 0.5–0.8 | Return suggestions |
| < 0.5 | Mark as UNKNOWN |

### 5. Learning Layer

**Status:** 🔌 Placeholder in `CorrectionLearningScreen.tsx`

Saves user corrections to a local database to improve future accuracy. Hook into `handleSaveCorrection()` in `CorrectionLearningScreen.tsx`.

---

## AI Integration Points

All integration points are marked with `🔌 AI INTEGRATION POINT` comments in the code.

| File | What to connect |
|---|---|
| [App.tsx](App.tsx) | Call `onDetectionResult(detection, boxes)` from the YOLOv8 / TFLite model on each frame; wire `onSaveCorrection` to persist to `expo-sqlite` |
| [src/screens/CameraDetectionScreen.tsx](src/screens/CameraDetectionScreen.tsx) | ✅ `CameraView` live. Next: attach a frame processor to `cameraRef` and call `onDetectionResult(detection, boxes)` with model output each frame |
| [src/screens/CorrectionLearningScreen.tsx](src/screens/CorrectionLearningScreen.tsx) | Replace the dashed "No suggestions yet" placeholder with real similarity-search results from your object database |
| [src/screens/DetectionHistoryScreen.tsx](src/screens/DetectionHistoryScreen.tsx) | Replace the in-memory `history` array in `App.tsx` with `expo-sqlite` persistence (no changes needed to this screen itself) |

---

## Technical Constraints

### Must Use
- Expo React Native (managed workflow)
- Client-side YOLOv8 model (no cloud detection)
- TypeScript throughout

### Avoid
- Cloud-based detection APIs
- Blocking the UI thread
- Model sizes > 50MB

---

## Definition of Done

A feature is complete when:

- Works on a real device via Expo
- No crashes or UI blocking
- Handles edge cases gracefully
- Code is clean, typed, and documented
- PR is reviewed and approved

---

## Final Goal

> Camera sees object → system understands → returns meaningful result → improves over time

The frontend foundation is complete. The next step is connecting the YOLOv8 detection pipeline to the placeholder points listed above.
