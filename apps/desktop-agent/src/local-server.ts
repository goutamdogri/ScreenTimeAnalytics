import { createServer, IncomingMessage, ServerResponse } from 'node:http';

import type { EventBuffer } from './buffer';
import type { AgentLogger } from './logger';
import { browseEvent } from './event-builder';

interface LocalServerDeps {
  port: number;
  buffer: EventBuffer;
  logger: AgentLogger;
  /** Injectable for unit tests. */
  now?: () => Date;
}

const LOOPBACK_RE = /^(127\.0\.0\.1|::1|::ffff:127\.0\.0\.1)$/;

/**
 * Lightweight localhost HTTP surface so the browser extension can POST
 * page-visibility events into the agent's spool without a dedicated IPC
 * mechanism (design doc §7.2 §7.5).
 *
 * Only listens on the loopback interface.
 */
export class LocalServer {
  private server: ReturnType<typeof createServer> | null = null;

  constructor(private readonly deps: LocalServerDeps) {}

  async start(): Promise<void> {
    this.server = createServer((req, res) => this.handle(req, res));
    await new Promise<void>((resolve, reject) => {
      if (!this.server) return reject(new Error('server already shut down'));
      this.server.listen(this.deps.port, '127.0.0.1', () => resolve());
      this.server.on('error', reject);
    });
    this.deps.logger.info('local_server_started', { port: this.deps.port });
  }

  async stop(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if (!this.server) return resolve();
      this.server.close((err) => (err ? reject(err) : resolve()));
    });
  }

  private async handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    if (req.method === 'GET' && req.url === '/health') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    if (req.method !== 'POST' || req.url !== '/event') {
      res.writeHead(404, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'not found' }));
      return;
    }

    if (req.socket.remoteAddress && !LOOPBACK_RE.test(req.socket.remoteAddress)) {
      res.writeHead(403, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'only loopback is allowed' }));
      return;
    }

    const raw = await readBody(req);
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(raw);
    } catch {
      res.writeHead(400, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'invalid JSON' }));
      return;
    }

    const { url, title } = parsed as { url?: string; title?: string };
    if (!url && !title) {
      res.writeHead(400, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'url or title is required' }));
      return;
    }

    const timestamp = this.deps.now?.() ?? new Date();
    const event = browseEvent({
      url: url ?? '',
      title,
      timestamp: timestamp.toISOString(),
    });
    await this.deps.buffer.append(event);

    res.writeHead(202, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ accepted: true }));
  }
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString()));
    req.on('error', reject);
  });
}
