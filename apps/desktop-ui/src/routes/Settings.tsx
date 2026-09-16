import { useAuth } from '../auth/AuthProvider';
import { Phase5Tile } from '../components/primitives';
import { LogoutIcon } from '../shell/icons';

export function Settings() {
  const { user, logout } = useAuth();

  return (
    <>
      <div className="panel">
        <div className="panel-head">
          <div className="panel-head-stack">
            <div className="panel-title">Account</div>
            <div className="panel-sub">your profile and session</div>
          </div>
        </div>
        <div className="list">
          <div className="list-row">
            <div className="row-main">
              <div className="row-title">{user?.email ?? '—'}</div>
              <div className="row-sub">Email address</div>
            </div>
          </div>
        </div>
        <div style={{ marginTop: 16 }}>
          <button className="btn btn-ghost btn-danger" onClick={logout}>
            <LogoutIcon />
            Sign out
          </button>
        </div>
      </div>

      <Phase5Tile
        title="Budgets & alerts"
        note="Daily/weekly limits and silence windows — coming soon."
      />
    </>
  );
}
