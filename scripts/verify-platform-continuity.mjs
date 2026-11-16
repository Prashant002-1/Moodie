import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';

// Override before loading the app. Never touch an existing database or call TMDB.
Object.assign(process.env, { NODE_ENV: 'test', DATABASE_DRIVER: 'embedded', DATABASE_PATH: 'memory://', DATABASE_SNAPSHOT_PATH: '', TMDB_API_KEY: '', VERCEL: '', COOKIE_SECURE: 'false' });
const require = createRequire(import.meta.url);
const { default: database, initializeDatabase } = require('../server/dist/config/database.js');
const app = require('../server/dist/app.js').default;
const express = require('express');
const directory = await mkdtemp(path.join(tmpdir(), 'moodie-platform-'));
const externalAPI = process.env.MOODIE_PLATFORM_API;
let server, vite, baseURL;
try {
  if (externalAPI) {
    const url = new URL(externalAPI);
    assert(['127.0.0.1', 'localhost'].includes(url.hostname), 'External verification requires a local tunnel.');
    assert.equal(url.pathname, '/api');
    const health = await (await fetch(`${externalAPI}/health`)).json();
    assert.equal(health.scope, 'verification', 'Refusing to create test accounts in an application database.');
    baseURL = externalAPI;
  } else {
  await initializeDatabase();
  await database.query("INSERT INTO movies(id,title,overview,release_date) VALUES(101,'Quiet Film','A small story that stayed with us.','2020-01-01')");
  app.use(express.static(path.resolve('dist')));
  app.use((req, res) => res.sendFile(path.resolve('dist/index.html')));
  server = await new Promise(resolve => { const listening = app.listen(0, '127.0.0.1', () => resolve(listening)); });
  baseURL = `http://127.0.0.1:${server.address().port}/api`;
  }
  const { createServer } = await import('vite');
  vite = await createServer({ server: { middlewareMode: true, watch: null }, appType: 'custom' });
  const { apiClient } = await vite.ssrLoadModule('/src/services/apiClient.ts');
  const { discoveryService: discovery } = await vite.ssrLoadModule('/src/services/discoveryService.ts');
  const { diaryService: diary } = await vite.ssrLoadModule('/src/services/diaryService.ts');
  const { suggestionService: suggestions } = await vite.ssrLoadModule('/src/services/suggestionService.ts');
  const { safetyService: safety } = await vite.ssrLoadModule('/src/services/safetyService.ts');
  // Only the browser notification sink is adapted; the actual service and Axios
  // requests run unchanged against Express. No response or database is mocked.
  globalThis.window = new EventTarget();
  apiClient.defaults.baseURL = baseURL;
  const password = 'disposable-platform-password';
  const register = async username => {
    delete apiClient.defaults.headers.common.Cookie;
    const response = await apiClient.post('/auth/register', { username, email: `${username}@example.test`, password });
    return { id: response.data.user.id, cookie: response.headers['set-cookie'][0].split(';')[0] };
  };
  const sender = await register('web_sender');
  const recipient = await register('native_viewer');
  const as = account => { apiClient.defaults.headers.common.Cookie = account.cookie; };
  as(recipient); await discovery.follow(sender.id);
  as(sender);
  const entry = await diary.create({ movieId: 101, watchedOn: '2026-01-01', visibility: 'public', note: 'The quiet ending stayed with me', emotions: { neutral: 0, happy: .3, sad: .7, angry: 0, fearful: 0, disgusted: 0, surprised: 0 }, clientRequestId: randomUUID() });
  const suggestion = await suggestions.create({ origin: 'sent', movieId: 101, recipientId: recipient.id, sourceEntryId: entry.id, reason: 'For your quiet evening' });
  const fixture = path.join(directory, 'input.json'), output = path.join(directory, 'output.json');
  await writeFile(fixture, JSON.stringify({ baseURL, username: 'native_viewer', password, suggestionId: suggestion.id, sourceId: entry.id, output }));
  await new Promise((resolve, reject) => {
    const child = spawn('swift', ['test', '--package-path', 'ios/MoodieCore', '--scratch-path', path.join(directory, 'swift'), '--filter', 'LivePlatformTests'], { env: { ...process.env, MOODIE_PLATFORM_FIXTURE: fixture }, stdio: ['ignore', 'inherit', 'inherit'] });
    const timeout = setTimeout(() => { child.kill('SIGTERM'); reject(new Error('Native continuity check timed out')); }, 120000);
    child.on('error', error => { clearTimeout(timeout); reject(error); });
    child.on('exit', code => { clearTimeout(timeout); code === 0 ? resolve() : reject(new Error(`Native continuity check exited ${code}`)); });
  });
  const native = JSON.parse(await readFile(output, 'utf8'));
  as(sender);
  const returned = await suggestions.get(suggestion.id);
  assert.equal(returned.reply.note, 'The music stayed with me');
  assert.equal(returned.reply.feelings, null);
  assert.equal(returned.linked_entry_id, null);
  assert(!JSON.stringify(returned).includes('Private native diary words'));
  const conversation = await suggestions.messages(suggestion.id);
  assert.equal(conversation.messages.length, 1);
  assert.equal(conversation.messages[0].body, 'Thank you for thinking of me');
  const comments = await discovery.commentsPage(entry.id);
  assert.equal(comments.total, 1); assert.equal(comments.comments[0].body, 'A comment from native');
  assert.equal((await discovery.filmEntriesPage(101)).summary.total, 1);
  as(recipient);
  assert.equal((await diary.page({ limit: 1, movieId: 101 })).entries[0].id, native.entryId);
  assert.equal((await diary.status([101]))[0].saved, true);
  await suggestions.removeReply(suggestion.id);
  as(sender); assert.equal((await suggestions.get(suggestion.id)).reply, null);
  as(recipient); await safety.block(sender.id);
  assert.deepEqual((await discovery.peoplePage({ scope: 'following' })).people, []);
  assert.equal((await discovery.filmEntriesPage(101)).summary.total, 0);
  console.log('PASS: web service -> native transport -> reopened native client -> web service. Private diary, retry identity, explicit reply/retraction, messages, comments, paging and blocking verified.');
  if (process.argv.includes('--review')) {
    // Restore only the test relationship for the bounded browser review.
    await safety.unblock(sender.id); await discovery.follow(sender.id);
    console.log(`Disposable review: ${baseURL.replace('/api', '')}/signin, native_viewer / ${password}`);
    await new Promise(resolve => { process.once('SIGINT', resolve); process.once('SIGTERM', resolve); });
  }
} finally {
  await vite?.close();
  if (server) await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
  if (!externalAPI) await database.end();
  await rm(directory, { recursive: true, force: true });
}
