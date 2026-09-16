import { useAuth } from '../auth/AuthProvider';
import { SignalGlyph } from '../components/primitives';
import {
  OverviewIcon,
  TrendsIcon,
  SessionsIcon,
  CategoriesIcon,
  DevicesIcon,
  SettingsIcon,
  SunIcon,
  MoonIcon,
  LogoutIcon,
} from './icons';

const NAV_ITEMS = [
  { key: 'overview', label: 'Overview' },
  { key: 'trends', label: 'Trends' },
  { key: 'sessions', label: 'Sessions' },
  { key: 'categories', label: 'Categories' },
  { key: 'devices', label: 'Devices' },
  { key: 'settings', label: 'Settings' },
] as const;

export type ViewKey = (typeof NAV_ITEMS)[number]['key'];

const NAV_ICONS: Record<ViewKey, React.ComponentType> = {
  overview: OverviewIcon,
  trends: TrendsIcon,
  sessions: SessionsIcon,
  categories: CategoriesIcon,
  devices: DevicesIcon,
  settings: SettingsIcon,
};

function todayLabel(): string {
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(new Date());
}

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
  const isDark = document.documentElement.dataset.theme !== 'light';
  const toggleTheme = () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    localStorage.setItem('screen-time-theme', next);
  };

  const active = NAV_ITEMS.find((i) => i.key === view);

  return (
    <div className="app-shell" data-testid="shell">
      <nav className="sidebar" aria-label="Primary">
        <div className="brand">
          <div className="brand-mark">
            <SignalGlyph />
          </div>
          <div>
            <div className="brand-name">Screen Time</div>
            <div className="brand-sub">analytics</div>
          </div>
        </div>

        <div className="nav-label">Workspace</div>
        {NAV_ITEMS.map((item) => {
          const NavIcon = NAV_ICONS[item.key];
          return (
            <button
              key={item.key}
              className={`nav-item${view === item.key ? ' active' : ''}`}
              data-active={view === item.key ? '' : undefined}
              aria-current={view === item.key ? 'page' : undefined}
              onClick={() => onNavigate(item.key)}
            >
              <span className="nav-icon">
                <NavIcon />
              </span>
              <span>{item.label}</span>
            </button>
          );
        })}

        <div className="sidebar-foot">
          <div className="user-chip" title={user?.email}>
            <div className="user-avatar">{user?.email?.slice(0, 2).toUpperCase() ?? '—'}</div>
            <div className="user-meta">
              <div className="user-email">{user?.email}</div>
              <div className="user-plan">Personal</div>
            </div>
          </div>
        </div>
      </nav>

      <main className="main-pane">
        <header className="topbar">
          <div className="topbar-title">{active?.label}</div>
          <div className="topbar-right">
            <span className="topbar-date">{todayLabel()}</span>
            <button
              className="icon-btn"
              onClick={toggleTheme}
              aria-label="Toggle theme"
              title="Toggle theme"
            >
              {isDark ? <SunIcon /> : <MoonIcon />}
            </button>
            <button className="icon-btn" onClick={logout} aria-label="Sign out" title="Sign out">
              <LogoutIcon />
            </button>
          </div>
        </header>

        <div className="content-scroll">
          <div className="page">{children}</div>
        </div>
      </main>
    </div>
  );
}
