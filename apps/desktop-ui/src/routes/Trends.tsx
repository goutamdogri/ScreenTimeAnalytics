import { useEffect, useState } from 'react';
import type { components } from '@screen-time/api-contract';
import { client } from '../api/client';
import { localTimezone } from '../lib/format';
import { ChartFrame, Skeleton, EmptyState } from '../components/primitives';
import { TrendArea, StackedBars } from '../components/TrendCharts';
import type { StackedBarDatum } from '../components/TrendCharts';

type TrendResponse = components['schemas']['DashboardTrendsResponse'];

export function Trends() {
  const [range, setRange] = useState<'week' | 'month' | 'quarter'>('week');
  const [trends, setTrends] = useState<TrendResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      const res = await client.GET('/dashboard/trends', {
        params: { query: { range, tz: localTimezone() } },
      });
      if (res.response.ok && res.data) setTrends(res.data);
      setLoading(false);
    })();
  }, [range]);

  if (loading) return <Skeleton height={320} />;
  if (!trends) return <EmptyState title="No data" note="Start tracking to see trends." />;

  const trendData = (trends.days ?? []).map((d) => ({
    date: d.date,
    totalMinutes: d.totalMinutes,
  }));
  const barData: StackedBarDatum[] = (trends.days ?? []).map((d) => ({
    date: d.date,
    totalMinutes: d.totalMinutes,
    byCategory: (d.byCategory ?? []).map((c) => ({ category: c.category, minutes: c.minutes })),
  }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        {(['week', 'month', 'quarter'] as const).map((r) => (
          <button
            key={r}
            className="btn"
            data-variant={r === range ? 'primary' : 'ghost'}
            onClick={() => setRange(r)}
          >
            {r}
          </button>
        ))}
      </div>

      <div>
        <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink)', marginBottom: 8 }}>
          Total screen time
        </div>
        <ChartFrame>{(w) => <TrendArea width={w} height={220} data={trendData} />}</ChartFrame>
      </div>

      <div>
        <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink)', marginBottom: 8 }}>
          By category
        </div>
        <ChartFrame>{(w) => <StackedBars width={w} height={220} data={barData} />}</ChartFrame>
      </div>
    </div>
  );
}
