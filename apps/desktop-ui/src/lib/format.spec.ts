import { describe, expect, it } from 'vitest';
import { formatMinutes, formatClock, localTimezone } from '../lib/format';

describe('formatMinutes', () => {
  it('formats 0 as 0m', () => {
    expect(formatMinutes(0)).toBe('0m');
  });

  it('formats minutes under an hour', () => {
    expect(formatMinutes(45)).toBe('45m');
  });

  it('formats hours and minutes', () => {
    expect(formatMinutes(90)).toBe('1h 30m');
  });

  it('formats exact hours', () => {
    expect(formatMinutes(120)).toBe('2h');
  });

  it('formats large values', () => {
    expect(formatMinutes(600)).toBe('10h');
  });
});

describe('formatClock', () => {
  it('returns a string with HH:MM', () => {
    const result = formatClock('2026-09-16T14:30:00Z');
    expect(result).toMatch(/\d{2}:\d{2}/);
  });
});

describe('localTimezone', () => {
  it('returns a non-empty string', () => {
    expect(localTimezone()).toBeTruthy();
  });
});
