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
