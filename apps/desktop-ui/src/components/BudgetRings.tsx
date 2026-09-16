import { categoryColor, categoryLabel } from '../lib/category-colors';
import { formatPercent } from '../lib/format';

export interface BudgetItem {
  category: string;
  minutes: number;
  share: number;
}

export function BudgetRings({
  data,
  size = 200,
  total,
}: {
  data: BudgetItem[];
  size?: number;
  total: number;
}) {
  const r = 64;
  const circumference = 2 * Math.PI * r;
  const strokeWidth = 13;
  const gap = 6;
  let offset = 0;

  const sorted = [...data].sort((a, b) => b.minutes - a.minutes);

  return (
    <div className="gauge-wrap" style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
      <svg
        width={size}
        height={size}
        role="img"
        aria-label="Category breakdown"
        data-testid="budget-rings"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--surface-2)"
          strokeWidth={strokeWidth}
        />
        {sorted.map((item) => {
          const arc = Math.max(0, circumference * item.share - gap);
          const stroke = categoryColor(item.category);
          const path = (
            <circle
              key={item.category}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={stroke}
              strokeWidth={strokeWidth}
              strokeDasharray={`${arc.toFixed(1)} ${circumference.toFixed(1)}`}
              strokeDashoffset={(-(offset + gap / 2)).toFixed(1)}
              strokeLinecap="round"
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
            >
              <title>{`${categoryLabel(item.category)}: ${item.minutes}m (${Math.round(item.share * 100)}%)`}</title>
            </circle>
          );
          offset += circumference * item.share;
          return path;
        })}
        <text
          x={size / 2}
          y={size / 2 - 2}
          textAnchor="middle"
          fill="var(--ink)"
          style={{
            fontSize: 20,
            fontWeight: 550,
            fontFamily: 'var(--font-num)',
            fontVariantNumeric: 'tabular-nums',
          }}
          data-testid="ring-total"
        >
          {total}m
        </text>
        <text
          x={size / 2}
          y={size / 2 + 14}
          textAnchor="middle"
          fill="var(--ink-4)"
          style={{ fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase' }}
        >
          total
        </text>
      </svg>
      <div className="gauge-rows" style={{ marginTop: 0, flex: 1, minWidth: 0 }}>
        {sorted.map((item) => (
          <div key={item.category} className="gauge-row">
            <span className="dot" style={{ background: categoryColor(item.category) }} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {categoryLabel(item.category)}
            </span>
            <span className="gauge-pct">{formatPercent(item.share)}</span>
            <span className="gauge-mins">{item.minutes}m</span>
          </div>
        ))}
      </div>
    </div>
  );
}
