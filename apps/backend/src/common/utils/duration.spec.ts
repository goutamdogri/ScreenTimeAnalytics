import { durationToMilliseconds } from './duration';

describe('durationToMilliseconds', () => {
  it.each([
    ['30s', 30_000],
    ['15m', 900_000],
    ['2h', 7_200_000],
    ['7d', 604_800_000],
    ['1s', 1_000],
  ])('"%s" → %d ms', (input, expected) => {
    expect(durationToMilliseconds(input)).toBe(expected);
  });

  it('is case-insensitive', () => {
    expect(durationToMilliseconds('15M')).toBe(900_000);
    expect(durationToMilliseconds('2H')).toBe(7_200_000);
  });

  it.each(['', 'abc', '1x', '15ms', '15 mins'])('throws for "%s"', (input) => {
    expect(() => durationToMilliseconds(input)).toThrow('Invalid duration');
  });
});
