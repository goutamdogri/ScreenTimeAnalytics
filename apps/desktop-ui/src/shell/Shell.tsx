import { useAuth } from '../auth/AuthProvider';

const NAV_ITEMS = [
  { key: 'overview', label: 'Overview' },
  { key: 'trends', label: 'Trends' },
  { key: 'sessions', label: 'Sessions' },
  { key: 'categories', label: 'Categories' },
  { key: 'devices', label: 'Devices' },
  { key: 'settings', label: 'Settings' },
] as const;

export type ViewKey = (typeof NAV_ITEMS)[number]['key'];

export function Shell({
  view,
  onNavigate,
  children,
}: {
  view: ViewKey;
  onNavigate: (key: ViewKey) => void;
  children: React.ReactNode;
}) {
  const { user, logout } = useAuth();
  const toggleTheme = () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    localStorage.setItem('screen-time-theme', next);
  };

  return (
    <div className="app-shell">
      <nav className="sidebar" aria-label="Primary">
        <div style={{ marginBottom: 24, fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>
          Screen Time
        </div>
        {NAV_ITEMS.map((item) => (
          <button
            key={item.key}
            className="nav-item"
            data-active={view === item.key ? '' : undefined}
            onClick={() => onNavigate(item.key)}
          >
            {item.label}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <button className="nav-item" onClick={toggleTheme}>
          Theme
        </button>
        <button className="nav-item" onClick={logout}>
          Sign out
        </button>
        {user ? (
          <div style={{ fontSize: 11, color: 'var(--ink-4)', marginTop: 8, textAlign: 'center' }}>
            {user.email}
          </div>
        ) : null}
      </nav>
      <main className="main-content">{children}</main>
    </div>
  );
}
