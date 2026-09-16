import { useEffect, useState } from 'react';
import type { components } from '@screen-time/api-contract';
import { client } from '../api/client';
import { localTimezone } from '../lib/format';
import { ChartFrame, Skeleton, EmptyState } from '../components/primitives';
import { TrendArea, StackedBars } from '../components/TrendCharts';
import type { StackedBarDatum } from '../components/TrendCharts';

type TrendResponse = components['schemas']['DashboardTrendsResponse'];

const RANGES = [
  { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' },
  { key: 'quarter', label: 'Quarter' },
] as const;

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

  const rangeTitle: Record<string, string> = {
    week: 'last 7 days',
    month: 'last 30 days',
    quarter: 'last 90 days',
  };

  return (
    <>
      <div className="panel">
        <div className="panel-head">
          <div className="panel-head-stack">
            <div className="panel-title">Total screen time</div>
            <div className="panel-sub">{rangeTitle[range]}</div>
          </div>
          <div className="panel-head-right">
            <div className="seg" role="tablist" aria-label="Time range">
              {RANGES.map((r) => (
                <button
                  key={r.key}
                  role="tab"
                  aria-selected={r.key === range}
                  className={r.key === range ? 'active' : ''}
                  onClick={() => setRange(r.key)}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>
        </div>
        <ChartFrame>{(w) => <TrendArea width={w} height={210} data={trendData} />}</ChartFrame>
      </div>

      <div className="panel">
        <div className="panel-head">
          <div className="panel-head-stack">
            <div className="panel-title">By category</div>
            <div className="panel-sub">stacked daily breakdown</div>
          </div>
        </div>
        <ChartFrame fallbackHeight={210}>
          {(w) => <StackedBars width={w} height={210} data={barData} />}
        </ChartFrame>
      </div>
    </>
  );
}
