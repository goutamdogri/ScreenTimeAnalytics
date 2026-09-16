import { formatClock } from '../lib/format';
import { categoryColor, categoryLabel } from '../lib/category-colors';
import type { components } from '@screen-time/api-contract';

type SessionDto = components['schemas']['SessionDto'];

function sessionTitle(s: SessionDto): string {
  const text = typeof s.windowTitle === 'string' ? s.windowTitle : '';
  return text || String(s.app ?? '');
}

export function SessionTimeline({ sessions }: { sessions: SessionDto[] }) {
  if (sessions.length === 0) return null;

  const maxDuration = Math.max(...sessions.map((s) => s.durationMin));

  return (
    <div className="sess-list" data-testid="session-timeline">
      {sessions.map((s, i) => {
        const pct = maxDuration > 0 ? (s.durationMin / maxDuration) * 100 : 0;
        return (
          <div key={i} className="sess-row">
            <div className="sess-time">{formatClock(s.startedAt)}</div>
            <div className="sess-dot" style={{ background: categoryColor(s.category) }} />
            <div className="sess-main">
              <div className="row-title" title={sessionTitle(s)}>
                {sessionTitle(s)}
              </div>
              <div className="row-sub">{categoryLabel(s.category)}</div>
            </div>
            <div className="sess-bar">
              <div style={{ width: `${pct}%`, background: categoryColor(s.category) }} />
            </div>
            <div className="sess-dur">{s.durationMin}m</div>
          </div>
        );
      })}
    </div>
  );
}
