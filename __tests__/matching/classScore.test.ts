import { computeClassScore } from '../../src/matching/classScore';
import { KnownObject } from '../../src/matching/types';

const cola: KnownObject = {
  label: 'soft_drink',
  normalised_name: 'cola',
  aliases: [],
  color: 'red',
  related_classes: ['bottle', 'can', 'drink'],
};

describe('computeClassScore', () => {
  it('returns 1.0 on exact label match', () => {
    expect(computeClassScore('soft_drink', cola)).toBe(1.0);
  });

  it('returns 0.5 on related class match', () => {
    expect(computeClassScore('bottle', cola)).toBe(0.5);
  });

  it('returns 0.0 on no match', () => {
    expect(computeClassScore('laptop', cola)).toBe(0.0);
  });

  it('is case-insensitive', () => {
    expect(computeClassScore('BOTTLE', cola)).toBe(0.5);
  });
});
