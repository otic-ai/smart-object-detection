import { useEffect, useRef, useState } from "react";
import { Detection, BoundingBox } from "../types/detection";
import { detectionEngine } from "./DetectionEngine";
import { extractFeatures } from "../pipeline/featureExtractor";
import { matchAndScore, DetectionInput } from "../matching";
import * as ImageManipulator from "expo-image-manipulator";
import { CameraView } from "expo-camera";

interface UseDetectionLoopOptions {
  onDetectionResult: (detection: Detection, boxes: BoundingBox[]) => void;
  cameraRef: React.RefObject<CameraView | null>;
  /**
   * How often to capture + run inference (ms).
   * 500ms = ~2fps. Accounts for: capture + resize + inference + feature extraction.
   */
  throttleMs?: number;
  isActive: boolean;
  /**
   * Past detection labels fed into historyScore.
   * Pass historyRef.current from App.tsx so the loop always sees latest history.
   */
  history?: string[];
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
  history = [],
}: UseDetectionLoopOptions): UseDetectionLoopReturn {
  const [isModelReady, setIsModelReady] = useState(() => detectionEngine.ready);
  const [modelError, setModelError] = useState<string | null>(null);
  const [modelLoadProgress, setModelLoadProgress] = useState<string | null>(
    detectionEngine.ready ? null : "Initialising…"
  );
  const isRunningRef = useRef(false);
  const frameCountRef = useRef(0);
  const isLoopActiveRef = useRef(false);
  // Keep history in a ref so the interval closure always sees the latest value
  const historyRef = useRef<string[]>(history);
  useEffect(() => {
    historyRef.current = history;
  }, [history]);

  // ── Model load ──────────────────────────────────────────────────────────────
  useEffect(() => {
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
          console.log(
            `[Loop] ✅ Model ready in ${loopLoadMs}ms (includes any preload wait)`
          );
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
      // ⚠️ Do NOT dispose — singleton persists across tab switches
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
    console.log(
      "[Loop] 🎥 Starting detection loop, throttle:",
      throttleMs,
      "ms"
    );
    let isMounted = true;
    let tickCount = 0;

    const interval = setInterval(async () => {
      tickCount++;

      if (isRunningRef.current) return;
      if (!isMounted || !isLoopActiveRef.current || !cameraRef.current) return;

      try {
        isRunningRef.current = true;
        frameCountRef.current++;
        const frameStart = Date.now();

        // ── Step 1: Capture ────────────────────────────────────────────────
        // Use photo.uri (native path) — faster for ImageManipulator than data URI
        const captureStart = Date.now();
        let photo: any = null;
        let lastError: Error | null = null;

        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            if (attempt > 1)
              console.log(`[Loop] TICK #${tickCount} - Retry ${attempt}/3`);
            const timeout = new Promise<never>((_, reject) =>
              setTimeout(
                () => reject(new Error(`attempt ${attempt} timeout`)),
                5000
              )
            );
            photo = await Promise.race([
              cameraRef.current!.takePictureAsync({
                quality: 0.1,       // lowest quality — we resize anyway
                skipProcessing: true,
                exif: false,
                // uri only — ImageManipulator handles resize natively
              }),
              timeout,
            ]);
            if (photo?.uri) break;
          } catch (err) {
            lastError = err as Error;
            if (attempt < 3) {
              await new Promise((r) =>
                setTimeout(r, 50 * Math.pow(2, attempt - 1))
              );
            }
          }
        }

        const captureTime = Date.now() - captureStart;

        if (!photo?.uri) {
          console.warn(
            `[Loop] TICK #${tickCount} ❌ Capture failed after ${captureTime}ms: ${lastError?.message}`
          );
          return;
        }

        // ── Step 2: Resize to 320×320 ──────────────────────────────────────
        // CameraView pictureSize is set to lowest in CameraDetectionScreen
        // so photo is already small. If still large, resize here.
        const resizeStart = Date.now();
        const resized = await ImageManipulator.manipulateAsync(
          photo.uri,
          [{ resize: { width: 320, height: 320 } }],
          { base64: true, format: ImageManipulator.SaveFormat.JPEG, compress: 0.6 }
        );
        const resizeTime = Date.now() - resizeStart;

        if (!resized.base64 || !resized.uri) {
          console.warn("[Loop] ❌ ImageManipulator returned no output");
          return;
        }

        // ── Step 3: YOLOv8 Inference ───────────────────────────────────────
        const inferenceStart = Date.now();
        const results = await detectionEngine.detectFromBase64(
          resized.base64,
          640,
          640
        );
        const inferenceTime = Date.now() - inferenceStart;

        if (results.length === 0) return;
        if (!isLoopActiveRef.current) return;

        const top = results[0];

        // ── Step 4: Feature Extraction ─────────────────────────────────────
        // OCR + dominant colour on the cropped bbox region — parallel execution
        const featureStart = Date.now();
        const features = await extractFeatures(
          resized.uri,
          640,
          640,
          top.bbox,
          top.confidence // ← add this
        );
        const featureTime = Date.now() - featureStart;

        // ── Step 5: matchAndScore ──────────────────────────────────────────
        // Feed class + OCR + colour + history into the matching layer
        const matchStart = Date.now();
        const input: DetectionInput = {
          id: `${Date.now()}`,
          class: top.label.toLowerCase(),
          confidence: top.confidence / 100, // matchAndScore expects 0–1
          ocr_text: features.ocrText ?? undefined,
          color: features.dominantColor ?? undefined,
        };

        const match = matchAndScore(input, historyRef.current);
        const matchTime = Date.now() - matchStart;

        const totalTime = Date.now() - frameStart;
        console.log(
          `[Loop] ✅ #${frameCountRef.current} [${top.label} → ${match.label}] | ` +
            `capture=${captureTime}ms  resize=${resizeTime}ms  infer=${inferenceTime}ms  ` +
            `features=${featureTime}ms  match=${matchTime}ms  TOTAL=${totalTime}ms`
        );

        // ── Step 6: Build BoundingBox[] + Detection ────────────────────────
        const boxes: BoundingBox[] = results.map((r) => ({
          x: r.bbox.x,
          y: r.bbox.y,
          width: r.bbox.width,
          height: r.bbox.height,
          label: r.label,
          confidence: r.confidence,
        }));

        const detection: Detection = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          label: match.label !== "unknown" ? match.label : top.label,
          confidence: Math.round(match.confidence * 100),
          status: match.status === "unknown" ? "ambiguous" : match.status,
          timestamp: new Date().toLocaleTimeString(),
          boundingBoxes: boxes,
          suggestions: match.suggestions,
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
      console.log(
        "[Loop] 🛑 Stopped. Frames processed:",
        frameCountRef.current
      );
      frameCountRef.current = 0;
    };
  }, [isModelReady, isActive, onDetectionResult, throttleMs]);

  return { isModelReady, modelError, modelLoadProgress };
}