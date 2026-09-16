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
    <>
      <div className="grid grid-2-eq">
        <div className="panel">
          <div className="panel-head">
            <div className="panel-head-stack">
              <div className="panel-title">Breakdown</div>
              <div className="panel-sub">last 30 days by category</div>
            </div>
          </div>
          <BudgetRings data={ringData} total={totalMinutes} />
        </div>

        <div className="panel">
          <div className="panel-head">
            <div className="panel-head-stack">
              <div className="panel-title">Activity</div>
              <div className="panel-sub">14-week heatmap</div>
            </div>
          </div>
          <ChartFrame fallbackHeight={140}>
            {(w) => <CalendarHeatmap width={w} data={[]} />}
          </ChartFrame>
        </div>
      </div>

      {barData.length > 0 && (
        <div className="panel">
          <div className="panel-head">
            <div className="panel-head-stack">
              <div className="panel-title">Daily categories</div>
              <div className="panel-sub">stacked by day</div>
            </div>
          </div>
          <ChartFrame>{(w) => <StackedBars width={w} height={210} data={barData} />}</ChartFrame>
        </div>
      )}

      <Phase5Tile title="Radial chart" note="Interactive sunburst — coming in Phase 5." />
    </>
  );
}
