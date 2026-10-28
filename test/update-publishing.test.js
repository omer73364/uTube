import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { verifyEnvelope } from '../apps/desktop/src/main/updates.mjs';
const exec = promisify(execFile);
const root = path.resolve(import.meta.dirname, '..');
const run = (...args) => exec(process.execPath, args, { cwd: root });

test('publishing computes real artifact digests and signs a feed trusted by the client', async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'utube publishing '));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const artifacts = path.join(directory, 'artifacts'); await fs.mkdir(artifacts);
  await fs.writeFile(path.join(artifacts, 'uTube-Desktop-2.6.0-macos-arm64.dmg'), 'installer fixture');
  await fs.writeFile(path.join(artifacts, 'uTube-android-2.6.0.apk'), 'APK fixture');
  await fs.writeFile(path.join(artifacts, 'uTube-Desktop-2.6.0-macos-arm64.zip'), 'ignored archive');
  await fs.writeFile(path.join(artifacts, 'uTube-android-2.6.0-prototype.apk'), 'ignored preview');
  const draft = path.join(directory, 'draft.json');
  await run('scripts/create-update-manifest.mjs', '--artifacts', artifacts, '--version', '2.6.0', '--version-code', '6', '--output', draft);
  const data = JSON.parse(await fs.readFile(draft, 'utf8'));
  assert.equal(data.releases.length, 2);
  assert.equal(data.releases.find(release => release.platform === 'android').versionCode, 6);
  const privateFile = path.join(directory, 'metadata key.pem');
  await run('scripts/sign-update-manifest.mjs', '--generate-key', privateFile, '--key-id', 'test');
  assert.equal((await fs.stat(privateFile)).mode & 0o077, 0);
  const config = { keys: JSON.parse(await fs.readFile(`${privateFile}.public.json`, 'utf8')) };
  const configFile = path.join(directory, 'config.json'); await fs.writeFile(configFile, JSON.stringify(config));
  const output = path.join(directory, 'feed.json');
  await run('scripts/sign-update-manifest.mjs', '--config', configFile, '--input', draft, '--output', output, '--key-file', privateFile, '--key-id', 'test');
  const signed = await fs.readFile(output, 'utf8');
  assert.equal(verifyEnvelope(signed, config).releases.length, 2);
  // A second signing of the same revision must not replace an existing feed.
  await assert.rejects(run('scripts/sign-update-manifest.mjs', '--config', configFile, '--input', draft, '--output', output, '--key-file', privateFile, '--key-id', 'test'));
  assert.equal(await fs.readFile(output, 'utf8'), signed);
  // Key generation must never overwrite an existing private identity.
  const before = await fs.readFile(privateFile, 'utf8');
  await assert.rejects(run('scripts/sign-update-manifest.mjs', '--generate-key', privateFile));
  assert.equal(await fs.readFile(privateFile, 'utf8'), before);
});

test('publishing refuses mismatched release versions or APKs without version codes', async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'utube-publishing-invalid-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  await fs.writeFile(path.join(directory, 'uTube-android-2.6.0.apk'), 'APK fixture');
  await assert.rejects(run('scripts/create-update-manifest.mjs', '--artifacts', directory, '--version', '2.7.0', '--version-code', '6'));
  await assert.rejects(run('scripts/create-update-manifest.mjs', '--artifacts', directory, '--version', '2.6.0'));
});
