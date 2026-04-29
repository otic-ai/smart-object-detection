// Task 5 — History match scoring.
// Boosts confidence for objects the system has successfully identified before.
// history is an array of normalised_name strings from past verified detections.

export function computeHistoryScore(
  candidateNormalisedName: string,
  history: string[],
): number {
  if (history.length === 0) return 0.3;

  const target = candidateNormalisedName.toLowerCase();
  const seen = history.some(h => h.toLowerCase() === target);

  return seen ? 0.85 : 0.3;
}
