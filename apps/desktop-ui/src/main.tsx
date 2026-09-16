import React from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/inter/latin-400.css';
import '@fontsource/inter/latin-500.css';
import '@fontsource/inter/latin-600.css';
import '@fontsource/jetbrains-mono/latin-400.css';
import '@fontsource/jetbrains-mono/latin-500.css';
import './theme/tokens.css';
import { App } from './App';

const stored = localStorage.getItem('screen-time-theme');
const prefersLight = matchMedia('(prefers-color-scheme: light)').matches;
document.documentElement.dataset.theme = stored ?? (prefersLight ? 'light' : 'dark');

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
