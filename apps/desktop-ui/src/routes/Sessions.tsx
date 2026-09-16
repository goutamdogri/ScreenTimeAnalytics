import { useEffect, useState } from 'react';
import type { components } from '@screen-time/api-contract';
import { client } from '../api/client';
import { localTimezone } from '../lib/format';
import { categoryLabel } from '../lib/category-colors';
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

  const categories = [...new Set(sessions.map((s) => s.category))].sort();
  const filtered = filter ? sessions.filter((s) => s.category === filter) : sessions;

  return (
    <div className="panel">
      <div className="panel-head">
        <div className="panel-head-stack">
          <div className="panel-title">All sessions</div>
          <div className="panel-sub">
            {filtered.length} of {sessions.length} in the last 30 days
          </div>
        </div>
        <div className="panel-head-right">
          <button className={`chip${!filter ? ' active' : ''}`} onClick={() => setFilter(null)}>
            all ({sessions.length})
          </button>
          {categories.map((cat) => {
            const count = sessions.filter((s) => s.category === cat).length;
            return (
              <button
                key={cat}
                className={`chip${filter === cat ? ' active' : ''}`}
                onClick={() => setFilter(cat)}
              >
                {categoryLabel(cat)} ({count})
              </button>
            );
          })}
        </div>
      </div>
      {filtered.length === 0 ? (
        <EmptyState title="No sessions yet" note="They'll appear as you work." />
      ) : (
        <SessionTimeline sessions={filtered} />
      )}
    </div>
  );
}
