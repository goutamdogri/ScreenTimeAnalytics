import { useMemo, useState, type CSSProperties } from 'react';
import { categoryColor, categoryLabel } from '../lib/category-colors';

interface Point {
  x: number;
  y: number;
}

function catmullRom2Bezier(pts: Point[]): string {
  const d: string[] = [];
  for (let i = 0; i < pts.length; i++) {
    const p0 = pts[i - 1] ?? pts[i]!;
    const p1 = pts[i]!;
    const p2 = pts[i + 1] ?? p1;
    const p3 = pts[i + 2] ?? p2;
    if (i === 0) {
      d.push(`M ${p1.x.toFixed(1)} ${p1.y.toFixed(1)}`);
    }
    d.push(
      `C ${(p1.x + (p2.x - p0.x) / 6).toFixed(1)} ${(p1.y + (p2.y - p0.y) / 6).toFixed(1)}, ` +
        `${(p2.x - (p3.x - p1.x) / 6).toFixed(1)} ${(p2.y - (p3.y - p1.y) / 6).toFixed(1)}, ` +
        `${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`,
    );
  }
  return d.join(' ');
}

function niceCeil(v: number, step: number): number {
  return Math.max(step, Math.ceil(v / step) * step);
}

const FONT_STYLE: CSSProperties = { fontSize: 10, fontFamily: 'var(--font-num)' };

export function TrendArea({
  width,
  height = 200,
  data,
  color = 'var(--accent)',
}: {
  width: number;
  height?: number;
  data: { date: string; totalMinutes: number }[];
  color?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const pad = { l: 46, r: 10, t: 10, b: 22 };

  const layout = useMemo(() => {
    const innerW = Math.max(0, width - pad.l - pad.r);
    const innerH = height - pad.t - pad.b;
    const max = Math.max(1, niceCeil(Math.max(...data.map((d) => d.totalMinutes)), 60));
    const n = data.length;
    const pts: Point[] = data.map((d, i) => ({
      x: pad.l + (n === 1 ? innerW / 2 : (i / (n - 1)) * innerW),
      y: pad.t + innerH * (1 - d.totalMinutes / max),
    }));
    const line = catmullRom2Bezier(pts);
    const area =
      pts.length > 0
        ? `${line} L ${pts[pts.length - 1]!.x.toFixed(1)} ${(pad.t + innerH).toFixed(1)} L ${pts[0]!.x.toFixed(1)} ${(pad.t + innerH).toFixed(1)} Z`
        : '';
    return { innerW, innerH, max, pts, line, area };
  }, [data, width, height, pad.l, pad.r, pad.t, pad.b]);

  if (data.length === 0) {
    return <svg width={width} height={height} role="img" data-testid="trend-area" />;
  }

  const gridValues = [0.25, 0.5, 0.75, 1];
  const xTicks = data.reduce<number[]>(
    (acc, _, i) => (i % Math.max(1, Math.ceil(data.length / 6)) === 0 ? [...acc, i] : acc),
    [],
  );

  return (
    <svg
      width={width}
      height={height}
      role="img"
      aria-label="Total screen time trend"
      data-testid="trend-area"
      onMouseMove={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const idx = layout.pts.reduce(
          (best, p, i) => (Math.abs(p.x - x) < Math.abs(layout.pts[best]!.x - x) ? i : best),
          0,
        );
        setHover(idx);
      }}
      onMouseLeave={() => setHover(null)}
    >
      <defs>
        <linearGradient id="trend-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.16" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>

      {gridValues.map((g) => {
        const y = pad.t + layout.innerH * (1 - g);
        return (
          <g key={g}>
            <line
              x1={pad.l}
              x2={width - pad.r}
              y1={y}
              y2={y}
              stroke="var(--line)"
              strokeWidth={1}
            />
            <text x={pad.l - 8} y={y + 3} textAnchor="end" fill="var(--ink-4)" style={FONT_STYLE}>
              {Math.round(layout.max * g)}m
            </text>
          </g>
        );
      })}

      {xTicks.map((i) => {
        const x = layout.pts[i]!.x;
        return (
          <text
            key={i}
            x={x}
            y={height - 6}
            textAnchor="middle"
            fill="var(--ink-4)"
            style={FONT_STYLE}
          >
            {formatDateLabel(data[i]!.date)}
          </text>
        );
      })}

      {layout.area ? <path d={layout.area} fill="url(#trend-fill)" stroke="none" /> : null}
      <path
        d={layout.line}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      {hover !== null && data[hover] ? (
        <g>
          <line
            x1={layout.pts[hover]!.x}
            x2={layout.pts[hover]!.x}
            y1={pad.t}
            y2={pad.t + layout.innerH}
            stroke="var(--line-strong)"
            strokeWidth={1}
            strokeDasharray="3 3"
          />
          <circle
            cx={layout.pts[hover]!.x}
            cy={layout.pts[hover]!.y}
            r={4}
            fill={color}
            stroke="var(--bg)"
            strokeWidth={2}
          />
          <g
            transform={`translate(${layout.pts[hover]!.x}, ${Math.max(pad.t, layout.pts[hover]!.y - 26)})`}
          >
            <rect
              x={-34}
              y={-18}
              width={68}
              height={20}
              rx={4}
              fill="var(--surface)"
              stroke="var(--line)"
            />
            <text x={0} y={-3} textAnchor="middle" fill="var(--ink)" style={FONT_STYLE}>
              {data[hover]!.totalMinutes}m
            </text>
          </g>
        </g>
      ) : null}
    </svg>
  );
}

export interface StackedBarDatum {
  date: string;
  totalMinutes: number;
  byCategory: { category: string; minutes: number }[];
}

export function StackedBars({
  width,
  height = 200,
  data,
}: {
  width: number;
  height?: number;
  data: StackedBarDatum[];
}) {
  const pad = { l: 46, r: 10, t: 10, b: 22 };

  const layout = useMemo(() => {
    const innerW = Math.max(0, width - pad.l - pad.r);
    const innerH = height - pad.t - pad.b;
    const max = Math.max(1, niceCeil(Math.max(...data.map((d) => d.totalMinutes)), 60));
    const n = data.length;
    const barW = (innerW / Math.max(1, n)) * 0.6;
    return { innerW, innerH, max, n, barW };
  }, [data, width, height]);

  if (data.length === 0) {
    return <svg width={width} height={height} role="img" data-testid="stacked-bars" />;
  }

  const gridValues = [0.25, 0.5, 0.75, 1];
  const xTicks = data.reduce<number[]>(
    (acc, _, i) => (i % Math.max(1, Math.ceil(data.length / 6)) === 0 ? [...acc, i] : acc),
    [],
  );

  return (
    <svg
      width={width}
      height={height}
      role="img"
      aria-label="Screen time by category"
      data-testid="stacked-bars"
    >
      {gridValues.map((g) => {
        const y = pad.t + layout.innerH * (1 - g);
        return (
          <g key={g}>
            <line
              x1={pad.l}
              x2={width - pad.r}
              y1={y}
              y2={y}
              stroke="var(--line)"
              strokeWidth={1}
            />
            <text x={pad.l - 8} y={y + 3} textAnchor="end" fill="var(--ink-4)" style={FONT_STYLE}>
              {Math.round(layout.max * g)}m
            </text>
          </g>
        );
      })}

      {xTicks.map((i) => {
        const x = pad.l + (i + 0.5) * (layout.innerW / data.length);
        return (
          <text
            key={i}
            x={x}
            y={height - 6}
            textAnchor="middle"
            fill="var(--ink-4)"
            style={FONT_STYLE}
          >
            {formatDateLabel(data[i]!.date)}
          </text>
        );
      })}

      {data.map((day, i) => {
        const slotW = layout.innerW / data.length;
        const x = pad.l + i * slotW + slotW / 2 - layout.barW / 2;
        let yCursor = pad.t + layout.innerH;
        return (
          <g key={day.date}>
            {day.byCategory.map((seg) => {
              const h = (seg.minutes / layout.max) * layout.innerH;
              yCursor -= h;
              const rect = (
                <rect
                  key={seg.category}
                  x={x}
                  y={yCursor}
                  width={layout.barW}
                  height={Math.max(0, h)}
                  fill={categoryColor(seg.category)}
                  opacity={0.92}
                  rx={1.5}
                >
                  <title>{`${formatDateLabel(day.date)} · ${categoryLabel(seg.category)} · ${seg.minutes}m`}</title>
                </rect>
              );
              return rect;
            })}
          </g>
        );
      })}
    </svg>
  );
}

function formatDateLabel(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  if (!y || !m || !d) return date;
  return new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' }).format(
    new Date(Date.UTC(y, m - 1, d)),
  );
}
