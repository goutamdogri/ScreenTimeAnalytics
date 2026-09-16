import { readFile } from 'node:fs/promises';

/**
 * Reads the process name (comm) from /proc/<pid>/comm.
 * Returns null if the file is missing or unreadable (e.g. another user's process).
 */
export async function readComm(pid: string): Promise<string | null> {
  try {
    const raw = await readFile(`/proc/${pid}/comm`, { encoding: 'utf8' });
    const trimmed = raw.trim();
    return trimmed.length > 0 ? trimmed : null;
  } catch {
    return null;
  }
}
