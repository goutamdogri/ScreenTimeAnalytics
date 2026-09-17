import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { categoryColor } from '../lib/category-colors';
import { formatPercent } from '../lib/format';

export interface WidthHandle {
  ref: RefObject<HTMLDivElement | null>;
  width: number;
}

/** Brand glyph — the "signal" mark used in the sidebar and auth screens. */
export function SignalGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.4}
      strokeLinecap="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" />
      <path d="M6 6a8.5 8.5 0 0 0 0 12" />
      <path d="M18 6a8.5 8.5 0 0 1 0 12" />
      <path d="M8.6 8.6a5 5 0 0 0 0 6.8" />
      <path d="M15.4 8.6a5 5 0 0 1 0 6.8" />
    </svg>
  );
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
  tone,
}: {
  value: string;
  label: string;
  sub?: string;
  tone?: 'accent' | 'autopilot';
}) {
  return (
    <div className="stat-card panel" data-testid="stat-value">
      <div className="stat-label">{label}</div>
      <div className={`stat-value num${tone ? ` tone-${tone}` : ''}`}>{value}</div>
      {sub ? <div className="stat-sub">{sub}</div> : null}
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
  const rows = [
    { label: 'Focus', minutes: focus, color: 'var(--accent)' },
    { label: 'Autopilot', minutes: autopilot, color: 'var(--autopilot)' },
    { label: 'Neutral', minutes: neutral, color: 'var(--ink-4)' },
  ];
  return (
    <div data-testid="split-gauge">
      <div className="gauge-track">
        <div style={{ width: `${pct(focus)}%`, background: 'var(--accent)' }} />
        <div style={{ width: `${pct(autopilot)}%`, background: 'var(--autopilot)' }} />
        <div style={{ width: `${pct(neutral)}%`, background: 'var(--ink-4)' }} />
      </div>
      <div className="gauge-rows">
        {rows.map((row) => (
          <div key={row.label} className="gauge-row">
            <span className="dot" style={{ background: row.color }} />
            <span>{row.label}</span>
            <span className="gauge-pct">{formatPercent(pct(row.minutes) / 100)}</span>
            <span className="gauge-mins">{row.minutes}m</span>
          </div>
        ))}
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
        cursor: 'default',
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

export function Phase5Tile({
  title,
  note,
  onClick,
}: {
  title: string;
  note: string;
  onClick?: () => void;
}) {
  if (onClick) {
    return (
      <button
        type="button"
        className="phase5 clickable"
        onClick={onClick}
        data-testid="phase5-tile"
      >
        <div className="phase5-chip">Phase 5</div>
        <div className="phase5-title">{title}</div>
        <div className="phase5-note">{note}</div>
      </button>
    );
  }
  return (
    <div className="phase5" data-testid="phase5-tile">
      <div className="phase5-chip">Phase 5</div>
      <div className="phase5-title">{title}</div>
      <div className="phase5-note">{note}</div>
    </div>
  );
}
