import { computeColorScore } from '../../src/matching/colorScore';
import { KnownObject } from '../../src/matching/types';

const cola: KnownObject = {
  label: 'soft_drink',
  normalised_name: 'cola',
  aliases: [],
  color: 'red',
  related_classes: [],
};

const noColor: KnownObject = {
  label: 'food',
  normalised_name: 'rice',
  aliases: [],
  related_classes: [],
};

describe('computeColorScore', () => {
  it('returns 1.0 on exact color match', () => {
    expect(computeColorScore('red', cola)).toBe(1.0);
  });

  it('returns 0.5 for same color family', () => {
    expect(computeColorScore('crimson', cola)).toBe(0.5);
  });

  it('returns 0.0 on different color', () => {
    expect(computeColorScore('blue', cola)).toBe(0.0);
  });

  it('returns 0 when detectedColor is undefined', () => {
    expect(computeColorScore(undefined, cola)).toBe(0);
  });

  it('returns 0 when detectedColor is empty', () => {
    expect(computeColorScore('', cola)).toBe(0);
  });

  it('returns 0 when candidate has no expected color', () => {
    expect(computeColorScore('red', noColor)).toBe(0);
  });
});
