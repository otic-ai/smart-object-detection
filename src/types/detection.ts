/**
 * Core detection data types for SYNTHETIC_EYE.
 *
 * 🔌 AI INTEGRATION POINT:
 *   These types are consumed by the YOLOv8 + matching pipeline.
 *   Populate them from the on-device model output.
 */

export type DetectionStatus = 'verified' | 'corrected' | 'ambiguous' | 'unknown';

export interface BoundingBox {
  /** Left edge as a percentage of the container width (0–100) */
  x: number;
  /** Top edge as a percentage of the container height (0–100) */
  y: number;
  /** Width as a percentage of the container width (0–100) */
  width: number;
  /** Height as a percentage of the container height (0–100) */
  height: number;
  /** Display label inside the bounding box */
  label: string;
  /** Confidence score 0–100 */
  confidence: number;
}

export interface Detection {
  id: string;
  label: string;
  confidence: number;    // 0–100
  status: DetectionStatus;
  timestamp: string;
  /** 🔌 Base64 or URI of the detection thumbnail */
  thumbnail?: string;
  boundingBoxes?: BoundingBox[];
  /** Populated when status === 'ambiguous' — alternative labels from matchAndScore */
  suggestions?: string[];
}

export interface SuggestionMatch {
  id: string;
  name: string;
  description: string;
  iconName: string;       // MaterialCommunityIcons name
  confidence: number;     // 0–100
}

/**
 * Layer-2 output consumed by normalization.
 * This shape can be built from detector + feature extraction outputs.
 */
export interface NormalizationInput {
  className: string;
  confidence: number; // 0-100
  ocrText?: string;
  dominantColor?: string;
  timestamp?: string;
}

/** Candidate object identity considered by normalization/matching. */
export interface NormalizationCandidate {
  label: string;
  normalizedName: string;
  colorHint?: string;
  aliases: string[];
}

/** Weighted scoring parts for Layer 4. */
export interface ScoreBreakdown {
  ocrSimilarity: number; // 0-100, weighted 50%
  classMatch: number; // 0-100, weighted 20%
  colorMatch: number; // 0-100, weighted 10%
  historicalMatch: number; // 0-100, weighted 20%
  total: number; // 0-100
}

/** Normalization + matching output consumed by App state. */
export interface NormalizationResult {
  label: string;
  normalizedName: string;
  confidence: number; // 0-100
  status: DetectionStatus;
  scoreBreakdown: ScoreBreakdown;
  suggestions: NormalizationCandidate[];
}
