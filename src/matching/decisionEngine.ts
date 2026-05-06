// Task 7 — Decision engine.
// Converts a composite confidence score into a system status label.

import { MatchStatus } from './types';

export function determineStatus(score: number): MatchStatus {
  if (score >= 0.8) return 'verified';
  if (score >= 0.5) return 'ambiguous';
  return 'unknown';
}
