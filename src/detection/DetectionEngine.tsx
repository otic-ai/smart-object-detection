import { loadTensorflowModel, TensorflowModel } from "react-native-fast-tflite";
import { COCO_LABELS } from "./labels";
// jpeg-js: pure JS JPEG decoder. Pass useTArray:true to avoid Buffer (not in Hermes).
import * as jpegJs from "jpeg-js";
// base64-arraybuffer: pure JS base64 → ArrayBuffer, no Buffer/TextDecoder needed.
import { decode as decodeBase64 } from "base64-arraybuffer";

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

  async loadModel(): Promise<void> {
    if (this.isLoaded) return;
    try {
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
      // useTArray:true → output is Uint8Array instead of Buffer (Hermes safe)
      // formatAsRGBA:true (default) → 4 bytes per pixel: R, G, B, A
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
      console.log(`[DetectionEngine] Base64→Detect timing: Base64Decode=${decodeTime}ms, JPEGDecode=${jpegTime}ms, Detect=${detectTime}ms, Total=${totalTime}ms`);

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
    console.log(`[DetectionEngine] Detect timing: Preprocess=${prepTime}ms, Inference=${inferenceTime}ms, Parse=${parseTime}ms, Total=${totalTime}ms`);

    return results;
  }

  dispose(): void {
    this.model = null;
    this.isLoaded = false;
    console.log("[DetectionEngine] Model disposed");
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

    for (let y = 0; y < OUT; y++) {
      for (let x = 0; x < OUT; x++) {
        const srcX = Math.min(Math.floor(x * scaleX), srcW - 1);
        const srcY = Math.min(Math.floor(y * scaleY), srcH - 1);
        const srcIdx = (srcY * srcW + srcX) * 4;
        const dstIdx = (y * OUT + x) * 3;
        input[dstIdx]     = rgba[srcIdx]     / 255;
        input[dstIdx + 1] = rgba[srcIdx + 1] / 255;
        input[dstIdx + 2] = rgba[srcIdx + 2] / 255;
      }
    }
    return input;
  }

  private _parseOutput(data: Float32Array): DetectionEngineResult[] {
    const NUM_ANCHORS = 8400;
    const NUM_CLASSES = 80;
    const raw: DetectionEngineResult[] = [];

    for (let i = 0; i < NUM_ANCHORS; i++) {
      const cx = data[0 * NUM_ANCHORS + i];
      const cy = data[1 * NUM_ANCHORS + i];
      const w  = data[2 * NUM_ANCHORS + i];
      const h  = data[3 * NUM_ANCHORS + i];

      let maxScore = 0;
      let classIdx = 0;
      for (let c = 0; c < NUM_CLASSES; c++) {
        const score = data[(4 + c) * NUM_ANCHORS + i];
        if (score > maxScore) { maxScore = score; classIdx = c; }
      }

      if (maxScore < CONFIDENCE_THRESHOLD) continue;

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
}

export const detectionEngine = new DetectionEngine();