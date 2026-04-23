// Task 1 — Input / Output types for the Matching & Scoring layer.
// Input arrives from the Normalization layer (colleague's module).
// Output is consumed by the UI and the Learning layer.

export interface DetectionInput {
  id: string;
  class: string;
  ocr_text?: string;
  color?: string;
  /** Normalised confidence from the detection model, 0–1 */
  confidence: number;
}

export type MatchStatus = 'verified' | 'ambiguous' | 'unknown';

export interface MatchResult {
  label: string;
  normalised_name: string;
  /** Weighted composite score, 0–1 */
  confidence: number;
  status: MatchStatus;
  /** Populated only when status === 'ambiguous' */
  suggestions?: string[];
}

/** A single entry in the knowledge base that candidates are scored against. */
export interface KnownObject {
  label: string;
  normalised_name: string;
  aliases: string[];
  color?: string;
  related_classes: string[];
}
