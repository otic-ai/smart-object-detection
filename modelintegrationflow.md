# Changes Summary - Smart Object Detection

**Date:** April 20, 2026  
**Branch:** detection_layer  

---

## Overview

This changeset implements the **on-device YOLOv8 detection layer** with real-time camera frame processing. The changes add the core ML model integration, detection engine, and UI updates to support continuous object detection from the camera feed.

---

## Files Modified

### 1. **package.json**
- **Added Dependencies:**
  - `expo-image-manipulator` (v~14.0.8) — For frame resizing before model inference
  - `react-native-fast-tflite` (v^1.6.1) — TensorFlow Lite bindings for on-device ML inference

**Impact:** Enables image manipulation and TFLite model execution on device

---

### 2. **src/screens/CameraDetectionScreen.tsx**
**Major refactoring of camera detection UI component**

#### Changes:
- **Import statements:** Converted to double quotes (style consistency), added `useDetectionLoop` import
- **Added prop:** `onDetectionResult` callback to receive detection results from the engine
- **Component state:** 
  - Added `useDetectionLoop()` hook invocation to manage model lifecycle
  - Destructured `isModelReady` and `modelError` from hook
  
- **Camera layout restructuring:**
  - Changed from conditional rendering (camera XOR inactive overlay) to **layered rendering**
  - `CameraView` now **always mounted** (prevents frame capture interruption)
  - Inactive overlay now uses `absoluteFillObject` positioning and `zIndex: 20` to float above camera
  - Added detection overlay wrapper (`styles.overlay`) that persists when camera is active
  
- **UI Improvements:**
  - Loading state: Displays "Loading model…" while `isModelReady` is false
  - Error handling: Shows `modelError` message in red text if model fails to load
  - Bounding box rendering: Same structure, now properly overlaid on persistent camera
  
- **Code formatting:** Improved JSX formatting with better line breaks for readability

**Impact:** Camera now processes frames continuously; overlay state changes don't interrupt detection loop

---

## Files Added (Untracked)

### 3. **src/detection/DetectionEngine.tsx**
**Core ML inference engine**

#### Functionality:
- **Class:** `DetectionEngine` — Singleton managing TensorFlow Lite model
- **Key methods:**
  - `loadModel()` — Initializes YOLOv8n model from bundled `yolov8n_float32.tflite`
  - `inference(frameBuffer)` — Runs model on frame data, applies NMS (Non-Maximum Suppression)
  - `dispose()` — Releases model resources
  
- **Constants:**
  - `CONFIDENCE_THRESHOLD = 0.5` (50% minimum confidence)
  - `NMS_IOU_THRESHOLD = 0.45` (IoU overlap for duplicate detection suppression)
  - `INPUT_SIZE = 640` (YOLOv8n input dimensions)
  
- **Output:** `DetectionEngineResult` interface with label, confidence, and bbox (percentage-based)
- **Labels:** Uses COCO dataset labels (80 object classes)

**Impact:** Enables offline inference on device with optimized YOLOv8n model

---

### 4. **src/detection/useDetectionLoop.tsx**
**React hook managing continuous frame capture & detection**

#### Functionality:
- **Props:**
  - `onDetectionResult` — Callback fired with each detection
  - `cameraRef` — Reference to CameraView for frame capture
  - `throttleMs` — Frame polling interval (default 500ms)
  
- **Returns:** `{ isModelReady, modelError }`
  
- **Lifecycle:**
  - Mount: Loads model via `detectionEngine.loadModel()`
  - Cleanup: Disposes model resources
  - While ready: Polls camera frames at throttle interval, runs inference, invokes callback
  
- **Frame handling:** Uses `expo-image-manipulator` to resize frames to 640×640 before model input

**Impact:** Decouples detection logic from UI component; reusable across screens

---

### 5. **src/detection/labels.tsx**
**COCO dataset label mappings**

- Contains array of 80 COCO object class labels (e.g., "person", "car", "bottle", etc.)
- Used by `DetectionEngine` to map model output indices to human-readable labels

**Impact:** Enables semantic output from raw model predictions

---

### 6. **src/utils/frameThrottle.tsx**
**Utility for frame rate limiting**

- Provides throttling mechanism to prevent excessive inference calls
- Ensures detection runs at controlled intervals (not every frame)

**Impact:** Optimizes CPU/GPU usage; prevents UI jank from continuous inference

---

### 7. **assets/models/yolov8n_float32.tflite**
**YOLOv8 nano TensorFlow Lite model**

- Pre-trained YOLOv8 nano model (smallest variant)
- Float32 precision for accurate inference
- 640×640 input size
- Bundled with app for offline inference

**Impact:** Core ML model enabling real-time object detection on-device

---

### 8. **metro.config.js**
**Metro bundler configuration** (likely added for build configuration)

---

## Architecture Summary

```
Camera Feed
    ↓
[CameraDetectionScreen] —(mounts)→ useDetectionLoop hook
    ↓
[useDetectionLoop] —(polls frames via cameraRef)→ Frame snapshots
    ↓
[Frame resizing] (expo-image-manipulator) → 640×640 RGB buffer
    ↓
[DetectionEngine.inference()] —(TFLite/fast-tflite)→ YOLOv8n model
    ↓
[NMS post-processing] → BoundingBox objects
    ↓
[onDetectionResult callback] → CameraDetectionScreen updates UI
    ↓
[Overlay rendering] → Bounding boxes + labels rendered on camera
```

---

## Key Technical Decisions

1. **Always-mounted camera:** Prevents frame capture interruption when toggling pause/resume
2. **Layered rendering:** Inactive overlay floats above camera using absolute positioning
3. **Hook-based detection:** Decouples ML logic from UI; enables reuse
4. **Offline inference:** TFLite model bundled and loaded on-device; no network dependency
5. **Nano model:** YOLOv8n chosen for balance of speed vs. accuracy on mobile
6. **Float32 precision:** Prioritizes accuracy over model size
7. **Frame throttling:** Prevents excessive inference; keeps UI responsive

---

## Performance Considerations

- **Frame polling:** 500ms throttle (default) = ~2 FPS inference
- **Model size:** YOLOv8n is ~6-7MB, lightweight for mobile
- **Inference latency:** ~100-200ms on modern Android phones
- **Memory:** Uses refs to avoid unnecessary re-renders during frame processing

---

## Next Steps / TODO

- [ ] Wire `onDetectionResult` prop in parent navigation component
- [ ] Test end-to-end detection pipeline on physical device
- [ ] Tune `throttleMs` and `CONFIDENCE_THRESHOLD` for target accuracy/performance
- [ ] Add detection history logging
- [ ] Implement correction learning screen integration
- [ ] Handle model loading errors gracefully (retry, fallback UI)
- [ ] Optimize frame resizing performance

---

## Testing Notes

- Model loading state should show "Loading model…" briefly on app start
- After loading, camera should show continuous bounding boxes for detected objects
- Toggling pause/resume should not reset detection state
- Confidence threshold should filter low-confidence false positives
- NMS should prevent duplicate overlapping boxes for same object

---

**End of Changes Summary**
