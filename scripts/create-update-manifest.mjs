import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { parseArgs } from 'node:util';
import { validateManifest } from '../packages/core/update-policy.js';
import { verifyEnvelope } from '../apps/desktop/src/main/updates.mjs';
const { values } = parseArgs({ options: {
  artifacts: { type: 'string' }, version: { type: 'string' }, services: { type: 'string', default: 'updates/services.json' },
  previous: { type: 'string' }, output: { type: 'string', default: '/tmp/utube-update-draft.json' },
  hours: { type: 'string', default: '168' }, 'version-code': { type: 'string' },
} });
const hours = Number(values.hours);
if (!Number.isFinite(hours) || hours <= 0 || hours > 168) throw new Error('Expiry must be between 0 and 168 hours.');
const services = JSON.parse(await fs.readFile(values.services, 'utf8'));
let releases = [], priorRevision = 0;
if (values.previous) {
  try {
    const config = JSON.parse(await fs.readFile('packages/core/update-config.json', 'utf8'));
    const text = await fs.readFile(values.previous, 'utf8');
    const envelope = JSON.parse(text);
    const issuedAt = JSON.parse(Buffer.from(envelope.payload, 'base64')).issuedAt;
    const previous = verifyEnvelope(text, config, issuedAt);
    priorRevision = previous.revision; releases = previous.releases;
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
}
if (values.artifacts) {
  if (!/^\d+\.\d+\.\d+$/.test(values.version || '')) throw new Error('Provide a stable --version for the downloaded release.');
  releases = [];
  for (const filename of await fs.readdir(values.artifacts)) {
    const desktop = filename.match(/^uTube-Desktop-(\d+\.\d+\.\d+)-(linux|windows|macos)-(x64|arm64)(?:-Setup)?\.(deb|AppImage|exe|dmg)$/);
    const mobile = filename.match(/^uTube-android-(\d+\.\d+\.\d+)(?:-(arm64-v8a|x86_64|universal))?\.apk$/);
    if (!desktop && !mobile) continue;
    const version = (desktop || mobile)[1];
    if (version !== values.version) throw new Error(`Unexpected release version: ${filename}`);
    const file = path.join(values.artifacts, filename);
    const stat = await fs.stat(file);
    if (!stat.isFile()) throw new Error('Update artifact must be a file.');
    const hash = createHash('sha256');
    const handle = await fs.open(file, 'r');
    try { for await (const chunk of handle.createReadStream()) hash.update(chunk); } finally { await handle.close(); }
    const platform = desktop ? { linux: 'linux', windows: 'win32', macos: 'darwin' }[desktop[2]] : 'android';
    const arch = desktop ? desktop[3] : mobile[2] === 'arm64-v8a' ? 'arm64' : mobile[2] === 'x86_64' ? 'x64' : 'universal';
    const release = { version, platform, arch, kind: desktop ? desktop[4] : 'apk', size: stat.size, sha256: hash.digest('hex'),
      url: `https://github.com/omer73364/uTube/releases/download/v${version}/${filename}`,
      notes: { en: `uTube ${version}. See the release notes on GitHub for details.`, ar: `uTube ${version}. راجع ملاحظات الإصدار على GitHub للتفاصيل.` } };
    if (mobile) release.versionCode = Number(values['version-code']);
    releases.push(release);
  }
  if (!releases.length) throw new Error('No compatible installers were found.');
}
const now = Date.now();
const manifest = validateManifest({ schema: 1, revision: Math.max(now, priorRevision + 1), issuedAt: now, expiresAt: now + Math.floor(hours * 3600000), services, releases });
await fs.writeFile(values.output, JSON.stringify(manifest, null, 2) + '\n');
console.log(`Prepared ${releases.length} update targets and ${services.length} service notices.`);
