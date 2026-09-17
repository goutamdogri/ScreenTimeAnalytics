import { AuthProvider, useAuth } from './auth/AuthProvider';
import { SignalGlyph } from './components/primitives';
import { Shell, type ViewKey } from './shell/Shell';
import { Overview } from './routes/Overview';
import { Trends } from './routes/Trends';
import { Sessions } from './routes/Sessions';
import { Categories } from './routes/Categories';
import { Progress } from './routes/Progress';
import { Devices } from './routes/Devices';
import { Settings } from './routes/Settings';
import { useState, type FormEvent, type ComponentType } from 'react';

type ViewComponent = ComponentType<{ onNavigate: (key: ViewKey) => void }>;

const VIEWS: Record<ViewKey, ViewComponent> = {
  overview: (props) => <Overview {...props} />,
  trends: () => <Trends />,
  sessions: () => <Sessions />,
  categories: () => <Categories />,
  progress: () => <Progress />,
  devices: () => <Devices />,
  settings: () => <Settings />,
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
    <div className="auth-shell" data-testid="login">
      <div className="auth-panel">
        <div className="auth-brand">
          <div className="brand-mark">
            <SignalGlyph />
          </div>
          <div className="auth-brand-text">
            <div className="brand-name">Screen Time</div>
          </div>
        </div>
        <div className="auth-card">
          <div>
            <div className="auth-title">{isRegister ? 'Create account' : 'Welcome back'}</div>
            <div className="auth-sub">
              {isRegister
                ? 'Start measuring your screen time across every app.'
                : 'Sign in to see how your day is splitting up.'}
            </div>
          </div>
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
            {error ? <div className="error-banner">{error}</div> : null}
            <button className="btn btn-primary" type="submit" style={{ marginTop: 4 }}>
              {isRegister ? 'Create account' : 'Sign in'}
            </button>
          </form>
        </div>
        <div className="auth-switch">
          {isRegister ? 'Already have an account?' : 'New here?'}
          <button onClick={() => setIsRegister(!isRegister)}>
            {isRegister ? 'Sign in' : 'Create an account'}
          </button>
        </div>
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
      <ViewComponent onNavigate={setView} />
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
