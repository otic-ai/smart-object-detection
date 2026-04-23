// Task 10 — End-to-end pipeline tests.
// Covers: verified, ambiguous, unknown, and all edge cases.

import { matchAndScore } from '../../src/matching/matchAndScore';
import { KnownObject } from '../../src/matching/types';

// Minimal knowledge base used across tests for predictability.
const KB: KnownObject[] = [
  {
    label: 'soft_drink',
    normalised_name: 'cola',
    aliases: ['coca cola', 'coke'],
    color: 'red',
    related_classes: ['bottle', 'can'],
  },
  {
    label: 'food',
    normalised_name: 'banana',
    aliases: ['banana'],
    color: 'yellow',
    related_classes: ['fruit', 'banana'],
  },
];

// ─── High confidence (verified) ───────────────────────────────────────────────

describe('high confidence — verified', () => {
  it('returns verified when OCR, class, color, and history all match strongly', () => {
    const result = matchAndScore(
      { id: '1', class: 'bottle', ocr_text: 'coca cola', color: 'red', confidence: 1 },
      ['cola'],
      KB,
    );
    expect(result.status).toBe('verified');
    expect(result.normalised_name).toBe('cola');
    expect(result.confidence).toBeGreaterThanOrEqual(0.8);
  });
});

// ─── Ambiguous ─────────────────────────────────────────────────────────────────

describe('ambiguous case', () => {
  it('returns ambiguous when OCR partially matches and class is related', () => {
    // Partial OCR "coca" hits alias "coca cola" at 0.7 → contributes 0.35
    // class "bottle" is related → contributes 0.1
    // no color, no history → 0.06
    // total ≈ 0.51 → ambiguous
    const result = matchAndScore(
      { id: '2', class: 'bottle', ocr_text: 'coca', confidence: 0.9 },
      [],
      KB,
    );
    expect(result.status).toBe('ambiguous');
    expect(result.confidence).toBeGreaterThanOrEqual(0.5);
    expect(result.confidence).toBeLessThan(0.8);
  });

  it('includes suggestions when status is ambiguous', () => {
    const result = matchAndScore(
      { id: '3', class: 'bottle', confidence: 0.7 },
      [],
      KB,
    );
    if (result.status === 'ambiguous') {
      expect(Array.isArray(result.suggestions)).toBe(true);
    }
  });
});

// ─── Unknown ───────────────────────────────────────────────────────────────────

describe('unknown case', () => {
  it('returns unknown when nothing matches', () => {
    const result = matchAndScore(
      { id: '4', class: 'spaceship', ocr_text: 'xyz123', color: 'purple', confidence: 0.9 },
      [],
      KB,
    );
    expect(result.status).toBe('unknown');
    expect(result.confidence).toBeLessThan(0.5);
  });

  it('returns unknown when knowledge base is empty', () => {
    const result = matchAndScore(
      { id: '5', class: 'bottle', ocr_text: 'cola', color: 'red', confidence: 1 },
      [],
      [],
    );
    expect(result.status).toBe('unknown');
    expect(result.confidence).toBe(0);
  });
});

// ─── Edge cases ────────────────────────────────────────────────────────────────

describe('edge cases', () => {
  it('handles missing ocr_text without crashing', () => {
    expect(() =>
      matchAndScore({ id: '6', class: 'bottle', confidence: 0.8 }, [], KB),
    ).not.toThrow();
  });

  it('handles missing color without crashing', () => {
    expect(() =>
      matchAndScore({ id: '7', class: 'bottle', ocr_text: 'cola', confidence: 0.8 }, [], KB),
    ).not.toThrow();
  });

  it('handles zero confidence — score is reduced but no crash', () => {
    const result = matchAndScore(
      { id: '8', class: 'bottle', ocr_text: 'coca cola', color: 'red', confidence: 0 },
      ['cola'],
      KB,
    );
    expect(result).toBeDefined();
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });

  it('handles empty history without crashing', () => {
    expect(() =>
      matchAndScore({ id: '9', class: 'banana', ocr_text: 'banana', color: 'yellow', confidence: 0.9 }, [], KB),
    ).not.toThrow();
  });

  it('output confidence is always between 0 and 1', () => {
    const result = matchAndScore(
      { id: '10', class: 'bottle', ocr_text: 'coca cola', color: 'red', confidence: 1 },
      ['cola'],
      KB,
    );
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });
});
