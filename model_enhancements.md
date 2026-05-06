# SYNTHETIC_EYE — Changes & Optimisations

## Overview

This document covers all the changes made to the SYNTHETIC_EYE React Native (Expo) object detection app. The work focused on two goals:

1. **Fix a type error** in `CameraDetectionScreen.tsx` that was causing a TypeScript compile failure
2. **Reduce latency** in model loading and object detection by restructuring the pipeline

---

## Files Changed

- `src/detection/DetectionEngine.tsx`
- `src/detection/useDetectionLoop.tsx`
- `src/screens/CameraDetectionScreen.tsx`
- `App.tsx`

---

## 1. Bug Fix — `CameraDetectionScreen.tsx`

### Problem

The `onDetectionResult` prop was typed as `(input: NormalizationInput, boxes: BoundingBox[]) => void`, but `useDetectionLoop` emits a fully-formed `Detection` object — not a `NormalizationInput`. This caused a TypeScript error:

```
Type '(input: NormalizationInput, boxes: BoundingBox[]) => void' is not assignable to
type '(detection: Detection, boxes: BoundingBox[]) => void'.
  Property 'className' is missing in type 'Detection' but required in type 'NormalizationInput'.
```

### Fix

Changed the prop type to match what `useDetectionLoop` actually emits:

```ts
// Before
onDetectionResult: (input: NormalizationInput, boxes: BoundingBox[]) => void;

// After
onDetectionResult: (detection: Detection, boxes: BoundingBox[]) => void;
```

Removed the now-unnecessary `NormalizationInput` import from the screen.

---

## 2. Model Loading Latency — `DetectionEngine.tsx`

### Problem

`loadModel()` had a broken loading guard. The `isLoading` flag was set to `true` inside the try block but the `if (this.isLoading) return` guard ran before it was ever set, meaning concurrent calls would all attempt to load the model simultaneously. More importantly, model loading was triggered lazily — only when `CameraDetectionScreen` mounted — so the user always saw a spinner when first opening the Scan tab.

### Fix: Promise Cache

Replaced the broken flag approach with a `_loadPromise` cache. The first call kicks off the load and stores the Promise. Every subsequent call — from anywhere in the app — returns the same in-flight Promise, so the model is never loaded twice.

```ts
private _loadPromise: Promise<void> | null = null;

async loadModel(): Promise<void> {
  if (this.isLoaded) return;
  if (this._loadPromise) return this._loadPromise; // same promise, no duplicate load

  this._loadPromise = (async () => {
    // ... load model ...
    // On failure: this._loadPromise = null (allows retry)
  })();

  return this._loadPromise;
}
```

### Fix: `preloadModel()` export

Added a `preloadModel()` helper that is called at app startup (module level in `App.tsx`), so the model starts loading before the user ever taps the Scan tab:

```ts
// DetectionEngine.tsx
export function preloadModel(): void {
  detectionEngine.loadModel().catch((err) =>
    console.warn("[DetectionEngine] Background preload failed:", err)
  );
}

// App.tsx — runs immediately when the JS bundle loads
preloadModel();
```

### Fix: `_preprocessFrame` optimisation

The pixel preprocessing loop runs 640×640 = 409,600 iterations. Small micro-optimisations add up across every frame:

```ts
// Before
const srcX = Math.min(Math.floor(x * scaleX), srcW - 1);
const srcIdx = (srcY * srcW + srcX) * 4;
input[dstIdx] = rgba[srcIdx] / 255;

// After
const srcX = Math.min((x * scaleX) | 0, srcW - 1); // bitwise OR replaces Math.floor
const srcIdx = (srcYOffset + srcX) << 2;            // bitshift replaces *4
const inv255 = 1 / 255;                             // division hoisted out of loop
input[dstIdx] = rgba[srcIdx] * inv255;              // multiply instead of divide
```

### Fix: `_parseOutput` — class loop before bbox read

Moved the bbox coordinate reads (`cx`, `cy`, `w`, `h`) to after the confidence threshold check, so anchors below the threshold skip the coordinate reads entirely:

```ts
// Before: read bbox coords for every anchor, then check score
const cx = data[...]; const cy = data[...]; ...
if (maxScore < CONFIDENCE_THRESHOLD) continue;

// After: check score first, read coords only if passing
if (maxScore < CONFIDENCE_THRESHOLD) continue;
const cx = data[...]; const cy = data[...]; ...
```

---

## 3. Detection Loop — `useDetectionLoop.tsx`

### Problem: `dispose()` called on unmount

The original cleanup function called `detectionEngine.dispose()` when the hook unmounted (i.e. when the user navigated away from the Scan tab). This destroyed the loaded model, forcing a full reload every time the user returned to Scan.

### Fix

Removed `dispose()` from the cleanup. The singleton persists for the app lifetime:

```ts
return () => {
  cancelled = true;
  // ⚠️ Do NOT dispose here — singleton is shared across the app.
  // Disposing on unmount forces a full reload every tab switch.
};
```

### Fix: Instant ready state if preloaded

The hook now checks `detectionEngine.ready` synchronously as its initial state. If `preloadModel()` already finished before the screen mounts, `isModelReady` starts as `true` — no spinner, no wait:

```ts
const [isModelReady, setIsModelReady] = useState(
  () => detectionEngine.ready
);
```

### Fix: Faster frame capture

Changed `takePictureAsync` options to reduce capture time and skip the `ImageManipulator` disk write for the initial capture:

```ts
photo = await cameraRef.current!.takePictureAsync({
  quality: 0.3,        // was 0.4 — smaller JPEG = faster decode
  base64: true,        // get base64 in memory directly
  skipProcessing: true, // skip iOS metadata processing
  exif: false,         // skip exif data
});
```

`ImageManipulator` is still used for the 640×640 resize but now uses an in-memory data URI instead of a disk URI, avoiding a file read:

```ts
// Before — reads from disk
ImageManipulator.manipulateAsync(photo.uri, ...)

// After — in-memory, no disk read
ImageManipulator.manipulateAsync(`data:image/jpeg;base64,${photo.base64}`, ...)
```

---

## 4. `App.tsx` — Pipeline Simplification

### Problem

`App.tsx` was doing normalization (Layer 3/4 pipeline) inside `onDetectionResult`, which expected a `NormalizationInput`. But `useDetectionLoop` already builds a complete `Detection` object — the normalization step in `App.tsx` was redundant and caused the type mismatch.

### Fix

Removed the `normalizeDetection` call and `NormalizationInput` usage from `App.tsx`. The callback now simply lifts the ready-made `Detection` into shared state:

```ts
// Before — App.tsx was doing normalization
const onDetectionResult = useCallback((input: NormalizationInput, boxes: BoundingBox[]) => {
  const normalized = normalizeDetection(input);
  const mapped: Detection = { ... }; // manual construction
  setActiveDetection(mapped);
}, []);

// After — loop already returns a Detection
const onDetectionResult = useCallback((detection: Detection, boxes: BoundingBox[]) => {
  setActiveDetection(detection);
  setActiveBoundingBoxes(boxes);
}, []);
```

---

## 5. Improved Console Logging

All timing logs were updated to be more readable and consistent. Each log line now uses a fixed-width aligned format so timings are easy to scan at a glance.

### Model load
```
[DetectionEngine] 📦 Starting model load...
[DetectionEngine] ✅ Model loaded in 1243ms
[Loop] ✅ Model ready in 1245ms (includes any preload wait)
```

### Per-frame pipeline
```
[DetectionEngine] 🖼️  Frame | b64=12ms  jpeg=45ms  infer=380ms  TOTAL=437ms
[DetectionEngine] 🧠 Inference | preprocess=28ms  run=340ms  parse=12ms  TOTAL=380ms
[Loop] ✅ #3 [bottle, cup] | capture=210ms  resize=95ms  infer=437ms  TOTAL=742ms
```

---

## Expected Performance Improvement

| Step | Before | After |
|---|---|---|
| Model load (first open) | ~1.5–3s spinner | ~0ms if preloaded before tab open |
| Duplicate load calls | Multiple parallel loads | Single shared Promise |
| Model reload on tab switch | Full reload every time | Zero — singleton persists |
| Frame capture | ~300–500ms | ~150–300ms (quality + skipProcessing) |
| ImageManipulator | Disk read + write | In-memory only |
| JS preprocessing | ~80–150ms | ~50–100ms (bitshift + hoisted division) |

---

## How to Run

```bash
npm install

# Development build (required for native TFLite module)
npx expo run:android
npx expo run:ios

# Expo Go (no native modules — for UI-only testing)
npx expo start
```