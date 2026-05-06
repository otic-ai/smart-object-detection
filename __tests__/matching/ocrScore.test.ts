import { computeOcrScore } from '../../src/matching/ocrScore';
import { KnownObject } from '../../src/matching/types';

const cola: KnownObject = {
  label: 'soft_drink',
  normalised_name: 'cola',
  aliases: ['coca cola', 'coke', 'pepsi'],
  color: 'red',
  related_classes: ['bottle', 'can'],
};

describe('computeOcrScore', () => {
  it('returns 1 on exact normalised_name match', () => {
    expect(computeOcrScore('cola', cola)).toBe(1);
  });

  it('returns 1 on exact alias match', () => {
    expect(computeOcrScore('coke', cola)).toBe(1);
  });

  it('returns 0.7 on partial alias match', () => {
    expect(computeOcrScore('coca cola zero', cola)).toBe(0.7);
  });

  it('returns 0.6 on partial name match', () => {
    expect(computeOcrScore('cola light', cola)).toBe(0.6);
  });

  it('returns 0 when ocr_text is undefined', () => {
    expect(computeOcrScore(undefined, cola)).toBe(0);
  });

  it('returns 0 when ocr_text is empty string', () => {
    expect(computeOcrScore('', cola)).toBe(0);
  });

  it('returns 0 when there is no match', () => {
    expect(computeOcrScore('banana', cola)).toBe(0);
  });
});
