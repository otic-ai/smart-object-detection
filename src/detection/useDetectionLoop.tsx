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
  throttleMs?: number;
  isActive: boolean;
  history?: string[];
}

interface UseDetectionLoopReturn {
  isModelReady: boolean;
  modelError: string | null;
  modelLoadProgress: string | null;
}

// Cached OCR+colour result from previous frame
interface FeatureCache {
  ocrText: string | null;
  dominantColor: string | null;
}

export function useDetectionLoop({
  onDetectionResult,
  cameraRef,
  isActive,
  throttleMs = 500,
  history = [],
}: UseDetectionLoopOptions): UseDetectionLoopReturn {
  const [isModelReady, setIsModelReady] = useState(() => detectionEngine.ready);
  const [modelError, setModelError]     = useState<string | null>(null);
  const [modelLoadProgress, setModelLoadProgress] = useState<string | null>(
    detectionEngine.ready ? null : "Initialising…"
  );

  const isRunningRef      = useRef(false);
  const frameCountRef     = useRef(0);
  const isLoopActiveRef   = useRef(false);
  const historyRef        = useRef<string[]>(history);
  // ✅ Stores OCR result from previous frame — used in current frame emit
  const featureCacheRef   = useRef<FeatureCache>({ ocrText: null, dominantColor: null });
  // ✅ Tracks the in-flight OCR promise so we never run two at once
  const ocrInFlightRef    = useRef<Promise<void> | null>(null);

  useEffect(() => { historyRef.current = history; }, [history]);

  // ── Model load ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (detectionEngine.ready) {
      setIsModelReady(true);
      setModelLoadProgress(null);
      return;
    }

    let cancelled = false;
    const t = Date.now();
    console.log("[Loop] 📦 Awaiting model load...");
    setModelLoadProgress("Loading TFLite model…");

    detectionEngine.loadModel()
      .then(() => {
        if (!cancelled) {
          console.log(`[Loop] ✅ Model ready in ${Date.now() - t}ms`);
          setModelLoadProgress(null);
          setIsModelReady(true);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setModelLoadProgress(null);
          setModelError(`Failed to load model: ${err}`);
        }
      });

    return () => { cancelled = true; };
  }, []);

  // ── Detection loop ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isModelReady || !isActive || !cameraRef.current) {
      isLoopActiveRef.current = false;
      return;
    }

    isLoopActiveRef.current = true;
    console.log("[Loop] 🎥 Starting, throttle:", throttleMs, "ms");
    let isMounted     = true;
    let skippedFrames = 0;

    const interval = setInterval(async () => {
      // ── FRAME SKIP ──────────────────────────────────────────────────────
      // YOLO still busy → discard this tick. Never queue stale frames.
      if (isRunningRef.current) {
        skippedFrames++;
        console.log(`[Loop] ⏭ Skipped (YOLO busy) total=${skippedFrames}`);
        return;
      }
      if (!isMounted || !isLoopActiveRef.current || !cameraRef.current) return;

      try {
        isRunningRef.current = true;
        frameCountRef.current++;
        const frameStart = Date.now();

        // ── Step 1: Capture ────────────────────────────────────────────────
        const captureStart = Date.now();
        let photo: any = null;
        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            const timeout = new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error(`timeout ${attempt}`)), 5000)
            );
            photo = await Promise.race([
              cameraRef.current!.takePictureAsync({
                quality: 0.1,
                skipProcessing: true,
                exif: false,
              }),
              timeout,
            ]);
            if (photo?.uri) break;
          } catch {
            if (attempt < 3) await new Promise(r => setTimeout(r, 50 * attempt));
          }
        }
        const captureTime = Date.now() - captureStart;
        if (!photo?.uri) return;

        // ── Step 2: Resize to 320×320 ─────────────────────────────────────
        const resizeStart = Date.now();
        const resized = await ImageManipulator.manipulateAsync(
          photo.uri,
          [{ resize: { width: 320, height: 320 } }],
          { base64: true, format: ImageManipulator.SaveFormat.JPEG, compress: 0.6 }
        );
        const resizeTime = Date.now() - resizeStart;
        if (!resized.base64 || !resized.uri) return;

        // ── Step 3: YOLO Inference ─────────────────────────────────────────
        // Runs alone — no waiting for OCR.
        // OCR from PREVIOUS frame is already in featureCacheRef.
        const inferStart = Date.now();
        const results = await detectionEngine.detectFromBase64(resized.base64, 320, 320);
        const inferTime = Date.now() - inferStart;

        if (results.length === 0) return;
        if (!isLoopActiveRef.current) return;

        const top = results[0];

        // ── Step 4: Emit immediately using PREVIOUS frame's OCR cache ──────
        //
        // KEY IDEA (senior's suggestion implemented properly):
        //
        //   Frame N:   YOLO ──► emit with cache[N-1] OCR
        //                    └─► fire OCR in background (no await)
        //   Frame N+1: YOLO ──► emit with cache[N] OCR  ← 1 frame late, unnoticeable
        //
        // Result: YOLO never waits for OCR. Total = YOLO time only (~700ms).
        // OCR updates cache in background, enriches next frame's result.
        //
        const cachedFeatures = featureCacheRef.current;

        // ── Step 5: matchAndScore with cached features ─────────────────────
        const input: DetectionInput = {
          id:         `${Date.now()}`,
          class:      top.label.toLowerCase(),
          confidence: top.confidence / 100,
          ocr_text:   cachedFeatures.ocrText    ?? undefined,
          color:      cachedFeatures.dominantColor ?? undefined,
        };
        const match = matchAndScore(input, historyRef.current);

        const totalTime = Date.now() - frameStart;
        console.log(
          `[Loop] ✅ #${frameCountRef.current} [${top.label} → ${match.label}] | ` +
          `cap=${captureTime}ms  resize=${resizeTime}ms  infer=${inferTime}ms  ` +
          `TOTAL=${totalTime}ms  skipped=${skippedFrames}` +
          `  ocr="${cachedFeatures.ocrText ?? "none"}"  color="${cachedFeatures.dominantColor ?? "none"}"`
        );

        // ── Step 6: Emit Detection ─────────────────────────────────────────
        const boxes: BoundingBox[] = results.map(r => ({
          x: r.bbox.x, y: r.bbox.y,
          width: r.bbox.width, height: r.bbox.height,
          label: r.label, confidence: r.confidence,
        }));

        const detection: Detection = {
          id:            `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          label:         match.label !== "unknown" ? match.label : top.label,
          confidence:    Math.round(match.confidence * 100),
          status:        match.status === "unknown" ? "ambiguous" : match.status,
          timestamp:     new Date().toLocaleTimeString(),
          boundingBoxes: boxes,
          suggestions:   match.suggestions,
          ocrText:       cachedFeatures.ocrText       ?? undefined,
          dominantColor: cachedFeatures.dominantColor ?? undefined,
        };

        onDetectionResult(detection, boxes);

        // ── Step 7: Fire OCR in background for NEXT frame ─────────────────
        // No await — YOLO loop is already free. OCR updates cache when done.
        // If previous OCR still running, skip to avoid stacking background tasks.
        if (!ocrInFlightRef.current) {
          ocrInFlightRef.current = extractFeatures(
            resized.uri,
            320,
            320,
            top.bbox,
            top.confidence
          ).then((features) => {
            featureCacheRef.current = {
              ocrText:      features.ocrText,
              dominantColor: features.dominantColor,
            };
            console.log(
              `[Loop] 🔬 OCR cache updated: ocr="${features.ocrText ?? "none"}"  color="${features.dominantColor ?? "none"}"`
            );
          }).catch(() => {
            // OCR failure is non-fatal — cache stays as-is
          }).finally(() => {
            ocrInFlightRef.current = null; // allow next OCR run
          });
        }

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
      featureCacheRef.current  = { ocrText: null, dominantColor: null };
      ocrInFlightRef.current   = null;
      console.log(`[Loop] 🛑 Stopped. Frames=${frameCountRef.current} Skipped=${skippedFrames}`);
      frameCountRef.current = 0;
    };
  }, [isModelReady, isActive, onDetectionResult, throttleMs]);

  return { isModelReady, modelError, modelLoadProgress };
}