import { useEffect, useState } from 'react';
import type { components } from '@screen-time/api-contract';
import { client } from '../api/client';
import { Skeleton, EmptyState } from '../components/primitives';

type DeviceDto = components['schemas']['DeviceDto'];

function shortDate(iso: string | undefined): string {
  if (!iso) return 'never';
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

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

  return (
    <div className="panel">
      <div className="panel-head">
        <div className="panel-head-stack">
          <div className="panel-title">Registered devices</div>
          <div className="panel-sub">active trackers on this account</div>
        </div>
      </div>
      {devices.length === 0 ? (
        <EmptyState title="No devices" note="Install the agent to register a device." />
      ) : (
        <div className="list">
          {devices.map((d) => (
            <div key={d.id} className="list-row">
              <span className="icon-dot" style={{ background: 'var(--accent)' }} />
              <div className="row-main">
                <div className="row-title">{d.name}</div>
                <div className="row-sub">{d.platform}</div>
              </div>
              <div className="row-meta">last seen {shortDate(d.lastSeenAt)}</div>
              <div className="row-meta">added {shortDate(d.createdAt)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
