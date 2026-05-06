// Task 3 — Class match scoring.
// Compares the YOLO-detected class against a candidate's expected classes.

import { KnownObject } from './types';

export function computeClassScore(
  detectedClass: string,
  candidate: KnownObject,
): number {
  const cls = detectedClass.toLowerCase().trim();

  if (cls === candidate.label.toLowerCase()) return 1.0;
  if (candidate.related_classes.map(c => c.toLowerCase()).includes(cls)) return 0.5;

  return 0.0;
}
