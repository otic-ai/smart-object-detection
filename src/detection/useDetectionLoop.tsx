import { useEffect, useRef, useState } from "react";
import { Detection, BoundingBox } from "../types/detection";
import { detectionEngine } from "./DetectionEngine";
import * as ImageManipulator from "expo-image-manipulator";
import { CameraView } from "expo-camera";

interface UseDetectionLoopOptions {
  onDetectionResult: (detection: Detection, boxes: BoundingBox[]) => void;
  cameraRef: React.RefObject<CameraView | null>;
  /**
   * How often to capture + run inference (ms).
   * 500ms = ~2fps. Accounts for: takePictureAsync + ImageManipulator + model inference.
   * Actual FPS depends on device performance. Check console logs for timing breakdown.
   */
  throttleMs?: number;
  isActive: boolean;
}

interface UseDetectionLoopReturn {
  isModelReady: boolean;
  modelError: string | null;
}

export function useDetectionLoop({
  onDetectionResult,
  cameraRef,
  isActive,
  throttleMs = 500,
}: UseDetectionLoopOptions): UseDetectionLoopReturn {
  const [isModelReady, setIsModelReady] = useState(false);
  const [modelError, setModelError] = useState<string | null>(null);
  const isRunningRef = useRef(false);
  const frameCountRef = useRef(0);
  const isLoopActiveRef = useRef(false); // Track if loop is actually running

  // Load TFLite model once on mount
  useEffect(() => {
    let cancelled = false;
    console.log("[Loop] 📦 Loading model...");
    detectionEngine
      .loadModel()
      .then(() => { 
        if (!cancelled) {
          console.log("[Loop] ✅ Model loaded successfully");
          setIsModelReady(true);
        }
      })
      .catch((err) => {
        console.error("[Loop] ❌ model load failed:", err);
        if (!cancelled) setModelError(`Failed to load model: ${err}`);
      });
    return () => {
      cancelled = true;
      detectionEngine.dispose();
    };
  }, []);

  // Capture → resize → decode → infer every throttleMs when active
  useEffect(() => {
    if (!isModelReady || !isActive || !cameraRef.current) {
      isLoopActiveRef.current = false;
      if (isActive) console.log(`[Loop] ⏸ Not ready: modelReady=${isModelReady}, hasRef=${!!cameraRef.current}`);
      return;
    }

    isLoopActiveRef.current = true;
    console.log("[Loop] 🎥 Starting detection loop with throttle:", throttleMs, "ms");
    let isMounted = true;
    let tickCount = 0;
    const interval = setInterval(async () => {
      tickCount++;
      // Skip this tick if previous inference is still running or loop has been stopped
      if (isRunningRef.current) {
        console.log(`[Loop] TICK #${tickCount} - Skipped (inference running)`);
        return;
      }
      if (!isMounted) {
        console.log(`[Loop] TICK #${tickCount} - Skipped (not mounted)`);
        return;
      }
      if (!isLoopActiveRef.current) {
        console.log(`[Loop] TICK #${tickCount} - Skipped (loop not active)`);
        return;
      }
      if (!cameraRef.current) {
        console.log(`[Loop] TICK #${tickCount} - Skipped (no camera ref)`);
        return;
      }

      console.log(`[Loop] TICK #${tickCount} - Processing frame...`);

      try {
        isRunningRef.current = true;
        frameCountRef.current++;
        const frameStart = Date.now();

        // 1. Capture frame from camera (no skipProcessing — needed for correct orientation)
        const captureStart = Date.now();
        console.log(`[Loop] TICK #${tickCount}, Frame #${frameCountRef.current} - Calling takePictureAsync...`);
        const photo = await cameraRef.current.takePictureAsync({ quality: 0.4 });
        const captureTime = Date.now() - captureStart;
        console.log(`[Loop] TICK #${tickCount}, Frame #${frameCountRef.current} - takePictureAsync returned in ${captureTime}ms, uri=${!!photo?.uri}`);

        if (!photo?.uri) {
          console.warn("[Loop] ❌ Frame #" + frameCountRef.current + " - takePictureAsync returned no URI");
          return;
        }

        // 2. Resize to 640×640 and get JPEG base64
        //    JPEG (not PNG) because jpeg-js decodes to raw RGBA in Hermes without
        //    needing TextDecoder('latin1') which Hermes does not support.
        const resizeStart = Date.now();
        console.log(`[Loop] TICK #${tickCount}, Frame #${frameCountRef.current} - Calling ImageManipulator.manipulateAsync...`);
        const resized = await ImageManipulator.manipulateAsync(
          photo.uri,
          [{ resize: { width: 640, height: 640 } }],
          { base64: true, format: ImageManipulator.SaveFormat.JPEG }
        );
        const resizeTime = Date.now() - resizeStart;
        console.log(`[Loop] TICK #${tickCount}, Frame #${frameCountRef.current} - ImageManipulator returned in ${resizeTime}ms, hasBase64=${!!resized.base64}`);

        if (!resized.base64) {
          console.warn("[Loop] ❌ Frame #" + frameCountRef.current + " - ImageManipulator returned no base64");
          return;
        }

        // 3. Decode PNG → RGBA pixels → run YOLOv8 inference
        const inferenceStart = Date.now();
        console.log(`[Loop] TICK #${tickCount}, Frame #${frameCountRef.current} - Calling detectFromBase64...`);
        const results = await detectionEngine.detectFromBase64(resized.base64, 640, 640);
        const inferenceTime = Date.now() - inferenceStart;
        console.log(`[Loop] TICK #${tickCount}, Frame #${frameCountRef.current} - detectFromBase64 returned ${results.length} results in ${inferenceTime}ms`);

        if (results.length === 0) {
          // Normal — model ran fine but nothing was above the 50% threshold
          console.log(`[Loop] TICK #${tickCount}, Frame #${frameCountRef.current} - No detections above threshold`);
          return;
        }

        // Check again if loop is still active before reporting results
        if (!isLoopActiveRef.current) {
          console.log("[Loop] ℹ️ Detection found but loop stopped, discarding results");
          return;
        }

        const totalTime = Date.now() - frameStart;
        console.log(`[Loop] ✅ Frame #${frameCountRef.current}: ${results.length} detection(s): ${results.map(r => r.label).join(", ")} | Timing: Capture=${captureTime}ms, Resize=${resizeTime}ms, Inference=${inferenceTime}ms, Total=${totalTime}ms`);

        // 4. Map results to bounding boxes
        const boxes: BoundingBox[] = results.map((r) => ({
          x: r.bbox.x,
          y: r.bbox.y,
          width: r.bbox.width,
          height: r.bbox.height,
          label: r.label,
          confidence: r.confidence,
        }));

        const top = results[0];
        const detection: Detection = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          label: top.label,
          confidence: top.confidence,
          status: top.confidence >= 80 ? "verified" : "ambiguous",
          timestamp: new Date().toLocaleTimeString(),
          boundingBoxes: boxes,
        };

        onDetectionResult(detection, boxes);
      } catch (e) {
        console.warn("[Loop] frame error:", e);
      } finally {
        isRunningRef.current = false;
      }
    }, throttleMs);

    return () => {
      isLoopActiveRef.current = false;
      isMounted = false;
      clearInterval(interval);
      console.log("[Loop] 🛑 Detection loop stopped. Frames processed:", frameCountRef.current);
      frameCountRef.current = 0;
    };
  }, [isModelReady, isActive, onDetectionResult, throttleMs]);

  return { isModelReady, modelError };
}