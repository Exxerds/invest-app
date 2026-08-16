// ============================================================
//  Pre-flight check that runs automatically before `npm run dev`.
//
//  It prevents the two most common startup failures:
//    1. dependencies were never installed (or node_modules was
//       deleted/synced away) → "concurrently: not found",
//       the API never boots and the browser shows a 502 page;
//    2. port 3000 or 4000 is still held by an older dev server.
//
//  Anything missing is installed automatically, so the user only
//  ever needs a single command: npm run dev
// ============================================================
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createServer } from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const serverDir = path.join(root, 'server');

function install(label, cwd) {
  console.log(`[setup] Installing ${label} dependencies — this runs only once...`);
  const res = spawnSync('npm', ['install', '--no-audit', '--no-fund'], {
    cwd,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (res.status !== 0) {
    console.error(`\n[setup] Could not install ${label} dependencies.`);
    console.error('[setup] Check your internet connection and run "npm install" manually.\n');
    process.exit(1);
  }
}

// ---------- 1. dependencies ----------
// concurrently + vite live in the root node_modules; express in server/.
const rootReady = existsSync(path.join(root, 'node_modules', 'concurrently'))
  && existsSync(path.join(root, 'node_modules', 'vite'));
const serverReady = existsSync(path.join(serverDir, 'node_modules', 'express'));

if (!rootReady) install('project', root);
if (!serverReady) install('server', serverDir);

// ---------- 2. ports ----------
function checkPort(port) {
  return new Promise(resolve => {
    const tester = createServer()
      .once('error', err => resolve(err.code !== 'EADDRINUSE'))
      .once('listening', () => tester.close(() => resolve(true)))
      .listen(port, '0.0.0.0');
  });
}

const busy = [];
for (const port of [3000, 4000]) {
  // eslint-disable-next-line no-await-in-loop
  if (!(await checkPort(port))) busy.push(port);
}

if (busy.length) {
  console.error('\n=============================================================');
  console.error(`[setup] Port ${busy.join(' and ')} already in use.`);
  console.error('[setup] An older dev server is still running — the new one cannot start,');
  console.error('[setup] which is what makes the browser show a 502 error.');
  console.error('[setup] Fix it:');
  console.error(`[setup]   npx kill-port ${busy.join(' ')}`);
  console.error('[setup]   (Windows: or close every "Node.js" process in Task Manager)');
  console.error('[setup] Then run "npm run dev" again.');
  console.error('=============================================================\n');
  process.exit(1);
}

console.log('[setup] Dependencies OK, ports 3000/4000 free — starting...\n');
