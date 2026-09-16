import { AuthProvider, useAuth } from './auth/AuthProvider';
import { Shell, type ViewKey } from './shell/Shell';
import { Overview } from './routes/Overview';
import { Trends } from './routes/Trends';
import { Sessions } from './routes/Sessions';
import { Categories } from './routes/Categories';
import { Devices } from './routes/Devices';
import { Settings } from './routes/Settings';
import { useState, type FormEvent, type ComponentType } from 'react';

const VIEWS: Record<ViewKey, ComponentType> = {
  overview: Overview,
  trends: Trends,
  sessions: Sessions,
  categories: Categories,
  devices: Devices,
  settings: Settings,
};

function Login() {
  const { login, register } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isRegister, setIsRegister] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const fn = isRegister ? register : login;
    const err = await fn(email, password);
    if (err) setError(err.message);
  };

  return (
    <div className="auth-container" data-testid="login">
      <div className="auth-card">
        <div className="auth-eyebrow">{isRegister ? 'Create account' : 'Sign in'}</div>
        <div className="auth-title">Screen Time Analytics</div>
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input
            className="input"
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            className="input"
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {error ? <div style={{ fontSize: 12, color: 'var(--autopilot)' }}>{error}</div> : null}
          <button className="btn" type="submit">
            {isRegister ? 'Register' : 'Sign in'}
          </button>
        </form>
        <button
          className="btn"
          data-variant="ghost"
          style={{ marginTop: 8, width: '100%' }}
          onClick={() => setIsRegister(!isRegister)}
        >
          {isRegister ? 'Already have an account? Sign in' : 'No account? Register'}
        </button>
      </div>
    </div>
  );
}

function AppShell() {
  const { status } = useAuth();
  const [view, setView] = useState<ViewKey>('overview');

  if (status === 'loading') return null;
  if (status === 'unauthenticated') return <Login />;

  const ViewComponent = VIEWS[view];
  return (
    <Shell view={view} onNavigate={setView}>
      <ViewComponent />
    </Shell>
  );
}

export function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}
