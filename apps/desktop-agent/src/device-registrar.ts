import type { components, paths } from '@screen-time/api-contract';

import type { AgentConfig } from './config';
import type { ApiClient } from './api-client';
import type { AgentStore } from './store';

type DeviceDto = components['schemas']['DeviceDto'];
type RegisterDeviceBody =
  paths['/devices/register']['post']['requestBody']['content']['application/json'];
type RegisterDeviceResponse =
  paths['/devices/register']['post']['responses'][201]['content']['application/json'];

/**
 * Registers the machine with the backend (idempotent thanks to the
 * `@@unique([userId, name])` constraint) and stores the opaque device token
 * locally. The token is what `/events` accepts, so registration runs before
 * any ingest.
 */
export class DeviceRegistrar {
  constructor(
    private readonly api: ApiClient,
    private readonly store: AgentStore,
    private readonly config: AgentConfig,
    /** Effective platform (`auto` is resolved by the adapter factory first). */
    private readonly platform: string = config.platform,
  ) {}

  /** Returns the device token, registering if we don't have one yet. */
  async ensureDeviceToken(accessToken: string): Promise<{ deviceId: string; deviceToken: string }> {
    const stored = await this.store.load();
    if (stored.deviceToken && stored.deviceId) {
      return { deviceId: stored.deviceId, deviceToken: stored.deviceToken };
    }

    const body: RegisterDeviceBody = {
      name: this.config.deviceName,
      platform: this.platform as RegisterDeviceBody['platform'],
    };
    const res = await this.api.request<RegisterDeviceResponse>('/devices/register', {
      method: 'POST',
      json: body,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    if (!res.body) throw new Error(`device registration failed (HTTP ${res.status})`);

    const device = res.body as DeviceDto;
    const deviceToken = device.deviceToken;
    if (!deviceToken) throw new Error('device registration returned no device token');

    await this.store.save({ ...stored, deviceId: device.id, deviceToken });
    return { deviceId: device.id, deviceToken };
  }
}
