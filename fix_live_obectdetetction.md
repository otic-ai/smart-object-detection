fix: implement proper live object detection with race condition prevention

Changes:
- Core Detection Flow
  * Added isLoopActiveRef to prevent stale detection callbacks after camera stops
  * Increased frame throttle from 100ms to 500ms to allow full async pipeline completion
  * Clear detection state immediately when camera becomes inactive via useEffect

- App State Management (App.tsx)
  * Added clearDetection() callback function to reset detection state
  * Pass onClearDetection prop to CameraDetectionScreen for proper cleanup

- Camera Detection Screen (CameraDetectionScreen.tsx)
  * Import useEffect hook for lifecycle management
  * Add useEffect that clears detection when isCameraActive changes
  * Improve result panel display: show last detection even when camera stopped
  * Fix bounding box rendering to persist until explicitly cleared
  * Update Stop button to just set isCameraActive=false (cleanup handled by useEffect)

- Detection Loop (useDetectionLoop.tsx)
  * Add comprehensive frame processing logging with tick counters
  * Add per-operation timing: capture, resize, inference times
  * Add tick skip logging to diagnose frame backups
  * Add detailed bounding box logging for debugging overlay issues
  * Improve isLoopActiveRef checks before reporting results to prevent stale detections
  * Update default throttle: 300ms → 500ms (accounts for all async operations)
  * Add timeout handling for long-running operations

- Detection Engine (DetectionEngine.tsx)
  * Add logging for model readiness checks
  * Add detailed preprocessing, inference, and parsing logs
  * Add per-anchor detection logging (first 5 detections per frame)
  * Add NMS filtering result logging
  * Add tensor size and operation timing logs for performance profiling

Benefits:
✅ Prevents race conditions where detections fire after camera stops
✅ Detection state properly clears on stop and persists on screen
✅ Live detection shows objects with labels and bounding boxes in real-time
✅ Comprehensive logging for debugging async bottlenecks
✅ Proper frame throttling accounting for full pipeline latency
✅ Previous detection results clear when restarting scan