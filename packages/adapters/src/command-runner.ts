import { execFile } from 'node:child_process';

/**
 * Abstraction over child process execution for testability.
 * `X11Adapter` depends on this rather than calling `execFile` directly, so
 * unit tests can inject fake command output without spawning real processes.
 */
export interface CommandOutput {
  stdout: string;
  stderr: string;
}

export interface CommandRunner {
  run(command: string, args: string[], timeoutMs?: number): Promise<CommandOutput>;
}

const DEFAULT_TIMEOUT_MS = 3_000;

export class ChildProcessCommandRunner implements CommandRunner {
  async run(
    command: string,
    args: string[],
    timeoutMs = DEFAULT_TIMEOUT_MS,
  ): Promise<CommandOutput> {
    return new Promise((resolve, reject) => {
      execFile(command, args, { timeout: timeoutMs }, (error, stdout, stderr) => {
        if (error) {
          reject(error);
          return;
        }
        resolve({ stdout, stderr });
      });
    });
  }
}

/**
 * Check whether a command is available on the host system.
 */
export async function isCommandAvailable(command: string): Promise<boolean> {
  try {
    const runner = new ChildProcessCommandRunner();
    await runner.run('which', [command], 2_000);
    return true;
  } catch {
    return false;
  }
}
