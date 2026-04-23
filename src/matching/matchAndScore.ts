// Task 8 & 9 — Main matching and scoring pipeline + edge case handling.
// matchAndScore() is the single entry point for this layer.

import { DetectionInput, KnownObject, MatchResult } from './types';
import { computeOcrScore } from './ocrScore';
import { computeClassScore } from './classScore';
import { computeColorScore } from './colorScore';
import { computeHistoryScore } from './historyScore';
import { aggregateScore } from './aggregateScore';
import { determineStatus } from './decisionEngine';
import { KNOWLEDGE_BASE } from './knowledgeBase';

interface ScoredCandidate {
  candidate: KnownObject;
  score: number;
}

/**
 * Score a normalised detection against all known objects and return the
 * best match with a confidence score and status decision.
 *
 * @param input       - Normalised detection from the Normalization layer.
 * @param history     - Array of normalised_name strings from past detections.
 * @param knowledgeBase - Defaults to the built-in stub; swap for real data.
 */
export function matchAndScore(
  input: DetectionInput,
  history: string[] = [],
  knowledgeBase: KnownObject[] = KNOWLEDGE_BASE,
): MatchResult {
  // Edge case: clamp confidence to 0–1; very low confidence scales down the score.
  const conf = Math.min(1, Math.max(0, input.confidence ?? 0));
  // Treat confidence < 0.3 as a soft penalty rather than a hard cutoff.
  const confidenceMultiplier = conf < 0.3 ? 0.5 + conf : 1;

  const scored: ScoredCandidate[] = knowledgeBase.map(candidate => {
    const ocr        = computeOcrScore(input.ocr_text, candidate);
    const classMatch = computeClassScore(input.class, candidate);
    const color      = computeColorScore(input.color, candidate);
    const histScore  = computeHistoryScore(candidate.normalised_name, history);

    const raw   = aggregateScore({ ocr, classMatch, color, history: histScore });
    const score = raw * confidenceMultiplier;

    return { candidate, score };
  });

  scored.sort((a, b) => b.score - a.score);

  const best = scored[0];

  // Edge case: no candidates in knowledge base or all scores are zero.
  if (!best || best.score === 0) {
    return {
      label: 'unknown',
      normalised_name: 'unknown',
      confidence: 0,
      status: 'unknown',
    };
  }

  const status = determineStatus(best.score);

  const suggestions =
    status === 'ambiguous'
      ? scored
          .filter(s => s.score >= 0.3 && s.candidate !== best.candidate)
          .slice(0, 3)
          .map(s => s.candidate.normalised_name)
      : undefined;

  return {
    label:            best.candidate.label,
    normalised_name:  best.candidate.normalised_name,
    confidence:       parseFloat(best.score.toFixed(4)),
    status,
    suggestions,
  };
}
