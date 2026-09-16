import { useEffect, useState } from 'react';
import type { components } from '@screen-time/api-contract';
import { client } from '../api/client';
import { Skeleton, EmptyState } from '../components/primitives';

type DeviceDto = components['schemas']['DeviceDto'];

export function Devices() {
  const [devices, setDevices] = useState<DeviceDto[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      const res = await client.GET('/devices');
      if (res.response.ok && res.data) setDevices(res.data);
      setLoading(false);
    })();
  }, []);

  if (loading) return <Skeleton height={200} />;
  if (devices.length === 0)
    return <EmptyState title="No devices" note="Install the agent to register a device." />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {devices.map((d) => (
        <div
          key={d.id}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            padding: '12px 16px',
            borderRadius: 8,
            background: 'var(--surface)',
            border: '1px solid var(--line)',
          }}
        >
          <div style={{ fontSize: 14, color: 'var(--ink)' }}>{d.name}</div>
          <div style={{ fontSize: 12, color: 'var(--ink-4)' }}>{d.platform}</div>
          <div style={{ flex: 1 }} />
          {d.lastSeenAt ? (
            <div style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-num)' }}>
              Last seen {new Date(d.lastSeenAt).toLocaleDateString()}
            </div>
          ) : null}
          <div style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-num)' }}>
            Added {new Date(d.createdAt).toLocaleDateString()}
          </div>
        </div>
      ))}
    </div>
  );
}
