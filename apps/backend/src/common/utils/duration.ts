const multipliers: Record<string, number> = {
  s: 1000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
};

/**
 * Converts durations written like JWT `expiresIn` values (`"15m"`, `"7d"`,
 * `"2h"`, `"30s"`) into milliseconds.
 *
 * @throws {Error} when the value does not match the expected `<number><unit>` format.
 */
export function durationToMilliseconds(value: string): number {
  const match = /^(\d+)([smhd])$/.exec(value.trim().toLowerCase());
  if (!match) {
    throw new Error(
      `Invalid duration "${value}". Expected a value like "30s", "15m", "2h" or "7d".`,
    );
  }
  const amount = Number(match[1]);
  const unit = match[2] as keyof typeof multipliers;
  return amount * multipliers[unit]!;
}
