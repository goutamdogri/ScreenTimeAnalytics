import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    include: ['src/**/*.spec.{ts,tsx}', 'electron/**/*.spec.ts'],
    setupFiles: ['./src/test/setup.ts'],
  },
});
