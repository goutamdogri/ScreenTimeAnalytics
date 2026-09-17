import { useEffect, useState } from 'react';
import type { components } from '@screen-time/api-contract';
import { client } from '../api/client';
import { formatMinutes, formatPercent, localTimezone } from '../lib/format';
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
import type { ViewKey } from '../shell/Shell';

type DashboardSummary = components['schemas']['DashboardSummaryResponse'];
type DashboardSessions = components['schemas']['DashboardSessionsResponse'];
type DashboardTrends = components['schemas']['DashboardTrendsResponse'];

export function Overview({ onNavigate }: { onNavigate: (key: ViewKey) => void }) {
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
  const shareOf = (v: number) =>
    formatPercent(summary.totalMinutes > 0 ? v / summary.totalMinutes : 0);
  const deviceWord = summary.activeDevices === 1 ? 'device' : 'devices';

  return (
    <>
      <div className="grid grid-stats">
        <MetricStat
          value={formatMinutes(summary.totalMinutes)}
          label="Screen time today"
          sub={`${summary.sessionCount} sessions across ${summary.activeDevices} ${deviceWord}`}
          tone="accent"
        />
        <MetricStat
          value={formatMinutes(summary.focusMinutes)}
          label="Focus"
          sub={`${shareOf(summary.focusMinutes)} of today`}
        />
        <MetricStat
          value={formatMinutes(summary.autopilotMinutes)}
          label="Autopilot"
          sub={`${shareOf(summary.autopilotMinutes)} of today`}
          tone="autopilot"
        />
      </div>

      <div className="grid grid-2">
        <div className="panel">
          <div className="panel-head">
            <div className="panel-head-stack">
              <div className="panel-title">Today's mix</div>
              <div className="panel-sub">how your time splits up</div>
            </div>
          </div>
          <SplitGauge
            focus={summary.focusMinutes}
            autopilot={summary.autopilotMinutes}
            neutral={summary.neutralMinutes}
            total={summary.totalMinutes}
          />
        </div>

        <div className="panel">
          <div className="panel-head">
            <div className="panel-head-stack">
              <div className="panel-title">Last 7 days</div>
              <div className="panel-sub">daily screen time</div>
            </div>
          </div>
          <ChartFrame>{(w) => <TrendArea width={w} height={170} data={trendData} />}</ChartFrame>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <div className="panel-head-stack">
            <div className="panel-title">Recent sessions</div>
            <div className="panel-sub">the week at a glance</div>
          </div>
        </div>
        {sessions.length === 0 ? (
          <EmptyState title="No sessions yet" note="They'll appear as you work." />
        ) : (
          <SessionTimeline sessions={sessions.slice(0, 6)} />
        )}
      </div>

      <Phase5Tile
        title="Achievements"
        note="XP, streaks, and boss encounters are live — open your progress."
        onClick={() => onNavigate('progress')}
      />
    </>
  );
}
