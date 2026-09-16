/* global process, console, setTimeout */
import { spawn, spawnSync } from 'node:child_process';
import { request } from 'node:http';

const PORT = 5173;
const cwd = process.cwd();

function waitForVite() {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + 30_000;
    const probe = () => {
      if (Date.now() > deadline) {
        reject(new Error('Vite dev server did not start in time'));
        return;
      }
      const req = request({ host: 'localhost', port: PORT, path: '/' }, (res) => {
        res.resume();
        resolve();
      });
      req.on('error', () => setTimeout(probe, 400));
      req.end();
    };
    probe();
  });
}

function main() {
  const compiled = spawnSync('tsc', ['-p', 'tsconfig.electron.json'], { cwd, stdio: 'inherit' });
  if (compiled.status !== 0) {
    process.exit(compiled.status ?? 1);
  }

  const vite = spawn('vite', [], { cwd, stdio: 'inherit', shell: true });

  waitForVite()
    .then(() => {
      const electron = spawn('electron', ['.'], {
        cwd,
        stdio: 'inherit',
        shell: true,
        env: { ...process.env, VITE_DEV_SERVER_URL: `http://localhost:${PORT}` },
      });
      const shutdown = () => {
        electron.kill();
        vite.kill();
        process.exit(0);
      };
      process.on('SIGINT', shutdown);
      process.on('SIGTERM', shutdown);
      electron.on('exit', () => vite.kill());
    })
    .catch((err) => {
      console.error(String(err));
      vite.kill();
      process.exit(1);
    });
}

main();
