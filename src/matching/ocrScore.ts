// Task 2 — OCR similarity scoring.
// Compares detected OCR text against a candidate's name and aliases.

import { KnownObject } from './types';

export function computeOcrScore(
  ocrText: string | undefined,
  candidate: KnownObject,
): number {
  if (!ocrText || ocrText.trim() === '') return 0;

  const detected = ocrText.toLowerCase().trim();
  const name = candidate.normalised_name.toLowerCase();

  if (detected === name) return 1;

  for (const alias of candidate.aliases) {
    const a = alias.toLowerCase();
    if (detected === a) return 1;
    if (detected.includes(a) || a.includes(detected)) return 0.7;
  }

  if (detected.includes(name) || name.includes(detected)) return 0.6;

  return 0;
}
