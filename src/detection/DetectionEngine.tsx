import { loadTensorflowModel, TensorflowModel } from "react-native-fast-tflite";
import { COCO_LABELS } from "./labels";

// ─── Types ────────────────────────────────────────────────────────────────────

/** Raw output from the engine — maps directly onto the existing BoundingBox type. */
export interface DetectionEngineResult {
  /** COCO class label e.g. "bottle", "person" */
  label: string;
  /** Confidence 0–100 (matches BoundingBox.confidence in detection.ts) */
  confidence: number;
  /** Bounding box, all values 0–100 (percentage of frame dimensions) */
  bbox: {
    x: number; // left edge %
    y: number; // top edge %
    width: number; // width %
    height: number; // height %
  };
}

// ─── Constants ────────────────────────────────────────────────────────────────

/** Ignore any detection below this score. 0.5 = 50% confidence minimum. */
const CONFIDENCE_THRESHOLD = 0.5;

/**
 * NMS IoU threshold.
 * Two boxes for the same object that overlap by more than 45% → keep only the
 * higher-confidence one.
 */
const NMS_IOU_THRESHOLD = 0.45;

/** YOLOv8n always receives 640×640 input. */
const INPUT_SIZE = 640;

// ─── DetectionEngine class ────────────────────────────────────────────────────

class DetectionEngine {
  private model: TensorflowModel | null = null;
  private isLoaded = false;

  /**
   * loadModel()
   *
   * Call once, on app start (inside a useEffect with [] deps).
   * Flutter equivalent: calling an async method inside initState().
   *
   * The model file is bundled with the app — no network request needed,
   * which is what makes this offline-first.
   */
  async loadModel(): Promise<void> {
    if (this.isLoaded) return;

    try {
      // require() resolves to the bundled asset URI at build time.
      // react-native-fast-tflite accepts require() or a URI string.
      this.model = await loadTensorflowModel(
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        require("../../assets/models/yolov8n_float32.tflite")
      );
      this.isLoaded = true;
      console.log("[DetectionEngine] ✅ Model loaded");
    } catch (err) {
      console.error("[DetectionEngine] ❌ Failed to load model:", err);
      throw err;
    }
  }

  /**
   * detect()
   *
   * Main inference entry point. Called from useDetectionLoop on each
   * throttled frame.
   *
   * @param pixelData  Uint8Array of raw RGBA pixels from the camera frame.
   *                   react-native-vision-camera or expo-camera both expose this.
   * @param frameWidth  Actual pixel width of the camera frame.
   * @param frameHeight Actual pixel height of the camera frame.
   * @returns Array of detected objects, empty if nothing found or model not ready.
   */
  async detect(
    pixelData: Uint8Array,
    frameWidth: number,
    frameHeight: number
  ): Promise<DetectionEngineResult[]> {
    if (!this.isLoaded || !this.model) return [];

    // ── Step 1: Preprocess ────────────────────────────────────────────────
    // YOLOv8 expects a Float32Array of shape [1, 640, 640, 3] normalised to [0,1].
    // Flutter equivalent: resizing a dart:ui Image and reading its byte data.
    const inputTensor = this._preprocessFrame(
      pixelData,
      frameWidth,
      frameHeight
    );

    // ── Step 2: Run inference ─────────────────────────────────────────────
    // model.run() is synchronous on the native side — it blocks the JS call
    // but react-native-fast-tflite offloads to a native thread so the UI
    // stays responsive.
    const outputs = await this.model.run([inputTensor]);

    // ── Step 3: Parse output tensor ───────────────────────────────────────
    // YOLOv8 output shape: [1, 84, 8400]
    // outputs[0] is a Float32Array of 1 × 84 × 8400 = 705,600 values.
    const rawOutput = outputs[0] as Float32Array;
    const detections = this._parseOutput(rawOutput);

    return detections;
  }

  /**
   * dispose()
   * Release native model memory. Call this in a useEffect cleanup function.
   * Flutter equivalent: controller.dispose() in State.dispose().
   */
  dispose(): void {
    this.model = null;
    this.isLoaded = false;
    console.log("[DetectionEngine] Model disposed");
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  /**
   * _preprocessFrame()
   *
   * Converts raw RGBA Uint8Array → Float32Array [1, 640, 640, 3] normalised [0,1].
   *
   * The camera gives us RGBA (4 bytes per pixel). YOLOv8 wants RGB (3 bytes),
   * scaled to 0–1 floats, resized to 640×640.
   *
   * Full bilinear resize is expensive in JS — here we use nearest-neighbour
   * which is fast enough for 640×640. For better accuracy you can swap in a
   * bilinear resizer, but it adds ~5ms per frame on mobile.
   */
  private _preprocessFrame(
    rgba: Uint8Array,
    srcW: number,
    srcH: number
  ): Float32Array {
    const OUT = INPUT_SIZE;
    const input = new Float32Array(OUT * OUT * 3); // [640, 640, 3] flattened

    const scaleX = srcW / OUT;
    const scaleY = srcH / OUT;

    for (let y = 0; y < OUT; y++) {
      for (let x = 0; x < OUT; x++) {
        // Source pixel — nearest neighbour mapping
        const srcX = Math.min(Math.floor(x * scaleX), srcW - 1);
        const srcY = Math.min(Math.floor(y * scaleY), srcH - 1);
        const srcIdx = (srcY * srcW + srcX) * 4; // ×4 because RGBA

        const dstIdx = (y * OUT + x) * 3; // ×3 because RGB
        input[dstIdx] = rgba[srcIdx] / 255; // R
        input[dstIdx + 1] = rgba[srcIdx + 1] / 255; // G
        input[dstIdx + 2] = rgba[srcIdx + 2] / 255; // B
        // Alpha channel is dropped — YOLOv8 doesn't use it
      }
    }

    return input;
  }

  /**
   * _parseOutput()
   *
   * YOLOv8 output tensor shape: [1, 84, 8400]
   *   - 84 values per anchor: [cx, cy, w, h, class_0_score, ..., class_79_score]
   *   - 8400 anchors total
   *
   * We flatten this to an array of DetectionEngineResult, filter by confidence,
   * then apply NMS to remove duplicate boxes.
   */
  private _parseOutput(data: Float32Array): DetectionEngineResult[] {
    const NUM_ANCHORS = 8400;
    const NUM_VALUES = 84; // 4 bbox + 80 classes
    const NUM_CLASSES = 80;

    const raw: DetectionEngineResult[] = [];

    for (let i = 0; i < NUM_ANCHORS; i++) {
      // YOLOv8 stores data column-major: all cx values first, then all cy, etc.
      // So anchor i's values are at: data[0 * 8400 + i], data[1 * 8400 + i], ...
      const cx = data[0 * NUM_ANCHORS + i]; // centre x (normalised 0–1)
      const cy = data[1 * NUM_ANCHORS + i]; // centre y (normalised 0–1)
      const w = data[2 * NUM_ANCHORS + i]; // width (normalised 0–1)
      const h = data[3 * NUM_ANCHORS + i]; // height (normalised 0–1)

      // Find highest class score across all 80 COCO classes
      let maxScore = 0;
      let classIdx = 0;
      for (let c = 0; c < NUM_CLASSES; c++) {
        const score = data[(4 + c) * NUM_ANCHORS + i];
        if (score > maxScore) {
          maxScore = score;
          classIdx = c;
        }
      }

      if (maxScore < CONFIDENCE_THRESHOLD) continue;

      // Convert centre-format (cx,cy,w,h) → top-left format (x,y,w,h)
      // and scale from 0–1 to 0–100 percentage for the BoundingBox type.
      raw.push({
        label: COCO_LABELS[classIdx] ?? "unknown",
        confidence: Math.round(maxScore * 100),
        bbox: {
          x: Math.max(0, cx - w / 2) * 100,
          y: Math.max(0, cy - h / 2) * 100,
          width: Math.min(100, w * 100),
          height: Math.min(100, h * 100),
        },
      });
    }

    return this._applyNMS(raw);
  }

  /**
   * _applyNMS() — Non-Maximum Suppression.
   *
   * When YOLOv8 detects a bottle, it often fires 5–20 overlapping boxes for
   * the same bottle with slightly different positions. NMS keeps only the
   * highest-confidence one and discards the rest.
   *
   * Algorithm:
   *   1. Sort by confidence (highest first)
   *   2. For each box, if it overlaps > NMS_IOU_THRESHOLD with an already-kept
   *      box → discard it (it's a duplicate)
   */
  private _applyNMS(
    detections: DetectionEngineResult[]
  ): DetectionEngineResult[] {
    // Sort descending by confidence
    detections.sort((a, b) => b.confidence - a.confidence);

    const kept: DetectionEngineResult[] = [];

    for (const det of detections) {
      let isDuplicate = false;
      for (const keptDet of kept) {
        if (this._iou(det.bbox, keptDet.bbox) > NMS_IOU_THRESHOLD) {
          isDuplicate = true;
          break;
        }
      }
      if (!isDuplicate) kept.push(det);
    }

    return kept;
  }

  /**
   * _iou() — Intersection over Union.
   *
   * Measures how much two bounding boxes overlap.
   *   0.0 = no overlap at all
   *   1.0 = identical boxes
   *
   * All values are in percentage space (0–100), same as BoundingBox.
   */
  private _iou(
    a: DetectionEngineResult["bbox"],
    b: DetectionEngineResult["bbox"]
  ): number {
    const xA = Math.max(a.x, b.x);
    const yA = Math.max(a.y, b.y);
    const xB = Math.min(a.x + a.width, b.x + b.width);
    const yB = Math.min(a.y + a.height, b.y + b.height);

    const intersection = Math.max(0, xB - xA) * Math.max(0, yB - yA);
    if (intersection === 0) return 0;

    const areaA = a.width * a.height;
    const areaB = b.width * b.height;
    return intersection / (areaA + areaB - intersection);
  }

  // Add this method to the DetectionEngine class
  // It accepts base64 instead of raw Uint8Array — matches takePictureAsync output
  async detectFromBase64(
  base64: string,
  frameWidth: number,
  frameHeight: number
): Promise<DetectionEngineResult[]> {
  if (!this.isLoaded || !this.model) return [];

  const binaryStr = atob(base64);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }

  return this.detect(bytes, frameWidth, frameHeight);
}
}

// Export a singleton — one model instance for the whole app.
// Flutter analogy: a class registered in a service locator (get_it).
export const detectionEngine = new DetectionEngine();
