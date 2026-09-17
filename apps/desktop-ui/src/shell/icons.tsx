import type { ReactNode } from 'react';

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export function OverviewIcon() {
  return (
    <Icon>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
    </Icon>
  );
}

export function TrendsIcon() {
  return (
    <Icon>
      <polyline points="3.5 17 9 10.5 13.5 15 20.5 6.5" />
      <path d="M15.5 6.5h5v5" />
    </Icon>
  );
}

export function SessionsIcon() {
  return (
    <Icon>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </Icon>
  );
}

export function CategoriesIcon() {
  return (
    <Icon>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 12V3.5" />
      <path d="M12 12L20.5 12" />
    </Icon>
  );
}

export function ProgressIcon() {
  return (
    <Icon>
      <path d="M12 3l6.5 2.3v5.1c0 4.3-2.7 7.3-6.5 9.3-3.8-2-6.5-5-6.5-9.3V5.3L12 3Z" />
      <path d="M12 7.8l1.1 2.3 2.6.3-1.9 1.8.5 2.5-2.3-1.2-2.3 1.2.5-2.5-1.9-1.8 2.6-.3L12 7.8Z" />
    </Icon>
  );
}

export function DevicesIcon() {
  return (
    <Icon>
      <rect x="3" y="4.5" width="18" height="12.5" rx="2" />
      <path d="M12 17v2.5" />
      <path d="M8.5 19.5h7" />
    </Icon>
  );
}

export function SettingsIcon() {
  return (
    <Icon>
      <path d="M4 7h16" />
      <path d="M4 12h16" />
      <path d="M4 17h16" />
      <circle cx="9" cy="7" r="2" fill="var(--bg-2)" />
      <circle cx="15" cy="12" r="2" fill="var(--bg-2)" />
      <circle cx="7" cy="17" r="2" fill="var(--bg-2)" />
    </Icon>
  );
}

export function SunIcon() {
  return (
    <Icon>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M18.7 5.3l-1.4 1.4M6.7 17.3l-1.4 1.4" />
    </Icon>
  );
}

export function MoonIcon() {
  return (
    <Icon>
      <path d="M20.5 13.5A8.5 8.5 0 1 1 10.5 3.5a7 7 0 0 0 10 10Z" />
    </Icon>
  );
}

export function LogoutIcon() {
  return (
    <Icon>
      <path d="M9.5 4H5a1.5 1.5 0 0 0-1.5 1.5v13A1.5 1.5 0 0 0 5 20h4.5" />
      <path d="M15.5 15.5L20 12l-4.5-3.5" />
      <path d="M20 12H9.5" />
    </Icon>
  );
}
