import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { version } from '../version.js';
import { createCLIUpdateChecker } from '../apps/cli/functions/updates.js';
const response = version => new Response(JSON.stringify({ name: 'utube-cli', version }));
async function fixture(t, options = {}) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'utube-cli-updates-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const notices = [], messages = [];
  const cacheFile = path.join(directory, 'cache.json');
  const check = createCLIUpdateChecker({ currentVersion: '2.5.0', cacheFile, enabled: () => true,
    notice: value => notices.push(value), message: value => messages.push(value), ...options });
  return { check, notices, messages, cacheFile };
}
test('CLI announces a newer npm version and caches checks for 24 hours', async t => {
  let calls = 0, clock = 1800000000000;
  const f = await fixture(t, { now: () => clock, fetcher: async (url, options) => {
    calls++; assert.equal(url, 'https://registry.npmjs.org/utube-cli/latest'); assert.equal(options.redirect, 'error');
    return response('2.10.0');
  } });
  await f.check(); await f.check(); assert.equal(calls, 1); assert.deepEqual(f.notices, ['2.10.0', '2.10.0']);
  clock += 86400001; await f.check(); assert.equal(calls, 2);
});
test('CLI never checks automatically in noninteractive use, but allows a manual check', async t => {
  let calls = 0;
  const f = await fixture(t, { enabled: () => false, fetcher: async () => { calls++; return response('2.5.0'); } });
  await f.check(); assert.equal(calls, 0); assert.deepEqual(f.messages, []);
  await f.check({ manual: true, force: true }); assert.equal(calls, 1); assert.match(f.messages[0], /up to date/);
});
test('CLI stays silent for installed/current and newer local versions', async t => {
  for (const latest of ['2.5.0', '2.4.9']) {
    const f = await fixture(t, { fetcher: async () => response(latest) });
    await f.check(); assert.deepEqual(f.notices, []); assert.deepEqual(f.messages, []);
  }
});
test('offline and malformed registry responses never prevent startup or inject terminal text', async t => {
  for (const fetcher of [async () => { throw Error('offline'); }, async () => response('2.6.0\nINJECT'), async () => response('3.0.0-beta'), async () => new Response('x'.repeat(65537)), async () => new Response('unavailable', { status: 503 })]) {
    const f = await fixture(t, { fetcher }); await f.check(); assert.deepEqual(f.notices, []); assert.deepEqual(f.messages, []);
  }
});
test('CLI bounds registry latency even when transport ignores cancellation', async t => {
  const f = await fixture(t, { timeout: 20, fetcher: async () => new Promise(() => {}) });
  await f.check(); assert.deepEqual(f.notices, []);
});
test('manual checks bypass cache and never claim current after an offline check', async t => {
  let offline = false, calls = 0;
  const f = await fixture(t, { fetcher: async () => { calls++; if (offline) throw Error('offline'); return response('2.5.0'); } });
  await f.check(); offline = true; await f.check({ manual: true, force: true });
  assert.equal(calls, 2); assert.deepEqual(f.messages, ['Could not check for updates. Try again later.']);
});
test('invalid and future-dated cache entries are ignored', async t => {
  const f = await fixture(t, { now: () => 1000, fetcher: async () => response('2.6.0') });
  await fs.writeFile(f.cacheFile, JSON.stringify({ latest: '2.9.0', checkedAt: 2000 }));
  await f.check(); assert.deepEqual(f.notices, ['2.6.0']);
});
test('actual --check-updates command prints the upgrade command while --version stays clean', async t => {
  const { execFile } = await import('node:child_process');
  const { promisify } = await import('node:util');
  const { fileURLToPath } = await import('node:url');
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'utube-cli-update-command-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const bootstrap = path.join(directory, 'registry.mjs');
  await fs.writeFile(bootstrap, "globalThis.fetch = async () => new Response(JSON.stringify({name:'utube-cli',version:'99.0.0'}));\n");
  const root = fileURLToPath(new URL('../', import.meta.url));
  const run = (...args) => promisify(execFile)(process.execPath, ['--import', bootstrap, path.join(root, 'index.js'), ...args], { env: { ...process.env, XDG_CONFIG_HOME: directory } });
  const result = await run('--check-updates');
  assert.ok(result.stdout.includes(`v${version} → v99.0.0`));
  assert.match(result.stdout, /npm install -g utube-cli@latest/);
  assert.equal((await run('--version')).stdout.trim(), `uTube v${version}`);
});
