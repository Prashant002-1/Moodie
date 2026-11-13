import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';

const base = process.env.MOODIE_PLATFORM_API;
assert(base, 'Set MOODIE_PLATFORM_API to the disposable verification API.');
const url = new URL(base);
assert(['localhost', '127.0.0.1'].includes(url.hostname));
const health = await (await fetch(`${base}/health`)).json();
assert.equal(health.scope, 'verification', 'Refusing to load-test the application database.');
const login = await fetch(`${base}/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Moodie-Request': '1' },
  body: JSON.stringify({ identifier: 'native_viewer', password: 'disposable-platform-password' }),
});
assert.equal(login.status, 200);
const cookie = login.headers.get('set-cookie').split(';')[0];
const requests = [
  ['/auth/me', 'GET'], ['/diary?limit=20', 'GET'], ['/library/saved', 'GET'],
  ['/discovery/feed', 'GET'], ['/discovery/people', 'GET'], ['/recommendations', 'POST'],
];
async function measure(index) {
  const [route, method] = requests[index % requests.length];
  const start = performance.now();
  const response = await fetch(base + route, {
    method, headers: { Cookie: cookie, 'Content-Type': 'application/json', 'X-Moodie-Request': '1' },
    ...(method === 'POST' ? { body: JSON.stringify({ signal: { neutral: 0, happy: 0.8, sad: 0.2, angry: 0, fearful: 0, disgusted: 0, surprised: 0 } }) } : {}),
    signal: AbortSignal.timeout(5000),
  });
  await response.arrayBuffer();
  assert.equal(response.status, 200, route);
  return performance.now() - start;
}
for (let index = 0; index < 12; index++) await measure(index);
const results = [];
for (const concurrency of [1, 5, 10]) {
  const samples = [];
  const started = performance.now();
  let next = 0;
  await Promise.all(Array.from({ length: concurrency }, async () => {
    while (next < 120) {
      const index = next++;
      samples.push(await measure(index));
    }
  }));
  samples.sort((a, b) => a - b);
  const quantile = percentile => Math.round(samples[Math.ceil(samples.length * percentile) - 1]);
  results.push({ concurrency, requests: samples.length, errors: 0, p50Ms: quantile(0.5), p95Ms: quantile(0.95), p99Ms: quantile(0.99), maxMs: Math.round(samples.at(-1)), elapsedMs: Math.round(performance.now() - started) });
  assert(quantile(0.95) < 1000, 'Private-beta warm request p95 exceeded one second.');
}
console.log(JSON.stringify({ scope: `Small disposable fixture against ${base}; client-to-API latency included; live catalog requests excluded.`, results }, null, 2));
