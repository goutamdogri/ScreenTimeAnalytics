import { useEffect, useState } from 'react';
import type { components } from '@screen-time/api-contract';
import { client } from '../api/client';
import { localTimezone } from '../lib/format';
import { Skeleton, EmptyState } from '../components/primitives';
import { SessionTimeline } from '../components/SessionTimeline';

type SessionDto = components['schemas']['SessionDto'];

export function Sessions() {
  const [sessions, setSessions] = useState<SessionDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const today = new Date().toISOString().slice(0, 10);
      const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
      const res = await client.GET('/dashboard/sessions', {
        params: { query: { from: thirtyDaysAgo, to: today, tz: localTimezone() } },
      });
      if (res.response.ok && res.data) setSessions(res.data.sessions);
      setLoading(false);
    })();
  }, []);

  if (loading) return <Skeleton height={320} />;
  if (sessions.length === 0)
    return <EmptyState title="No sessions yet" note="They'll appear as you work." />;

  const filtered = filter ? sessions.filter((s) => s.category === filter) : sessions;
  const categories = [...new Set(sessions.map((s) => s.category))].sort();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button
          className="chip"
          onClick={() => setFilter(null)}
          style={{ borderColor: !filter ? 'var(--accent)' : undefined }}
        >
          all ({sessions.length})
        </button>
        {categories.map((cat) => {
          const count = sessions.filter((s) => s.category === cat).length;
          return (
            <button
              key={cat}
              className="chip"
              onClick={() => setFilter(cat)}
              style={{ borderColor: filter === cat ? 'var(--accent)' : undefined }}
            >
              {cat} ({count})
            </button>
          );
        })}
      </div>
      <SessionTimeline sessions={filtered} />
    </div>
  );
}
