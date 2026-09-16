import { useEffect, useState } from 'react';
import type { components } from '@screen-time/api-contract';
import { client } from '../api/client';
import { formatMinutes, localTimezone } from '../lib/format';
import {
  MetricStat,
  SplitGauge,
  ChartFrame,
  Phase5Tile,
  Skeleton,
  EmptyState,
} from '../components/primitives';
import { TrendArea } from '../components/TrendCharts';
import { SessionTimeline } from '../components/SessionTimeline';

type DashboardSummary = components['schemas']['DashboardSummaryResponse'];
type DashboardSessions = components['schemas']['DashboardSessionsResponse'];
type DashboardTrends = components['schemas']['DashboardTrendsResponse'];

export function Overview() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [sessions, setSessions] = useState<DashboardSessions['sessions']>([]);
  const [trendDays, setTrendDays] = useState<DashboardTrends['days']>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      const today = new Date().toISOString().slice(0, 10);
      const weekAgo = new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10);
      const [sumRes, sessRes, trendRes] = await Promise.all([
        client.GET('/dashboard/summary', {
          params: { query: { date: today, tz: localTimezone() } },
        }),
        client.GET('/dashboard/sessions', {
          params: { query: { from: weekAgo, to: today, tz: localTimezone() } },
        }),
        client.GET('/dashboard/trends', {
          params: { query: { range: 'week', tz: localTimezone() } },
        }),
      ]);
      if (sumRes.response.ok && sumRes.data) setSummary(sumRes.data);
      if (sessRes.response.ok && sessRes.data) setSessions(sessRes.data.sessions);
      if (trendRes.response.ok && trendRes.data) setTrendDays(trendRes.data.days);
      setLoading(false);
    })();
  }, []);

  if (loading) return <Skeleton height={320} />;
  if (!summary) return <EmptyState title="No data yet" note="Start the tracker and come back." />;

  const trendData = trendDays.map((d) => ({ date: d.date, totalMinutes: d.totalMinutes }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
        <MetricStat value={formatMinutes(summary.totalMinutes)} label="Today" />
        <MetricStat value={`${summary.sessionCount}`} label="Sessions" sub="last 7d" />
        <MetricStat value={summary.activeDevices.toString()} label="Active devices" />
      </div>

      <SplitGauge
        focus={summary.focusMinutes}
        autopilot={summary.autopilotMinutes}
        neutral={summary.neutralMinutes}
        total={summary.totalMinutes}
      />
      <div style={{ display: 'flex', gap: 12, fontSize: 12, color: 'var(--ink-4)' }}>
        <span className="chip">
          <span className="chip-dot" style={{ background: 'var(--accent)' }} />
          focus
        </span>
        <span className="chip">
          <span className="chip-dot" style={{ background: 'var(--autopilot)' }} />
          autopilot
        </span>
        <span className="chip">
          <span className="chip-dot" style={{ background: 'var(--ink-4)' }} />
          neutral
        </span>
      </div>

      <div>
        <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink)', marginBottom: 8 }}>
          Last 7 days
        </div>
        <ChartFrame>{(w) => <TrendArea width={w} height={180} data={trendData} />}</ChartFrame>
      </div>

      <div>
        <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink)', marginBottom: 8 }}>
          Recent sessions
        </div>
        {sessions.length === 0 ? (
          <EmptyState title="No sessions yet" note="They'll appear as you work." />
        ) : (
          <SessionTimeline sessions={sessions.slice(0, 6)} />
        )}
      </div>

      <Phase5Tile title="Achievements" note="XP, streaks, and boss encounters — coming soon." />
    </div>
  );
}
