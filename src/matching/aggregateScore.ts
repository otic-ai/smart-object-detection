// Task 6 — Weighted score aggregation.
// score = OCR(0.5) + class(0.2) + color(0.1) + history(0.2)

export interface ScoreComponents {
  ocr: number;
  classMatch: number;
  color: number;
  history: number;
}

const WEIGHTS: ScoreComponents = {
  ocr:        0.5,
  classMatch: 0.2,
  color:      0.1,
  history:    0.2,
};

export function aggregateScore(components: ScoreComponents): number {
  const raw =
    components.ocr        * WEIGHTS.ocr +
    components.classMatch * WEIGHTS.classMatch +
    components.color      * WEIGHTS.color +
    components.history    * WEIGHTS.history;

  return Math.min(1, Math.max(0, raw));
}
