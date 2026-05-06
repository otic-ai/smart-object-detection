// Task 4 — Color similarity scoring.
// Groups color variants (e.g. "scarlet" and "red") so nearby shades score 0.5.

import { KnownObject } from './types';

const COLOR_GROUPS: Record<string, string[]> = {
  red:    ['red', 'crimson', 'scarlet', 'maroon'],
  blue:   ['blue', 'navy', 'cobalt', 'cyan'],
  green:  ['green', 'olive', 'lime', 'emerald'],
  yellow: ['yellow', 'gold', 'amber'],
  white:  ['white', 'cream', 'ivory'],
  black:  ['black', 'charcoal', 'dark'],
  brown:  ['brown', 'tan', 'beige'],
  orange: ['orange', 'coral'],
  purple: ['purple', 'violet', 'lavender'],
  pink:   ['pink', 'rose', 'magenta'],
};

function colorGroup(color: string): string | null {
  const c = color.toLowerCase().trim();
  for (const [group, variants] of Object.entries(COLOR_GROUPS)) {
    if (variants.includes(c)) return group;
  }
  return null;
}

export function computeColorScore(
  detectedColor: string | undefined,
  candidate: KnownObject,
): number {
  if (!detectedColor || detectedColor.trim() === '') return 0;
  if (!candidate.color) return 0;

  const detected = detectedColor.toLowerCase().trim();
  const expected = candidate.color.toLowerCase().trim();

  if (detected === expected) return 1.0;

  const dGroup = colorGroup(detected);
  const eGroup = colorGroup(expected);
  if (dGroup && eGroup && dGroup === eGroup) return 0.5;

  return 0.0;
}
