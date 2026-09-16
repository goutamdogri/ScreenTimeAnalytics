import { categoryColor, categoryLabel } from '../lib/category-colors';

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
  const r = 70;
  const circumference = 2 * Math.PI * r;
  const strokeWidth = 16;
  let offset = 0;

  const sorted = [...data].sort((a, b) => b.minutes - a.minutes);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
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
          opacity={0.3}
        />
        {sorted.map((item) => {
          const share = circumference * item.share;
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
              strokeDasharray={`${share.toFixed(1)} ${circumference}`}
              strokeDashoffset={(-offset).toFixed(1)}
              strokeLinecap="butt"
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
            >
              <title>{`${categoryLabel(item.category)}: ${item.minutes}m (${Math.round(item.share * 100)}%)`}</title>
            </circle>
          );
          offset += share;
          return path;
        })}
        <text
          x={size / 2}
          y={size / 2 - 6}
          textAnchor="middle"
          fill="var(--ink)"
          style={{ fontSize: 24, fontWeight: 500, fontFamily: 'var(--font-num)' }}
          data-testid="ring-total"
        >
          {total}m
        </text>
        <text
          x={size / 2}
          y={size / 2 + 12}
          textAnchor="middle"
          fill="var(--ink-4)"
          style={{ fontSize: 10, fontFamily: 'var(--font-body)' }}
        >
          total
        </text>
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {sorted.map((item) => (
          <div
            key={item.category}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 12,
              color: 'var(--ink)',
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: 2,
                background: categoryColor(item.category),
                display: 'inline-block',
              }}
            />
            <span>{categoryLabel(item.category)}</span>
            <span className="num" style={{ color: 'var(--ink-4)' }}>
              {item.minutes}m
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
