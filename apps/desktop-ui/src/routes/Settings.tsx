import { useAuth } from '../auth/AuthProvider';
import { Phase5Tile } from '../components/primitives';

export function Settings() {
  const { user, logout } = useAuth();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div
        style={{
          padding: '16px 20px',
          borderRadius: 8,
          background: 'var(--surface)',
          border: '1px solid var(--line)',
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink)', marginBottom: 4 }}>
          Account
        </div>
        <div style={{ fontSize: 13, color: 'var(--ink-4)', marginBottom: 12 }}>
          {user?.email ?? '—'}
        </div>
        <button className="btn" data-variant="ghost" onClick={logout}>
          Sign out
        </button>
      </div>

      <Phase5Tile
        title="Budgets & alerts"
        note="Daily/weekly limits and silence windows — coming soon."
      />
    </div>
  );
}
