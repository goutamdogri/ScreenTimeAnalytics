import { useEffect, useState } from 'react';
import { SignalGlyph } from './primitives';

/**
 * Custom window title bar for the frameless Electron window (see
 * `electron/main.ts`). Replaces the native frame and OS menu bar with an
 * in-app bar styled to match the rest of the UI. The strip is a drag region;
 * the window controls are interactable (`-webkit-app-region: no-drag`). In a
 * plain browser preview there is no bridge, so the controls are omitted.
 */
export function TitleBar() {
  const bridge = window.screenTime;
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    if (!bridge) return;
    return bridge.onMaximizedChange((value) => setMaximized(value));
  }, [bridge]);

  if (!bridge) {
    return (
      <div className="titlebar" data-testid="titlebar">
        <div className="titlebar-left">
          <div className="titlebar-mark">
            <SignalGlyph />
          </div>
          <span className="titlebar-name">Screen Time</span>
        </div>
      </div>
    );
  }

  return (
    <div className="titlebar" data-testid="titlebar">
      <div className="titlebar-left">
        <div className="titlebar-mark">
          <SignalGlyph />
        </div>
        <span className="titlebar-name">Screen Time</span>
      </div>
      <div className="titlebar-controls">
        <button
          className="window-chrome"
          onClick={() => bridge.minimize()}
          aria-label="Minimize"
          title="Minimize"
        >
          <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true">
            <line x1="1.5" y1="6" x2="10.5" y2="6" stroke="currentColor" strokeWidth="1.2" />
          </svg>
        </button>
        <button
          className="window-chrome"
          onClick={() => bridge.toggleMaximize()}
          aria-label={maximized ? 'Restore' : 'Maximize'}
          title={maximized ? 'Restore' : 'Maximize'}
        >
          {maximized ? (
            <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true">
              <rect
                x="1.8"
                y="4.4"
                width="6.2"
                height="6.2"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.2"
              />
              <path
                d="M4.6 4.4V2.6h5.4v5.6h-1.6"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.2"
              />
            </svg>
          ) : (
            <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true">
              <rect
                x="2"
                y="2"
                width="8"
                height="8"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.2"
                rx="0.5"
              />
            </svg>
          )}
        </button>
        <button
          className="window-chrome window-chrome-close"
          onClick={() => bridge.close()}
          aria-label="Close"
          title="Close"
        >
          <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true">
            <line
              x1="2"
              y1="2"
              x2="10"
              y2="10"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinecap="round"
            />
            <line
              x1="10"
              y1="2"
              x2="2"
              y2="10"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
