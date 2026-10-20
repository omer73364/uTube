import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('../scripts/collect-release.mjs', import.meta.url));
const platform = process.platform === 'darwin' ? 'macos' : process.platform === 'win32' ? 'windows' : 'linux';
const extensions = platform === 'linux' ? ['deb', 'zip', 'AppImage'] : platform === 'windows' ? ['exe', 'zip'] : ['dmg', 'zip'];
async function fixture(t) {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'utube-release-'));
  t.after(() => fs.rm(cwd, { recursive: true, force: true }));
  await fs.mkdir(path.join(cwd, 'apps/desktop/out/make'), { recursive: true });
  for (const name of ['package.json', 'apps/desktop/package.json']) await fs.writeFile(path.join(cwd, name), JSON.stringify({ version: '2.2.0' }));
  return cwd;
}
const run = (cwd, env = {}) => execFileSync(process.execPath, [script], { cwd, env: { ...process.env, GITHUB_REF_TYPE: '', ...env }, stdio: 'pipe' });

test('release collection requires every format and hashes each installer', async (t) => {
  const cwd = await fixture(t);
  for (const extension of extensions) await fs.writeFile(path.join(cwd, 'apps/desktop/out/make', `test.${extension}`), 'installer');
  run(cwd);
  const output = path.join(cwd, 'release-artifacts');
  const manifest = await fs.readFile(path.join(output, `SHA256SUMS-${platform}-${process.arch}.txt`), 'utf8');
  assert.equal(manifest.trim().split('\n').length, extensions.length);
  assert.match(manifest, /^[a-f0-9]{64}  uTube-Desktop-2\.2\.0-/);
  await fs.unlink(path.join(cwd, 'apps/desktop/out/make', `test.${extensions[0]}`));
  assert.throws(() => run(cwd), /Missing/);
});

test('release collection rejects mismatched versions and tags', async (t) => {
  const cwd = await fixture(t);
  assert.throws(() => run(cwd, { GITHUB_REF_TYPE: 'tag', GITHUB_REF_NAME: 'v2.1.0' }), /release tag must match/);
  await fs.writeFile(path.join(cwd, 'apps/desktop/package.json'), '{"version":"0.1.0"}');
  assert.throws(() => run(cwd), /versions must match/);
});
