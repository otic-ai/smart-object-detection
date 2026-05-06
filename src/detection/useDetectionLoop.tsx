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
   */
  throttleMs?: number;
  isActive: boolean;
}

interface UseDetectionLoopReturn {
  isModelReady: boolean;
  modelError: string | null;
  modelLoadProgress: string | null;
}

export function useDetectionLoop({
  onDetectionResult,
  cameraRef,
  isActive,
  throttleMs = 500,
}: UseDetectionLoopOptions): UseDetectionLoopReturn {
  const [isModelReady, setIsModelReady] = useState(
    // If preloadModel() was called at app start the model may already be ready
    () => detectionEngine.ready
  );
  const [modelError, setModelError] = useState<string | null>(null);
  const [modelLoadProgress, setModelLoadProgress] = useState<string | null>(
    detectionEngine.ready ? null : "Initialising…"
  );
  const isRunningRef = useRef(false);
  const frameCountRef = useRef(0);
  const isLoopActiveRef = useRef(false);

  // ── Model load ──────────────────────────────────────────────────────────────
  // If preloadModel() was already called in App.tsx, loadModel() resolves
  // immediately (same cached promise). No duplicate loads ever happen.
  useEffect(() => {
    // Already ready (preloaded before this screen mounted)
    if (detectionEngine.ready) {
      setIsModelReady(true);
      setModelLoadProgress(null);
      return;
    }

    let cancelled = false;
    const loopLoadStart = Date.now();
    console.log("[Loop] 📦 Awaiting model load...");
    setModelLoadProgress("Loading TFLite model…");

    detectionEngine
      .loadModel()
      .then(() => {
        if (!cancelled) {
          const loopLoadMs = Date.now() - loopLoadStart;
          console.log(`[Loop] ✅ Model ready in ${loopLoadMs}ms (includes any preload wait)`);
          setModelLoadProgress(null);
          setIsModelReady(true);
        }
      })
      .catch((err) => {
        console.error("[Loop] ❌ Model load failed:", err);
        if (!cancelled) {
          setModelLoadProgress(null);
          setModelError(`Failed to load model: ${err}`);
        }
      });

    return () => {
      cancelled = true;
      // ⚠️ Do NOT call detectionEngine.dispose() here.
      // The singleton is shared across the app. Disposing on unmount would
      // force a full reload every time the user navigates away from the scan tab.
    };
  }, []);

  // ── Detection loop ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isModelReady || !isActive || !cameraRef.current) {
      isLoopActiveRef.current = false;
      if (isActive) {
        console.log(
          `[Loop] ⏸ Not ready: modelReady=${isModelReady}, hasRef=${!!cameraRef.current}`
        );
      }
      return;
    }

    isLoopActiveRef.current = true;
    console.log("[Loop] 🎥 Starting detection loop, throttle:", throttleMs, "ms");
    let isMounted = true;
    let tickCount = 0;

    const interval = setInterval(async () => {
      tickCount++;

      if (isRunningRef.current) return; // previous frame still processing
      if (!isMounted || !isLoopActiveRef.current || !cameraRef.current) return;

      try {
        isRunningRef.current = true;
        frameCountRef.current++;
        const frameStart = Date.now();

        // 1. Capture — with timeout + retry
        const captureStart = Date.now();
        let photo: any = null;
        let lastError: Error | null = null;

        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            if (attempt > 1) {
              console.log(`[Loop] TICK #${tickCount} - Retry ${attempt}/3`);
            }
            const timeout = new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error(`attempt ${attempt} timeout`)), 5000)
            );
            photo = await Promise.race([
              cameraRef.current!.takePictureAsync({
                quality: 0.3,       // lower quality = smaller JPEG = faster decode
                base64: true,       // get base64 directly — skip ImageManipulator disk I/O
                skipProcessing: true,
                exif: false,
              }),
              timeout,
            ]);
            if (photo?.base64) break;
          } catch (err) {
            lastError = err as Error;
            if (attempt < 3) {
              await new Promise((r) => setTimeout(r, 50 * Math.pow(2, attempt - 1)));
            }
          }
        }

        const captureTime = Date.now() - captureStart;

        if (!photo?.base64) {
          console.warn(
            `[Loop] TICK #${tickCount} ❌ Capture failed after ${captureTime}ms: ${lastError?.message}`
          );
          return;
        }

        // 2. Resize via ImageManipulator so model gets correct 640×640 input.
        //    We keep this step because takePictureAsync gives full-res frames;
        //    passing a 4K image directly to jpeg-js + preprocess is slower than
        //    letting ImageManipulator resize on the native side first.
        const resizeStart = Date.now();
        const resized = await ImageManipulator.manipulateAsync(
          `data:image/jpeg;base64,${photo.base64}`, // use in-memory URI, no disk read
          [{ resize: { width: 640, height: 640 } }],
          { base64: true, format: ImageManipulator.SaveFormat.JPEG }
        );
        const resizeTime = Date.now() - resizeStart;

        if (!resized.base64) {
          console.warn("[Loop] ❌ ImageManipulator returned no base64");
          return;
        }

        // 3. Inference
        const inferenceStart = Date.now();
        const results = await detectionEngine.detectFromBase64(resized.base64, 640, 640);
        const inferenceTime = Date.now() - inferenceStart;

        if (results.length === 0) return;
        if (!isLoopActiveRef.current) return; // stopped while inferring

        const totalTime = Date.now() - frameStart;
        console.log(
          `[Loop] ✅ #${frameCountRef.current} [${results.map(r => r.label).join(', ')}] | ` +
          `capture=${captureTime}ms  resize=${resizeTime}ms  infer=${inferenceTime}ms  TOTAL=${totalTime}ms`
        );

        // 4. Map to BoundingBox[]
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
        console.warn("[Loop] Frame error:", e);
      } finally {
        isRunningRef.current = false;
      }
    }, throttleMs);

    return () => {
      isLoopActiveRef.current = false;
      isMounted = false;
      clearInterval(interval);
      console.log("[Loop] 🛑 Stopped. Frames processed:", frameCountRef.current);
      frameCountRef.current = 0;
    };
  }, [isModelReady, isActive, onDetectionResult, throttleMs]);

  return { isModelReady, modelError, modelLoadProgress };
}
