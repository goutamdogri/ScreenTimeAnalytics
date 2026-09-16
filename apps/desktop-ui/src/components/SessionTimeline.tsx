import { formatClock } from '../lib/format';
import { categoryColor } from '../lib/category-colors';
import type { components } from '@screen-time/api-contract';

type SessionDto = components['schemas']['SessionDto'];

export function SessionTimeline({ sessions }: { sessions: SessionDto[] }) {
  if (sessions.length === 0) return null;

  const maxDuration = Math.max(...sessions.map((s) => s.durationMin));

  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
      data-testid="session-timeline"
    >
      {sessions.map((s, i) => {
        const pct = (s.durationMin / maxDuration) * 100;
        return (
          <div
            key={i}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '8px 12px',
              borderRadius: 6,
              background: 'var(--surface)',
              border: '1px solid var(--line)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                minWidth: 64,
                fontSize: 12,
                color: 'var(--ink-4)',
                fontFamily: 'var(--font-num)',
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 2,
                  background: categoryColor(s.category),
                  display: 'inline-block',
                  flexShrink: 0,
                }}
              />
              <span>{formatClock(s.startedAt)}</span>
            </div>
            <div style={{ flex: 1 }}>
              <div
                style={{
                  height: 4,
                  borderRadius: 2,
                  background: 'var(--surface-2)',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${pct}%`,
                    borderRadius: 2,
                    background: categoryColor(s.category),
                  }}
                />
              </div>
            </div>
            <div
              style={{
                minWidth: 36,
                textAlign: 'right',
                fontSize: 12,
                color: 'var(--ink)',
                fontFamily: 'var(--font-num)',
              }}
            >
              {s.durationMin}m
            </div>
          </div>
        );
      })}
    </div>
  );
}
