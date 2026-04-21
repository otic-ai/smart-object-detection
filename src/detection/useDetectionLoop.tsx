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
   * 300ms = ~3fps which feels live without hammering the CPU.
   * Increase if the device gets hot, decrease for snappier response.
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
  throttleMs = 300,
}: UseDetectionLoopOptions): UseDetectionLoopReturn {
  const [isModelReady, setIsModelReady] = useState(false);
  const [modelError, setModelError] = useState<string | null>(null);
  const isRunningRef = useRef(false);

  // Load TFLite model once on mount
  useEffect(() => {
    let cancelled = false;
    detectionEngine
      .loadModel()
      .then(() => { if (!cancelled) setIsModelReady(true); })
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
    if (!isModelReady || !isActive) return;

    const interval = setInterval(async () => {
      // Skip this tick if previous inference is still running
      if (isRunningRef.current) return;
      if (!cameraRef.current) return;

      try {
        isRunningRef.current = true;

        // 1. Capture frame from camera (no skipProcessing — needed for correct orientation)
        const photo = await cameraRef.current.takePictureAsync({ quality: 0.4 });

        if (!photo?.uri) {
          console.warn("[Loop] ❌ takePictureAsync returned no URI");
          return;
        }

        // 2. Resize to 640×640 and get JPEG base64
        //    JPEG (not PNG) because jpeg-js decodes to raw RGBA in Hermes without
        //    needing TextDecoder('latin1') which Hermes does not support.
        const resized = await ImageManipulator.manipulateAsync(
          photo.uri,
          [{ resize: { width: 640, height: 640 } }],
          { base64: true, format: ImageManipulator.SaveFormat.JPEG }
        );

        if (!resized.base64) {
          console.warn("[Loop] ❌ ImageManipulator returned no base64");
          return;
        }

        // 3. Decode PNG → RGBA pixels → run YOLOv8 inference
        const results = await detectionEngine.detectFromBase64(resized.base64, 640, 640);

        if (results.length === 0) {
          // Normal — model ran fine but nothing was above the 50% threshold
          return;
        }

        console.log(`[Loop] ✅ ${results.length} detection(s): ${results.map(r => r.label).join(", ")}`);

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

    return () => clearInterval(interval);
  }, [isModelReady, isActive, cameraRef, onDetectionResult, throttleMs]);

  return { isModelReady, modelError };
}