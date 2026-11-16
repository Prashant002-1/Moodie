import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';

// Run after npm run build. Every write stays in this disposable directory.
const directory = await mkdtemp(path.join(tmpdir(), 'moodie-persistence-'));
const databasePath = path.join(directory, 'database');
let child;
let base;
async function stop() {
  if (!child || child.exitCode !== null) return;
  const current = child;
  const exited = once(current, 'exit');
  current.kill('SIGTERM');
  await exited;
  child = undefined;
}
async function start(dataPath = databasePath) {
  child = spawn(process.execPath, ['server/dist/index.js'], {
    cwd: process.cwd(), env: { ...process.env, NODE_ENV: 'production', DATABASE_DRIVER: 'embedded', COOKIE_SECURE: 'false', DATABASE_PATH: dataPath, DATABASE_SNAPSHOT_PATH: '', TMDB_API_KEY: '', PORT: '0', VERCEL: '' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  base = await new Promise((resolve, reject) => {
    let output = '';
    const timer = setTimeout(() => reject(new Error(`Server startup timed out: ${output}`)), 20000);
    child.on('error', error => { clearTimeout(timer); reject(error); });
    child.on('exit', code => { clearTimeout(timer); if (!output.includes('is ready')) reject(new Error(`Server exited ${code}: ${output}`)); });
    child.stderr.on('data', chunk => { output += chunk; });
    child.stdout.on('data', chunk => {
      output += chunk;
      const match = output.match(/ready at (http:\/\/localhost:\d+)/);
      if (match) { clearTimeout(timer); resolve(match[1]); }
    });
  });
}
async function api(route, { method = 'GET', body, cookie } = {}) {
  const response = await fetch(`${base}/api${route}`, { method, headers: { 'Content-Type': 'application/json', 'X-Moodie-Request': '1', ...(cookie ? { Cookie: cookie } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  return { status: response.status, cookie: response.headers.get('set-cookie')?.split(';')[0], data: response.status === 204 ? null : await response.json() };
}
try {
  await start();
  assert.equal((await fetch(`${base}/signup`)).status, 200);
  const account = await api('/auth/register', { method: 'POST', body: { email: 'restart@example.test', username: 'restart_test', password: 'disposable-test-password' } });
  assert.equal(account.status, 201);
  const cookie = account.cookie;
  await stop();
  const db = await PGlite.create(databasePath);
  await db.query("INSERT INTO movies (id, title, overview, release_date) VALUES (501,'Persistence Film','A test film','2020-01-01')");
  await db.close();
  await start();
  assert.equal((await api('/auth/me', { cookie })).data.user.username, 'restart_test');
  const entry = await api('/diary', { method: 'POST', cookie, body: { movieId: 501, watchedOn: '2026-07-01', note: 'Kept after restart', visibility: 'private', emotions: { neutral: 0, happy: 1, sad: 0, angry: 0, fearful: 0, disgusted: 0, surprised: 0 } } });
  assert.equal(entry.status, 201);
  assert.equal((await api('/library/saved', { method: 'POST', cookie, body: { movieId: 501 } })).status, 201);
  // A second server must fail instead of corrupting an already open database.
  const contender = spawn(process.execPath, ['server/dist/index.js'], { env: { ...process.env, NODE_ENV: 'production', DATABASE_DRIVER: 'embedded', DATABASE_PATH: databasePath, PORT: '0', VERCEL: '' }, stdio: 'pipe' });
  let contention = '';
  contender.stderr.on('data', chunk => { contention += chunk; });
  const [code] = await once(contender, 'exit');
  assert.equal(code, 1); assert.match(contention, /already in use/);
  await stop();
  await start();
  assert.equal((await api('/diary', { cookie })).data.entries[0].note, 'Kept after restart');
  assert.equal((await api('/library/saved', { cookie })).data.films[0].movie_id, 501);
  const removed = await api(`/diary/${entry.data.entry.id}`, { method: 'DELETE', cookie });
  assert.equal(removed.status, 204);
  await api('/library/saved/501', { method: 'DELETE', cookie });
  await stop();
  // Verify a consistent backup can restore the account and deletion state.
  const source = await PGlite.create(databasePath);
  const snapshot = await source.dumpDataDir('gzip');
  await source.close();
  const restoredPath = path.join(directory, 'restored');
  const restored = await PGlite.create({ dataDir: restoredPath, loadDataDir: snapshot });
  await restored.close();
  await start(restoredPath);
  assert.equal((await api('/auth/me', { cookie })).data.user.username, 'restart_test');
  assert.deepEqual((await api('/diary', { cookie })).data.entries, []);
  assert.deepEqual((await api('/library/saved', { cookie })).data.films, []);
  await api('/auth/logout', { method: 'POST', cookie });
  await stop(); await start(restoredPath);
  assert.equal((await api('/auth/me', { cookie })).status, 401);
  console.log('PASS: production routes, account/session persistence, diary/saved persistence, exclusive database access, backup restore, durable deletion, and logout revocation.');
} finally {
  await stop();
  await rm(directory, { recursive: true, force: true });
}
