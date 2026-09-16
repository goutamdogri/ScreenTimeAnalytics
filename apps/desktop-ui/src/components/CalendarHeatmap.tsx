import { useMemo } from 'react';

export interface HeatmapCell {
  date: string;
  totalMinutes: number;
}

export function CalendarHeatmap({
  width,
  height = 140,
  data,
}: {
  width: number;
  height?: number;
  data: HeatmapCell[];
}) {
  const layout = useMemo(() => {
    const dataMap = new Map(data.map((d) => [d.date, d.totalMinutes]));
    const today = new Date();
    const start = new Date(today);
    start.setDate(start.getDate() - 13 * 7);

    const days: { date: string; totalMinutes: number }[] = [];
    const cur = new Date(start);
    while (cur <= today) {
      const iso = cur.toISOString().slice(0, 10);
      days.push({ date: iso, totalMinutes: dataMap.get(iso) ?? 0 });
      cur.setDate(cur.getDate() + 1);
    }

    const max = Math.max(1, ...days.map((d) => d.totalMinutes));
    const cellSize = 14;
    const gap = 3;
    const nWeeks = Math.ceil(days.length / 7);

    return { days, max, cellSize, gap, nWeeks };
  }, [data]);

  const monthLabels = useMemo(() => {
    const labels: { x: number; label: string }[] = [];
    let lastMonth = -1;
    layout.days.forEach((d, i) => {
      const m = Number(d.date.slice(5, 7)) - 1;
      if (m !== lastMonth) {
        labels.push({
          x: layout.gap + (i / 7) * (layout.cellSize + layout.gap),
          label: new Intl.DateTimeFormat(undefined, { month: 'short' }).format(
            new Date(Date.UTC(2026, m, 1)),
          ),
        });
        lastMonth = m;
      }
    });
    return labels;
  }, [layout]);

  return (
    <svg
      width={width}
      height={height}
      role="img"
      aria-label="Screen time heatmap"
      data-testid="heatmap"
    >
      {monthLabels.map((ml) => (
        <text
          key={ml.label}
          x={ml.x}
          y={10}
          fill="var(--ink-4)"
          style={{ fontSize: 10, fontFamily: 'var(--font-num)' }}
        >
          {ml.label}
        </text>
      ))}

      {layout.days.map((d, i) => {
        const col = Math.floor(i / 7);
        const row = i % 7;
        const x = col * (layout.cellSize + layout.gap);
        const y = 20 + row * (layout.cellSize + layout.gap);
        const intensity = layout.max > 0 ? d.totalMinutes / layout.max : 0;
        const fill =
          d.totalMinutes > 0
            ? `color-mix(in srgb, var(--accent) ${Math.round(18 + 82 * intensity)}%, var(--surface-2))`
            : 'var(--surface-2)';

        return (
          <g key={d.date}>
            <rect
              x={x}
              y={y}
              width={layout.cellSize}
              height={layout.cellSize}
              rx={3}
              fill={fill}
              stroke="var(--line)"
              strokeWidth={1}
            >
              <title>{`${d.date}: ${d.totalMinutes}m`}</title>
            </rect>
          </g>
        );
      })}
    </svg>
  );
}
