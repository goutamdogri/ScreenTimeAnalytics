import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
  type CSSProperties,
} from 'react';
import { categoryColor } from '../lib/category-colors';

export interface WidthHandle {
  ref: RefObject<HTMLDivElement | null>;
  width: number;
}

/**
 * Measures a container with ResizeObserver so SVG charts can size to it.
 * Falls back to a fixed width when ResizeObserver is unavailable (jsdom).
 */
export function useContainerWidth(): WidthHandle {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof ResizeObserver === 'undefined') {
      setWidth(720);
      return;
    }
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w) setWidth(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return { ref, width };
}

export function ChartFrame({
  children,
  className = '',
  fallbackHeight = 220,
}: {
  children: (width: number) => ReactNode;
  className?: string;
  fallbackHeight?: number;
}) {
  const { ref, width } = useContainerWidth();
  return (
    <div ref={ref} className={`chart-frame ${className}`} style={{ width: '100%' }}>
      {width > 0 ? (
        children(width)
      ) : (
        <div className="skeleton" style={{ height: fallbackHeight, width: '100%' }} />
      )}
    </div>
  );
}

export function MetricStat({
  value,
  label,
  sub,
  variant = 'accent',
  size = 'lg',
}: {
  value: string;
  label: string;
  sub?: string;
  variant?: 'accent' | 'autopilot' | 'plain';
  size?: 'lg' | 'md';
}) {
  const style: CSSProperties | undefined =
    variant === 'accent'
      ? { color: 'var(--accent)' }
      : variant === 'autopilot'
        ? { color: 'var(--autopilot)' }
        : undefined;
  return (
    <div>
      <div
        className={`stat-value ${size === 'md' ? 'small' : ''} num`}
        style={style}
        data-testid="stat-value"
      >
        {value}
      </div>
      <div className="stat-label">{label}</div>
      {sub ? (
        <div className="stat-delta" style={{ color: 'var(--ink-4)' }}>
          {sub}
        </div>
      ) : null}
    </div>
  );
}

export function SplitGauge({
  focus,
  autopilot,
  neutral,
  total,
}: {
  focus: number;
  autopilot: number;
  neutral: number;
  total: number;
}) {
  const pct = (v: number) => (total > 0 ? (v / total) * 100 : 0);
  return (
    <div data-testid="split-gauge">
      <div
        className="split-track"
        style={{
          height: 12,
          display: 'flex',
          overflow: 'hidden',
          borderRadius: 999,
          background: 'var(--surface-2)',
          border: '1px solid var(--line)',
        }}
      >
        <div style={{ width: `${pct(focus)}%`, background: 'var(--accent)' }} />
        <div style={{ width: `${pct(autopilot)}%`, background: 'var(--autopilot)' }} />
        <div style={{ width: `${pct(neutral)}%`, background: 'var(--ink-4)' }} />
      </div>
    </div>
  );
}

export function LegendDot({ category }: { category: string }) {
  return (
    <span
      className="chip"
      style={{
        borderColor: 'transparent',
        background: 'color-mix(in srgb, var(--surface-2) 70%, transparent)',
      }}
      data-testid="legend-dot"
    >
      <span className="chip-dot" style={{ background: categoryColor(category) }} />
      {category}
    </span>
  );
}

export function Skeleton({
  height = 12,
  width = '100%',
}: {
  height?: number;
  width?: string | number;
}) {
  return <div className="skeleton" style={{ height, width }} />;
}

export function EmptyState({
  title,
  note,
  glyph = '—',
  children,
}: {
  title: string;
  note: string;
  glyph?: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty" data-testid="empty-state">
      <div className="empty-glyph">{glyph}</div>
      <div className="empty-title">{title}</div>
      <div className="empty-note">{note}</div>
      {children}
    </div>
  );
}

export function Phase5Tile({ title, note }: { title: string; note: string }) {
  return (
    <div className="phase5" data-testid="phase5-tile">
      <div className="phase5-chip">Phase 5</div>
      <div className="phase5-title">{title}</div>
      <div className="phase5-note">{note}</div>
    </div>
  );
}
