// useDetectionLoop.tsx — replace the whole hook with this

import { useCallback, useEffect, useRef, useState } from "react";
import { Detection, BoundingBox } from "../types/detection";
import { detectionEngine, DetectionEngineResult } from "./DetectionEngine";
import * as ImageManipulator from "expo-image-manipulator";
import { CameraView } from "expo-camera";

interface UseDetectionLoopOptions {
  onDetectionResult: (detection: Detection, boxes: BoundingBox[]) => void;
  cameraRef: React.RefObject<CameraView | null>;
  throttleMs?: number;
  isActive: boolean;  // ← add
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

  // Load model once on mount
  useEffect(() => {
    let cancelled = false;
    detectionEngine
      .loadModel()
      .then(() => {
        if (!cancelled) setIsModelReady(true);
      })
      .catch((err) => {
        console.error("[Loop] model load failed:", err);
        if (!cancelled) setModelError("Failed to load YOLOv8 model");
      });
    return () => {
      cancelled = true;
      detectionEngine.dispose();
    };
  }, []);

  // Poll camera snapshots every throttleMs
  useEffect(() => {
    if (!isModelReady || !isActive) return;

    const interval = setInterval(async () => {
      if (isRunningRef.current) return;
      if (!cameraRef.current) return;

      try {
        isRunningRef.current = true;

        // takePictureAsync gives us a URI — base64 for pixel access
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.3,
          skipProcessing: true,
        });

        if (!photo?.uri) {
          console.warn("[Loop] photo URI missing");
          return;
        }
        // Resize to 640×640 and get PNG base64 — PNG gives raw-like pixels
        // JPEG base64 won't work because _preprocessFrame expects raw pixel bytes
        const resized = await ImageManipulator.manipulateAsync(
          photo.uri,
          [{ resize: { width: 640, height: 640 } }],
          { base64: true, format: ImageManipulator.SaveFormat.PNG }
        );

        if (!resized.base64) {
          console.warn("[Loop] resized base64 missing");
          return;
        }

        const results = await detectionEngine.detectFromBase64(
          resized.base64,
          640,
          640
        );

        console.log("results" + results);

        if (results.length === 0) {
          console.log("[Loop] no detections this frame");
          return;
        }

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
        console.warn("[useDetectionLoop] frame error:", e);
      } finally {
        isRunningRef.current = false;
      }
    }, throttleMs);

    return () => clearInterval(interval);
  }, [isModelReady, cameraRef, onDetectionResult, throttleMs , isActive]);

  return { isModelReady, modelError };
}
