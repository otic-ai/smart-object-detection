import { aggregateScore } from '../../src/matching/aggregateScore';

describe('aggregateScore', () => {
  it('returns 1 when all components are 1', () => {
    expect(aggregateScore({ ocr: 1, classMatch: 1, color: 1, history: 1 })).toBe(1);
  });

  it('returns 0 when all components are 0', () => {
    expect(aggregateScore({ ocr: 0, classMatch: 0, color: 0, history: 0 })).toBe(0);
  });

  it('applies weights correctly — OCR only', () => {
    // OCR weight is 0.5
    expect(aggregateScore({ ocr: 1, classMatch: 0, color: 0, history: 0 })).toBe(0.5);
  });

  it('applies weights correctly — class only', () => {
    // class weight is 0.2
    expect(aggregateScore({ ocr: 0, classMatch: 1, color: 0, history: 0 })).toBe(0.2);
  });

  it('clamps output to [0, 1]', () => {
    expect(aggregateScore({ ocr: 2, classMatch: 2, color: 2, history: 2 })).toBe(1);
  });

  it('partial mix produces correct weighted sum', () => {
    // 0.5*0.5 + 0.5*0.2 + 0*0.1 + 0*0.2 = 0.25 + 0.1 = 0.35
    expect(aggregateScore({ ocr: 0.5, classMatch: 0.5, color: 0, history: 0 })).toBeCloseTo(0.35);
  });
});
