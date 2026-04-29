import { determineStatus } from '../../src/matching/decisionEngine';

describe('determineStatus', () => {
  it('returns verified for score >= 0.8', () => {
    expect(determineStatus(0.8)).toBe('verified');
    expect(determineStatus(1.0)).toBe('verified');
    expect(determineStatus(0.95)).toBe('verified');
  });

  it('returns ambiguous for score between 0.5 and 0.8', () => {
    expect(determineStatus(0.5)).toBe('ambiguous');
    expect(determineStatus(0.65)).toBe('ambiguous');
    expect(determineStatus(0.79)).toBe('ambiguous');
  });

  it('returns unknown for score < 0.5', () => {
    expect(determineStatus(0.49)).toBe('unknown');
    expect(determineStatus(0.2)).toBe('unknown');
    expect(determineStatus(0)).toBe('unknown');
  });
});
