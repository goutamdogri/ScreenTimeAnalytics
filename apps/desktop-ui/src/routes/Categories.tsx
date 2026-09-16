import { useEffect, useState } from 'react';
import type { components } from '@screen-time/api-contract';
import { client } from '../api/client';
import { localTimezone } from '../lib/format';
import { ChartFrame, Skeleton, EmptyState, Phase5Tile } from '../components/primitives';
import { BudgetRings } from '../components/BudgetRings';
import { CalendarHeatmap } from '../components/CalendarHeatmap';
import { StackedBars } from '../components/TrendCharts';
import type { StackedBarDatum } from '../components/TrendCharts';

type CategoriesResponse = components['schemas']['DashboardCategoriesResponse'];
type TrendResponse = components['schemas']['DashboardTrendsResponse'];

export function Categories() {
  const [categories, setCategories] = useState<CategoriesResponse | null>(null);
  const [trends, setTrends] = useState<TrendResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      const [catRes, trendRes] = await Promise.all([
        client.GET('/dashboard/categories', {
          params: { query: { range: 'month', tz: localTimezone() } },
        }),
        client.GET('/dashboard/trends', {
          params: { query: { range: 'month', tz: localTimezone() } },
        }),
      ]);
      if (catRes.response.ok && catRes.data) setCategories(catRes.data);
      if (trendRes.response.ok && trendRes.data) setTrends(trendRes.data);
      setLoading(false);
    })();
  }, []);

  if (loading) return <Skeleton height={320} />;
  if (!categories) return <EmptyState title="No data" note="Start tracking to see categories." />;

  const totalMinutes = categories.totals.reduce((s, c) => s + c.minutes, 0);
  const ringData = categories.totals.map((c) => ({
    category: c.category,
    minutes: c.minutes,
    share: c.share,
  }));

  const barData: StackedBarDatum[] = (trends?.days ?? []).map((d) => ({
    date: d.date,
    totalMinutes: d.totalMinutes,
    byCategory: (d.byCategory ?? []).map((c) => ({ category: c.category, minutes: c.minutes })),
  }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 20 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink)', marginBottom: 12 }}>
            Breakdown
          </div>
          <BudgetRings data={ringData} total={totalMinutes} />
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink)', marginBottom: 12 }}>
            Heatmap (14 weeks)
          </div>
          <ChartFrame fallbackHeight={140}>
            {(w) => <CalendarHeatmap width={w} data={[]} />}
          </ChartFrame>
        </div>
      </div>

      {barData.length > 0 && (
        <div>
          <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink)', marginBottom: 8 }}>
            Daily categories
          </div>
          <ChartFrame>{(w) => <StackedBars width={w} height={220} data={barData} />}</ChartFrame>
        </div>
      )}

      <Phase5Tile title="Radial chart" note="Interactive sunburst — coming in Phase 5." />
    </div>
  );
}
