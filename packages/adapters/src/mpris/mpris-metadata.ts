import { NowPlayingInfo } from '../index';

const TRACK_TITLE_KEYS = ['xesam:title', 'xesam:url'];
const ARTIST_KEYS = ['xesam:artist', 'xesam:albumArtist'];
const LENGTH_KEY = 'mpris:length';

function unwrap(v: unknown): unknown {
  if (v && typeof v === 'object' && 'value' in (v as Record<string, unknown>)) {
    return (v as { value: unknown }).value;
  }
  return v;
}

function firstString(raw: Record<string, unknown>, keys: string[]): string | null {
  for (const k of keys) {
    const rawVal = raw[k];
    const val = unwrap(rawVal);
    if (typeof val === 'string' && val.length > 0) return val;
  }
  return null;
}

function extractArtist(raw: Record<string, unknown>): string {
  for (const k of ARTIST_KEYS) {
    const rawVal = raw[k];
    const val = unwrap(rawVal);
    if (typeof val === 'string' && val.length > 0) return val;
    if (Array.isArray(val)) {
      const parts = (val as unknown[])
        .map((a) => unwrap(a))
        .filter((a): a is string => typeof a === 'string' && a.length > 0);
      if (parts.length > 0) return parts.join(', ');
    }
  }
  return 'Unknown Artist';
}

function extractDurationSeconds(raw: Record<string, unknown>): number {
  const rawVal = raw[LENGTH_KEY];
  const val = unwrap(rawVal);
  if (typeof val === 'number' || typeof val === 'bigint') {
    const micros = Number(val);
    return micros > 0 ? Math.round(micros / 1_000_000) : 0;
  }
  return 0;
}

/**
 * Map a raw MPRIS metadata object (a{sv} from D-Bus, already unwrapped by
 * the caller) to a `NowPlayingInfo` that our agent understands.
 *
 * Returns `null` when the metadata lacks a title (the player is paused or
 * has been stopped but has not been garbage-collected yet).
 */
export function mapMprisMetadata(
  raw: Record<string, unknown>,
  sourceApp: string,
): NowPlayingInfo | null {
  const trackTitle = firstString(raw, TRACK_TITLE_KEYS);
  if (!trackTitle) return null;
  return {
    trackTitle,
    artist: extractArtist(raw),
    sourceApp,
    durationSeconds: extractDurationSeconds(raw),
  };
}
