import { computeHistoryScore } from '../../src/matching/historyScore';

describe('computeHistoryScore', () => {
  it('returns 0.85 when object was seen before', () => {
    expect(computeHistoryScore('cola', ['cola', 'banana'])).toBe(0.85);
  });

  it('returns 0.3 when object has not been seen before', () => {
    expect(computeHistoryScore('sprite', ['cola', 'banana'])).toBe(0.3);
  });

  it('returns 0.3 when history is empty', () => {
    expect(computeHistoryScore('cola', [])).toBe(0.3);
  });

  it('is case-insensitive', () => {
    expect(computeHistoryScore('Cola', ['cola'])).toBe(0.85);
  });
});
