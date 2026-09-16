import type { ActiveWindowInfo } from '@screen-time/adapters';
import { createIdleProbe, createMprisBus, MprisAdapter, X11Adapter } from '@screen-time/adapters';

import { ApiClient } from './api-client';
import { AuthClient } from './auth';
import { EventBuffer } from './buffer';
import type { AgentConfig } from './config';
import { DeviceRegistrar } from './device-registrar';
import { focusEvent, idleEvent, mediaEvent } from './event-builder';
import { LocalServer } from './local-server';
import type { AgentLogger } from './logger';
import { FileAgentStore } from './store';
import { SyncEngine } from './sync';

export interface AgentAppOptions {
  config: AgentConfig;
  logger: AgentLogger;
  /** Injectable object store (defaults to `${config.configDir}/agent.json`). */
  store?: FileAgentStore;
  /** Injectable API client (tests replace this). */
  api?: ApiClient;
  /** Injectable spool (tests replace this). */
  buffer?: EventBuffer;
  /** Injectable adapter factory — tests return fakes. */
  adapters?: () => Promise<{ x11: X11Adapter; mpris: MprisAdapter | null }>;
  /** Injectable clock. */
  now?: () => Date;
}

/**
 * Top-level orchestration: authenticate → register the device → start the
 * platform adapters, the local capture server, and the sync loop → tear
 * down on stop().
 */
export class AgentApp {
  private readonly config: AgentConfig;
  private readonly logger: AgentLogger;
  private readonly store: FileAgentStore;
  private readonly api: ApiClient;
  private readonly buffer: EventBuffer;
  private readonly adapters: () => Promise<{ x11: X11Adapter; mpris: MprisAdapter | null }>;
  private readonly now: () => Date;

  private x11: X11Adapter | null = null;
  private mpris: MprisAdapter | null = null;
  private sync: SyncEngine | null = null;
  private localServer: LocalServer | null = null;
  private captureTimer: ReturnType<typeof setInterval> | null = null;
  private lastWindow: ActiveWindowInfo | null = null;
  private started = false;
  private disposed = false;

  constructor(opts: AgentAppOptions) {
    this.config = opts.config;
    this.logger = opts.logger;
    this.now = opts.now ?? (() => new Date());
    this.store = opts.store ?? new FileAgentStore(`${opts.config.configDir}/agent.json`);
    this.api = opts.api ?? new ApiClient(opts.config.apiBaseUrl);
    this.buffer = opts.buffer ?? new EventBuffer(opts.config.spoolDir);
    this.adapters = opts.adapters ?? (() => defaultAdapters(this.config, this.logger));
  }

  async start(): Promise<{ deviceId: string }> {
    if (this.started) throw new Error('agent already started');
    this.started = true;

    const auth = new AuthClient(this.api, this.store);
    const accessToken = await auth.ensureAccessToken();

    const registrar = new DeviceRegistrar(this.api, this.store, this.config);
    const { deviceId, deviceToken } = await registrar.ensureDeviceToken(accessToken);
    this.logger.info('device_ready', { deviceId });

    const adapters = await this.adapters();
    this.x11 = adapters.x11;
    this.mpris = adapters.mpris;

    this.x11.onIdleChanged((idle) => {
      void this.buffer.append(idleEvent(this.now().toISOString(), idle));
    });
    this.mpris?.onMediaChanged((np) => {
      void this.buffer.append(mediaEvent(this.now().toISOString(), np));
    });

    this.x11.start();
    this.mpris?.start();

    this.captureTimer = setInterval(() => void this.captureFocusTick(), this.config.pollIntervalMs);
    this.captureTimer.unref();

    this.sync = new SyncEngine({
      api: this.api,
      buffer: this.buffer,
      deviceToken,
      config: this.config,
      logger: this.logger,
      now: this.now,
    });
    this.sync.start();

    if (this.config.localServerPort !== null && this.config.localServerPort > 0) {
      this.localServer = new LocalServer({
        port: this.config.localServerPort,
        buffer: this.buffer,
        logger: this.logger,
        now: this.now,
      });
      await this.localServer.start().catch((err) =>
        this.logger.warn('local_server_failed', {
          message: err instanceof Error ? err.message : String(err),
        }),
      );
    }

    return { deviceId };
  }

  async stop(): Promise<void> {
    if (this.disposed) return;
    this.disposed = true;

    if (this.captureTimer) clearInterval(this.captureTimer);
    this.captureTimer = null;

    const sync = this.sync;
    this.sync = null;
    await sync?.stop();

    const localServer = this.localServer;
    this.localServer = null;
    if (localServer) await localServer.stop().catch(() => {});

    this.x11?.dispose();
    this.mpris?.dispose();
    this.x11 = null;
    this.mpris = null;
  }

  private async captureFocusTick(): Promise<void> {
    if (!this.x11) return;
    const window = this.x11.getActiveWindow();
    if (window === null) {
      this.lastWindow = null;
      return;
    }
    const sameAsLast =
      this.lastWindow !== null &&
      this.lastWindow.title === window.title &&
      this.lastWindow.processName === window.processName;
    if (sameAsLast) return;

    const event = focusEvent(this.now().toISOString(), window);
    await this.buffer.append(event);
    this.lastWindow = window;
  }
}

async function defaultAdapters(
  config: AgentConfig,
  logger: AgentLogger,
): Promise<{ x11: X11Adapter; mpris: MprisAdapter | null }> {
  const idleProbe = await createIdleProbe(logger);
  const x11 = new X11Adapter({
    idleProbe,
    pollIntervalMs: config.pollIntervalMs,
    idleThresholdMs: config.idleThresholdMs,
    logger,
  });

  const mprisBus = await createMprisBus(logger);
  const mpris: MprisAdapter | null =
    mprisBus === null ? null : new MprisAdapter({ bus: mprisBus, logger });

  return { x11, mpris };
}

export { AuthClient, DeviceRegistrar };
