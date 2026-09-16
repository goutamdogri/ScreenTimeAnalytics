/**
 * Parse the window id from `xprop -root _NET_ACTIVE_WINDOW` stdout.
 *
 * Example output:
 * ```
 * _NET_ACTIVE_WINDOW(WINDOW): window id # 0x3600007
 * ```
 * Returns `null` when no id is present (e.g. no window is focused).
 */
export function parseActiveWindowId(stdout: string): string | null {
  const m = stdout.match(/window id #\s*(0x[0-9a-fA-F]+|\d+)/);
  return m?.[1] ?? null;
}

/**
 * Parse WM_NAME / _NET_WM_NAME and _NET_WM_PID from `xprop -id <id>` output.
 *
 * Example output lines:
 * ```
 * _NET_WM_PID(CARDINAL) = 12345
 * WM_NAME(STRING) = "My Window"
 * _NET_WM_NAME(UTF8_STRING) = "My Window"
 * ```
 */
export function parseWindowMeta(stdout: string): { title: string | null; pid: string | null } {
  const pidMatch = stdout.match(/_NET_WM_PID\(.*?\)\s*=\s*(\d+)/);
  const pid = pidMatch?.[1] ?? null;

  const netTitleMatch = stdout.match(/_NET_WM_NAME\(.*?\)\s*=\s*(?:"([^"]*)"|([^\n]*))/);
  const wmTitleMatch = stdout.match(/WM_NAME\(.*?\)\s*=\s*(?:"([^"]*)"|([^\n]*))/);

  const netTitle = netTitleMatch ? (netTitleMatch[1] ?? netTitleMatch[2] ?? null) : null;
  const wmTitle = wmTitleMatch ? (wmTitleMatch[1] ?? wmTitleMatch[2] ?? null) : null;
  const rawTitle = netTitle ?? wmTitle;

  if (rawTitle === null) {
    return { title: null, pid };
  }

  const trimmed = rawTitle.trim();
  if (trimmed === '(none)' || trimmed === '0x0' || trimmed.length === 0) {
    return { title: null, pid };
  }
  return { title: trimmed, pid };
}
