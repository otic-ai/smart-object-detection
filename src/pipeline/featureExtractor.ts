import { cropRegion } from "./cropRegion";
import { extractOcrText } from "./ocrExtractor";
import { extractDominantColour } from "./colourExtractor";

export interface FeatureExtractionResult {
  /** Cleaned lowercase OCR text from the object region, or null */
  ocrText: string | null;
  /** Named colour matching colorScore.ts groups, or null */
  dominantColor: string | null;
  /** bbox width / height — useful as a tiebreaker in matching */
  aspectRatio: number;
}

/**
 * Extracts OCR text, dominant colour, and aspect ratio from a detected object.
 *
 * Pipeline:
 *   1. Crop bbox region from the resized frame URI (native — fast)
 *   2. Run OCR + colour in parallel on the cropped region
 *   3. Return enriched signals for matchAndScore()
 *
 * All failures are non-fatal — returns null fields so detection continues.
 *
 * @param frameUri    Native URI of the 640×640 resized frame
 * @param frameW      Frame width in pixels (640)
 * @param frameH      Frame height in pixels (640)
 * @param bbox        Detection bounding box in 0–100 percentage coords
 */
// featureExtractor.ts
export async function extractFeatures(
  frameUri: string,
  frameW: number,
  frameH: number,
  bbox: { x: number; y: number; width: number; height: number },
  confidence?: number   // ← add param
): Promise<FeatureExtractionResult> {
  const aspectRatio = bbox.height > 0 ? bbox.width / bbox.height : 1;

  const croppedUri = await cropRegion(frameUri, frameW, frameH, bbox);
  if (!croppedUri) return { ocrText: null, dominantColor: null, aspectRatio };

  // Skip OCR entirely if confidence too low — not worth 1300ms
  const skipOcr = (confidence ?? 0) < 70;

  const [ocrText, dominantColor] = await Promise.all([
    skipOcr ? Promise.resolve(null) : extractOcrText(croppedUri),
    extractDominantColour(croppedUri),
  ]);

  return { ocrText, dominantColor, aspectRatio };
}