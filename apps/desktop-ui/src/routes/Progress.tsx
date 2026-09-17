import { useEffect, useState } from 'react';
import type { components } from '@screen-time/api-contract';
import { client } from '../api/client';
import { formatMinutes } from '../lib/format';
import { ChartFrame, Skeleton, EmptyState } from '../components/primitives';

type GamificationState = components['schemas']['GamificationStateResponse'];
type GamificationQuests = components['schemas']['GamificationQuestsResponse'];
type GamificationAchievements = components['schemas']['GamificationAchievementsResponse'];
type GamificationLeaderboard = components['schemas']['GamificationLeaderboardResponse'];

const AXES = [
  { key: 'focus', label: 'Focus', color: 'var(--accent)' },
  { key: 'wisdom', label: 'Wisdom', color: 'var(--ink)' },
  { key: 'restraint', label: 'Restraint', color: 'var(--accent)' },
  { key: 'discipline', label: 'Discipline', color: 'var(--ink)' },
] as const;

function LevelHeader({ state }: { state: GamificationState }) {
  return (
    <div className="panel level-head">
      <div className="level-badge">
        <div className="level-badge-num">{state.level}</div>
        <div className="level-badge-label">LEVEL</div>
      </div>
      <div className="level-xp">
        <div className="level-xp-row">
          <span className="level-xp-value num">
            {state.inLevel}
            <span className="slash"> / {state.forNextLevel} XP</span>
          </span>
          <span className="chip level-xp-pct">{Math.round(state.progress * 100)}%</span>
        </div>
        <div className="gauge-track level-bar">
          <div
            className="level-bar-fill"
            style={{ width: `${Math.max(2, Math.round(state.progress * 100))}%` }}
          />
        </div>
        <div className="level-meta">
          <span>
            <strong>{state.streakDays}</strong> day streak
          </span>
          <span className="meta-sep">·</span>
          <span>
            <strong>{state.coins}</strong> focus coins
          </span>
          <span className="meta-sep">·</span>
          <span>
            <strong>{state.xp}</strong> total XP
          </span>
        </div>
      </div>
    </div>
  );
}

function RadarChart({ state }: { state: GamificationState }) {
  const values = [
    state.stats.focus,
    state.stats.wisdom,
    state.stats.restraint,
    state.stats.discipline,
  ];
  const max = Math.max(1, ...values);
  const norm = values.map((v) => Math.min(1, v / max));
  return (
    <ChartFrame fallbackHeight={230}>
      {(width) => (
        <svg
          viewBox="0 0 240 240"
          width={width}
          height={230}
          role="img"
          aria-label="Character stats radar"
        >
          {circlePoints(3).map((ring) => (
            <polygon
              key={ring.join(',')}
              points={ring
                .map((r, vi) => point(120, 120, 86 * r, vi))
                .map((p) => `${p.x},${p.y}`)
                .join(' ')}
              fill="none"
              stroke="var(--line)"
              strokeWidth={1}
            />
          ))}
          {[0, 1, 2, 3].map((vi) => {
            const { x, y } = point(120, 120, 86, vi);
            return (
              <line key={vi} x1={120} y1={120} x2={x} y2={y} stroke="var(--line)" strokeWidth={1} />
            );
          })}
          <polygon
            points={norm
              .map((r, vi) => point(120, 120, 86 * r, vi))
              .map((p) => `${p.x},${p.y}`)
              .join(' ')}
            fill="var(--accent-dim)"
            stroke="var(--accent)"
            strokeWidth={2}
            strokeLinejoin="round"
          />
          {norm.map((r, vi) => {
            const { x, y } = point(120, 120, 86 * r, vi);
            return <circle key={vi} cx={x} cy={y} r={3} fill="var(--accent)" />;
          })}
          {AXES.map((axis, vi) => {
            const { x, y } = point(120, 120, 102, vi);
            return (
              <text
                key={axis.key}
                x={x}
                y={y}
                textAnchor="middle"
                dominantBaseline="middle"
                className="radar-label"
              >
                {axis.label}
                <tspan x={x} dy={14} className="radar-value">
                  {formatAxisValue(axis.key, values[vi] ?? 0)}
                </tspan>
              </text>
            );
          })}
        </svg>
      )}
    </ChartFrame>
  );
}

function point(cx: number, cy: number, radius: number, vertex: number): { x: number; y: number } {
  // vertex 0 = top, clockwise; 4 axes at 90° apart.
  const angle = (Math.PI / 2) * vertex - Math.PI / 2;
  return { x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) };
}

function circlePoints(rings: number): number[][] {
  const counts: number[][] = [];
  for (let i = 1; i <= rings; i += 1) {
    counts.push([i / rings, i / rings, i / rings, i / rings]);
  }
  return counts;
}

function formatAxisValue(key: string, value: number): string {
  if (key === 'discipline' || key === 'restraint') return `${value} pts`;
  return formatMinutes(value);
}

function QuestList({ quests }: { quests: GamificationQuests }) {
  return (
    <div className="quest-list">
      {quests.dailyQuests.map((quest) => {
        const pct = quest.target > 0 ? Math.min(100, (quest.progress / quest.target) * 100) : 0;
        const done = quest.completed || pct >= 100;
        return (
          <div
            key={quest.key}
            className={`quest-row${done ? ' done' : ''}`}
            data-testid="quest-row"
          >
            <div className="quest-top">
              <span className="quest-title">
                {done ? '✓' : ''} {quest.title}
              </span>
              <span className="quest-xp">+{quest.rewardXp} XP</span>
            </div>
            <div className="quest-desc">{quest.description}</div>
            <div className="quest-track">
              <div className="gauge-track">
                <div className="quest-fill" style={{ width: `${Math.max(1.2, pct)}%` }} />
              </div>
              <span className="quest-progress num">
                {quest.target > 0 ? `${quest.progress} / ${quest.target}` : '—'}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function BossBar({ boss }: { boss: GamificationQuests['weeklyBoss'] }) {
  const hpPct = Math.max(0, Math.min(100, boss.hp));
  const label = boss.defeated ? 'Defeated' : `${hpPct}% HP remaining`;
  return (
    <div className="boss" data-testid="boss-bar">
      <div className="boss-head">
        <span className="boss-title">{boss.title}</span>
        <span className="chip">{label}</span>
      </div>
      <div className="boss-desc">{boss.description}</div>
      <div className="gauge-track boss-track">
        <div
          className={boss.defeated ? 'boss-fill defeated' : 'boss-fill'}
          style={{ width: `${100 - hpPct}%` }}
        />
      </div>
      <div className="boss-meta">
        <span className="num">{boss.focusMinutes}</span> / {boss.target} min focus
        <span className="meta-sep">·</span>
        <span>
          reward <strong>+{boss.rewardXp} XP</strong>
        </span>
      </div>
    </div>
  );
}

function AchievementGrid({
  achievements,
}: {
  achievements: GamificationAchievements['achievements'];
}) {
  if (achievements.length === 0) {
    return (
      <EmptyState
        title="No badges yet"
        note="Complete your first 20-minute deep work block to earn one."
      />
    );
  }
  return (
    <div className="achievement-grid" data-testid="achievement-grid">
      {achievements.map((a) => (
        <div key={a.key} className="badge" title={a.description}>
          <div className="badge-glyph">★</div>
          <div className="badge-title">{a.title}</div>
          <div className="badge-date">{new Date(a.unlockedAt).toLocaleDateString()}</div>
        </div>
      ))}
    </div>
  );
}

function PersonalBests({ leaderboard }: { leaderboard: GamificationLeaderboard }) {
  const rows = [
    {
      label: 'Weekly best',
      sub: 'most deep work in a single week',
      entry: leaderboard.weeklyBest,
    },
    {
      label: 'Monthly best',
      sub: 'most deep work in a single month',
      entry: leaderboard.monthlyBest,
    },
  ];
  return (
    <div className="best-grid">
      {rows.map((row) => (
        <div key={row.label} className="best-card">
          <div className="best-label">{row.label}</div>
          {row.entry ? (
            <>
              <div className="best-value num">{formatMinutes(row.entry.focusMinutes)}</div>
              <div className="best-sub">
                {new Date(`${row.entry.date}T00:00:00Z`).toDateString()}
              </div>
            </>
          ) : (
            <div className="best-value num dim">—</div>
          )}
          <div className="best-hint">{row.sub}</div>
        </div>
      ))}
    </div>
  );
}

export function Progress() {
  const [state, setState] = useState<GamificationState | null>(null);
  const [quests, setQuests] = useState<GamificationQuests | null>(null);
  const [achievements, setAchievements] = useState<GamificationAchievements | null>(null);
  const [leaderboard, setLeaderboard] = useState<GamificationLeaderboard | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      const [s, q, a, l] = await Promise.all([
        client.GET('/gamification/state'),
        client.GET('/gamification/quests'),
        client.GET('/gamification/achievements'),
        client.GET('/gamification/leaderboard'),
      ]);
      if (s.response.ok && s.data) setState(s.data);
      if (q.response.ok && q.data) setQuests(q.data);
      if (a.response.ok && a.data) setAchievements(a.data);
      if (l.response.ok && l.data) setLeaderboard(l.data);
      setLoading(false);
    })();
  }, []);

  if (loading) return <Skeleton height={320} />;
  if (!state)
    return (
      <EmptyState title="No progress yet" note="Sessions will start earning XP as you work." />
    );

  return (
    <>
      <LevelHeader state={state} />

      <div className="grid grid-2-eq">
        <div className="panel">
          <div className="panel-head">
            <div className="panel-head-stack">
              <div className="panel-title">Character stats</div>
              <div className="panel-sub">focus · wisdom · discipline · restraint</div>
            </div>
          </div>
          <RadarChart state={state} />
        </div>

        <div className="panel">
          <div className="panel-head">
            <div className="panel-head-stack">
              <div className="panel-title">Weekly boss</div>
              <div className="panel-sub">vs. your past self</div>
            </div>
          </div>
          {quests ? <BossBar boss={quests.weeklyBoss} /> : <Skeleton height={120} />}
          <div className="best-wrap">
            {leaderboard ? <PersonalBests leaderboard={leaderboard} /> : <Skeleton height={96} />}
          </div>
        </div>
      </div>

      <div className="grid grid-2-eq">
        <div className="panel">
          <div className="panel-head">
            <div className="panel-head-stack">
              <div className="panel-title">Today's quests</div>
              <div className="panel-sub">
                {quests ? `generated from your habits · ${quests.date}` : ''}
              </div>
            </div>
          </div>
          {quests ? <QuestList quests={quests} /> : <Skeleton height={140} />}
        </div>

        <div className="panel">
          <div className="panel-head">
            <div className="panel-head-stack">
              <div className="panel-title">Achievements</div>
              <div className="panel-sub">
                {achievements ? `${achievements.achievements.length} unlocked` : ''}
              </div>
            </div>
          </div>
          {achievements ? (
            <AchievementGrid achievements={achievements.achievements} />
          ) : (
            <Skeleton height={140} />
          )}
        </div>
      </div>
    </>
  );
}
