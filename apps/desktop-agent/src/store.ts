import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

/**
 * Persistent credentials/device state for the agent (the "agent store").
 * Stored as JSON at `~/.config/screen-time/agent.json`.
 *
 * Never stores the user's password; only the refresh token (which can be
 * rotated) and the opaque device token.
 */
export interface AgentStoreData {
  userId?: string;
  email?: string;
  accessToken?: string;
  refreshToken?: string;
  deviceId?: string;
  deviceToken?: string;
}

export interface AgentStore {
  load(): Promise<Partial<AgentStoreData>>;
  save(data: Partial<AgentStoreData>): Promise<void>;
}

export class FileAgentStore implements AgentStore {
  constructor(private readonly filePath: string) {}

  async load(): Promise<Partial<AgentStoreData>> {
    try {
      const raw = await readFile(this.filePath, { encoding: 'utf8' });
      const parsed = JSON.parse(raw) as Partial<AgentStoreData>;
      return parsed ?? {};
    } catch {
      return {};
    }
  }

  async save(data: Partial<AgentStoreData>): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    const tmp = `${this.filePath}.tmp`;
    await writeFile(tmp, `${JSON.stringify(data, null, 2)}\n`, { encoding: 'utf8' });
    await rename(tmp, this.filePath);
  }
}
