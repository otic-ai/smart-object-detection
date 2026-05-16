import { loadTensorflowModel, TensorflowModel } from "react-native-fast-tflite";
import { COCO_LABELS } from "./labels";
import * as jpegJs from "jpeg-js";
import { decode as decodeBase64 } from "base64-arraybuffer";
import { Asset } from "expo-asset";

import * as ImageManipulator from "expo-image-manipulator";
import * as FileSystem from "expo-file-system/legacy";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DetectionEngineResult {
  label: string;
  confidence: number;
  bbox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CONFIDENCE_THRESHOLD = 0.5;
const NMS_IOU_THRESHOLD = 0.45;
const INPUT_SIZE = 640;

// ─── DetectionEngine ──────────────────────────────────────────────────────────

class DetectionEngine {
  private model: TensorflowModel | null = null;
  private isLoaded = false;

  /**
   * _loadPromise caches the in-flight load so that:
   *  - Multiple callers awaiting loadModel() share the same Promise (no duplicate loads)
   *  - App.tsx can fire loadModel() eagerly on startup; useDetectionLoop just awaits the same promise
   *  - On failure the promise is cleared so a retry is possible
   */
  private _loadPromise: Promise<void> | null = null;

  // async loadModel(): Promise<void> {
  //   // Already loaded — resolve immediately
  //   if (this.isLoaded) return;

  //   // Already loading — return the same in-flight promise (no duplicate loads)
  //   if (this._loadPromise) return this._loadPromise;

  //   this._loadPromise = (async () => {
  //     try {
  //       console.log("[DetectionEngine] 📦 Starting model load...");
  //       const loadStart = Date.now();

  //       // Try GPU delegate first — ~3x faster inference on Android (float32 compatible).
  //       // Falls back to CPU if GPU is unavailable on the device.
  //       // Correct API: loadTensorflowModel(source, delegates[]) — second arg is TensorflowModelDelegate[]
  //       // Android delegate = 'android-gpu', iOS = 'metal' or 'core-ml'
  //       const isIOS = require("react-native").Platform.OS === "ios";
  //       const gpuDelegate: import("react-native-fast-tflite").TensorflowModelDelegate =
  //         isIOS ? "metal" : "android-gpu";

  //       let usedDelegate = gpuDelegate;
  //       try {
  //           this.model = await loadTensorflowModel(require("../../assets/models/yolov8n_float32.tflite"), gpuDelegate);
  //         console.log(`[DetectionEngine] ✅ GPU delegate active (${gpuDelegate})`);
  //       } catch (gpuErr) {
  //         console.warn(`[DetectionEngine] ⚠️ ${gpuDelegate} failed, falling back to CPU:`, gpuErr);
  //         let usedDelegate: string = gpuDelegate;  // widen to string for logging
  //         usedDelegate = "cpu"; // will log as cpu
  //         this.model = await loadTensorflowModel(
  //           require("../../assets/models/yolov8n_float32.tflite"),
  //           undefined  // CPU path
  //         );
  //       }

  //       this.isLoaded = true;
  //       const loadMs = Date.now() - loadStart;
  //       console.log(`[DetectionEngine] ✅ Model loaded in ${loadMs}ms (delegate=${usedDelegate})`);
  //     } catch (err) {
  //       // Clear promise so caller can retry
  //       this._loadPromise = null;
  //       console.error("[DetectionEngine] ❌ Failed to load model:", err);
  //       throw err;
  //     }
  //   })();

  //   return this._loadPromise;
  // }

  async loadModel(): Promise<void> {
  if (this.isLoaded) return;
  if (this._loadPromise) return this._loadPromise;

  this._loadPromise = (async () => {
    // Download model to local filesystem first
    const [asset] = await Asset.loadAsync(
      require("../../assets/models/yolov8n_float32.tflite")
    );
    const localUri = asset.localUri ?? asset.uri;
    console.log("[DetectionEngine] 📍 Model local path:", localUri);

    const { Platform } = require("react-native");
    const isIOS = Platform.OS === "ios";

    // Delegate priority:
    //   iOS:     metal > core-ml > cpu
    //   Android: nnapi > cpu
    //            (android-gpu fails on most devices with float32 models)
    const delegates: string[] = isIOS ? ["metal", "core-ml"] : ["nnapi"];
    let usedDelegate = "cpu";

    for (const delegate of delegates) {
      try {
        this.model = await loadTensorflowModel(
          { url: localUri } as any,
          delegate as any
        );
        usedDelegate = delegate;
        console.log(`[DetectionEngine] ✅ Delegate active: ${delegate}`);
        break; // success — stop trying
      } catch {
        console.warn(`[DetectionEngine] ⚠️ ${delegate} failed, trying next...`);
      }
    }

    // All delegates failed — fall back to CPU
    if (!this.model) {
      console.log("[DetectionEngine] 📌 Using CPU (no hardware delegate available)");
      this.model = await loadTensorflowModel(
        { url: localUri } as any,
        undefined
      );
    }

    this.isLoaded = true;
    console.log(`[DetectionEngine] ✅ Model loaded (delegate=${usedDelegate})`);
  })();

  return this._loadPromise;
}

  get ready(): boolean {
    return this.isLoaded;
  }

  /**
   * detectFromBase64()
   *
   * Full pipeline: JPEG base64 → raw RGBA pixels → YOLOv8 inference.
   *
   * Stack chosen for Hermes compatibility:
   *   • base64-arraybuffer  — decodes base64 without Buffer or TextDecoder
   *   • jpeg-js (useTArray) — decodes JPEG to Uint8Array without Buffer
   *   • JPEG not PNG        — avoids fast-png which uses TextDecoder('latin1'),
   *                           an encoding Hermes does not support
   */
  async detectFromBase64(
    base64: string,
    frameWidth: number,
    frameHeight: number
  ): Promise<DetectionEngineResult[]> {
    if (!this.isLoaded || !this.model) return [];

    try {
      const startTime = Date.now();

      // Step 1: base64 string → ArrayBuffer (pure JS, no Buffer)
      const decodeStart = Date.now();
      const arrayBuffer = decodeBase64(base64);
      const decodeTime = Date.now() - decodeStart;

      // Step 2: ArrayBuffer → raw RGBA Uint8Array via jpeg-js
      const jpegStart = Date.now();
      const decoded = jpegJs.decode(new Uint8Array(arrayBuffer), {
        useTArray: true,
        formatAsRGBA: true,
      });
      const jpegTime = Date.now() - jpegStart;

      // Step 3: raw RGBA → Float32 tensor → inference
      const detectStart = Date.now();
      const results = await this.detect(decoded.data, decoded.width, decoded.height);
      const detectTime = Date.now() - detectStart;

      const totalTime = Date.now() - startTime;
      console.log(
        `[DetectionEngine] 🖼️  Frame | b64=${decodeTime}ms  jpeg=${jpegTime}ms  infer=${detectTime}ms  TOTAL=${totalTime}ms`
      );

      return results;
    } catch (err) {
      console.error("[DetectionEngine] detectFromBase64 failed:", err);
      return [];
    }
  }

  async detect(
    pixelData: Uint8Array,
    frameWidth: number,
    frameHeight: number
  ): Promise<DetectionEngineResult[]> {
    if (!this.isLoaded || !this.model) return [];

    const startTime = Date.now();

    const prepStart = Date.now();
    const inputTensor = this._preprocessFrame(pixelData, frameWidth, frameHeight);
    const prepTime = Date.now() - prepStart;

    const inferenceStart = Date.now();
    const outputs = await this.model.run([inputTensor]);
    const inferenceTime = Date.now() - inferenceStart;

    const parseStart = Date.now();
    const rawOutput = outputs[0] as Float32Array;
    const results = this._parseOutput(rawOutput);
    const parseTime = Date.now() - parseStart;

    const totalTime = Date.now() - startTime;
    console.log(
      `[DetectionEngine] 🧠 Inference | preprocess=${prepTime}ms  run=${inferenceTime}ms  parse=${parseTime}ms  TOTAL=${totalTime}ms`
    );

    return results;
  }

  dispose(): void {
    this.model = null;
    this.isLoaded = false;
    this._loadPromise = null;
    console.log("[DetectionEngine] Disposed — will reload on next loadModel() call");
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private _preprocessFrame(
    rgba: Uint8Array,
    srcW: number,
    srcH: number
  ): Float32Array {
    const OUT = INPUT_SIZE;
    const input = new Float32Array(OUT * OUT * 3);
    const scaleX = srcW / OUT;
    const scaleY = srcH / OUT;
    const inv255 = 1 / 255;

    for (let y = 0; y < OUT; y++) {
      const srcY = Math.min((y * scaleY) | 0, srcH - 1);
      const srcYOffset = srcY * srcW;
      const dstYOffset = y * OUT;

      for (let x = 0; x < OUT; x++) {
        const srcX = Math.min((x * scaleX) | 0, srcW - 1);
        const srcIdx = (srcYOffset + srcX) << 2; // *4 via bitshift
        const dstIdx = (dstYOffset + x) * 3;

        input[dstIdx]     = rgba[srcIdx]     * inv255;
        input[dstIdx + 1] = rgba[srcIdx + 1] * inv255;
        input[dstIdx + 2] = rgba[srcIdx + 2] * inv255;
      }
    }
    return input;
  }

  private _parseOutput(data: Float32Array): DetectionEngineResult[] {
    const NUM_ANCHORS = 8400;
    const NUM_CLASSES = 80;
    const raw: DetectionEngineResult[] = [];

    for (let i = 0; i < NUM_ANCHORS; i++) {
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

      const cx = data[0 * NUM_ANCHORS + i];
      const cy = data[1 * NUM_ANCHORS + i];
      const w  = data[2 * NUM_ANCHORS + i];
      const h  = data[3 * NUM_ANCHORS + i];

      raw.push({
        label: COCO_LABELS[classIdx] ?? "unknown",
        confidence: Math.round(maxScore * 100),
        bbox: {
          x:      Math.max(0, cx - w / 2) * 100,
          y:      Math.max(0, cy - h / 2) * 100,
          width:  Math.min(100, w * 100),
          height: Math.min(100, h * 100),
        },
      });
    }

    return this._applyNMS(raw);
  }

  private _applyNMS(detections: DetectionEngineResult[]): DetectionEngineResult[] {
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

  private _iou(
    a: DetectionEngineResult["bbox"],
    b: DetectionEngineResult["bbox"]
  ): number {
    const xA = Math.max(a.x, b.x);
    const yA = Math.max(a.y, b.y);
    const xB = Math.min(a.x + a.width,  b.x + b.width);
    const yB = Math.min(a.y + a.height, b.y + b.height);
    const intersection = Math.max(0, xB - xA) * Math.max(0, yB - yA);
    if (intersection === 0) return 0;
    return intersection / (a.width * a.height + b.width * b.height - intersection);
  }

  async detectFromUri(uri: string): Promise<DetectionEngineResult[]> {
  if (!this.isLoaded || !this.model) return [];
  try {
    // Get base64 only for the 640×640 already-resized frame — unavoidable
    // BUT: use FileSystem directly instead of going through JPEG decode
    // Alternative: resize to exact input and read pixels via a canvas approach
    // For now: still need base64 but skip the double-decode
    const b64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return this.detectFromBase64(b64, 640, 640);
  } catch { return []; }
}
}

export const detectionEngine = new DetectionEngine();

/**
 * Call this once at app startup (e.g. App.tsx / _layout.tsx) so the model
 * is warm by the time the user reaches the camera tab.
 *
 * Safe to call multiple times — returns the same cached Promise.
 */
export function preloadModel(): void {
  detectionEngine.loadModel().catch((err) =>
    console.warn("[DetectionEngine] Background preload failed:", err)
  );
}