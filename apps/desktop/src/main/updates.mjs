import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash, verify } from 'node:crypto';
import { MAX_MANIFEST_BYTES, validateManifest, selectRelease, serviceStatus, providers } from '../../../../packages/core/update-policy.js';

// Redirects are permitted only to GitHub's release asset CDN, never arbitrary hosts.
export async function fetchTrusted(url, { signal, manifest = false } = {}) {
  for (let redirects = 0; redirects <= 5; redirects++) {
    const parsed = new URL(url);
    const hosts = manifest ? ['omer73364.github.io'] : ['github.com', 'release-assets.githubusercontent.com', 'objects.githubusercontent.com'];
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.port || !hosts.includes(parsed.hostname)) throw new Error('Untrusted update host.');
    const response = await fetch(parsed, { signal, redirect: 'manual', headers: { 'User-Agent': 'uTube-Updater', 'Cache-Control': 'no-cache' } });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const next = response.headers.get('location');
      await response.body?.cancel();
      if (!next) throw new Error('Invalid update redirect.');
      url = new URL(next, parsed).href; continue;
    }
    if (!response.ok) { await response.body?.cancel(); throw new Error(`Update server returned ${response.status}.`); }
    return response;
  }
  throw new Error('Too many update redirects.');
}
export function verifyEnvelope(text, config, now = Date.now(), allowExpired = false) {
  if (Buffer.byteLength(text) > MAX_MANIFEST_BYTES) throw new Error('Update manifest is too large.');
  const envelope = JSON.parse(text);
  const key = Object.hasOwn(config.keys, envelope.keyId) && config.keys[envelope.keyId];
  if (!key || typeof envelope.payload !== 'string' || typeof envelope.signature !== 'string') throw new Error('Unknown update signing key.');
  const payload = Buffer.from(envelope.payload, 'base64');
  if (!verify('sha256', payload, key, Buffer.from(envelope.signature, 'base64'))) throw new Error('Invalid update signature.');
  const data = JSON.parse(payload.toString('utf8'));
  if (data.issuedAt > now + 300000) throw new Error('Invalid manifest date.');
  return validateManifest(data, allowExpired ? Math.min(now, data.expiresAt - 1) : now);
}
async function readLimited(response, limit) {
  const chunks = []; let size = 0;
  for await (const chunk of response.body) {
    size += chunk.length;
    if (size > limit) throw new Error('Update response is too large.');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}
export class UpdateManager {
  constructor({ config, directory, platform = process.platform, arch = process.arch, version, kind, notify = (_state) => {}, request = fetchTrusted, now = Date.now }) {
    Object.assign(this, { config, directory, platform, arch, version, kind, notify, request, now });
    this.state = { phase: Object.keys(config.keys).length ? 'idle' : 'unconfigured', services: [], statusVerified: false, loaded: 0, total: 0 };
  }
  snapshot() { return { ...this.state, services: this.state.services.map(rule => ({ ...rule })), release: this.release }; }
  emit(patch = {}) { Object.assign(this.state, patch); this.notify(this.snapshot()); }
  refreshServices() {
    this.state.services = providers.map(provider => serviceStatus(this.manifest, provider, this.platform, this.version, this.now())).filter(Boolean);
    this.state.statusVerified = Boolean(this.manifest && this.manifest.expiresAt > this.now());
    this.emit();
  }
  async initialize() {
    if (!Object.keys(this.config.keys).length) return;
    try {
      const text = await fs.readFile(path.join(this.directory, 'manifest.json'), 'utf8');
      this.manifest = verifyEnvelope(text, this.config, this.now(), true);
      this.revision = this.manifest.revision;
      this.refreshServices();
    } catch { /* An expired or damaged cache cannot disable a service. */ }
  }
  async check() {
    if (this.checking || this.controller || this.state.phase === 'installing' || this.state.phase === 'waiting') return this.snapshot();
    if (!Object.keys(this.config.keys).length) { this.emit({ phase: 'unconfigured' }); return this.snapshot(); }
    this.checking = true;
    this.emit({ phase: 'checking', error: undefined });
    try {
      const response = await this.request(this.config.manifestURL, { manifest: true, signal: AbortSignal.timeout(20000) });
      const text = await readLimited(response, MAX_MANIFEST_BYTES);
      const manifest = verifyEnvelope(text, this.config, this.now());
      if (manifest.revision < (this.revision || 0) || (manifest.revision === this.revision && this.manifest && JSON.stringify(manifest) !== JSON.stringify(this.manifest))) throw new Error('An older or conflicting update manifest was rejected.');
      await fs.mkdir(this.directory, { recursive: true });
      await fs.writeFile(path.join(this.directory, 'manifest.json.tmp'), text, { mode: 0o600 });
      await fs.rename(path.join(this.directory, 'manifest.json.tmp'), path.join(this.directory, 'manifest.json'));
      this.manifest = manifest; this.revision = manifest.revision;
      const next = selectRelease(manifest, this.platform, this.arch, this.version, this.kind);
      if (this.release?.sha256 !== next?.sha256) { this.file = undefined; this.release = next; }
      this.refreshServices();
      this.emit({ phase: this.file ? 'ready' : next ? 'available' : 'current', checkedAt: this.now(), error: undefined });
    } catch (error) {
      this.refreshServices();
      this.emit({ phase: this.file ? 'ready' : this.release ? 'available' : 'error', error: 'check', checkedAt: this.now() });
    } finally { this.checking = false; }
    return this.snapshot();
  }
  async download() {
    if (this.controller || this.checking || this.state.phase === 'waiting' || this.state.phase === 'installing') throw new Error('Update is busy.');
    if (!this.release) throw new Error('Check for updates before downloading.');
    if (!this.manifest || this.manifest.expiresAt <= this.now()) { this.emit({ error: 'check' }); return this.snapshot(); }
    const release = this.release;
    this.controller = new AbortController();
    const signal = AbortSignal.any([this.controller.signal, AbortSignal.timeout(30 * 60 * 1000)]);
    const file = path.join(this.directory, `update-${release.version}.${release.kind}`), temporary = `${file}.part`;
    this.emit({ phase: 'downloading', error: undefined, loaded: 0, total: release.size });
    try {
      await fs.mkdir(this.directory, { recursive: true });
      const space = await fs.statfs(this.directory);
      if (space.bavail * space.bsize < release.size * 2) throw new Error('Not enough space.');
      const response = await this.request(release.url, { signal });
      const hash = createHash('sha256'); let loaded = 0, last = 0;
      const handle = await fs.open(temporary, 'w', 0o600);
      try {
        for await (const chunk of response.body) {
          loaded += chunk.length;
          if (loaded > release.size) throw new Error('Invalid update size.');
          hash.update(chunk); await handle.writeFile(chunk);
          if (this.now() - last > 150) { last = this.now(); this.emit({ loaded }); }
        }
        await handle.sync();
      } finally { await handle.close(); }
      if (signal.aborted || loaded !== release.size || hash.digest('hex') !== release.sha256) throw new Error('Update verification failed.');
      await fs.rename(temporary, file);
      this.file = file;
      this.emit({ phase: 'ready', loaded });
    } catch {
      await fs.rm(temporary, { force: true }).catch(() => {});
      this.emit({ phase: 'available', error: this.controller.signal.aborted ? undefined : 'download', loaded: 0 });
    } finally { this.controller = undefined; }
    return this.snapshot();
  }
  cancel() { this.controller?.abort(); }
  async verifiedFile() {
    if (!this.file || !this.release) throw new Error('Download the update first.');
    const hash = createHash('sha256');
    const handle = await fs.open(this.file, 'r');
    try { for await (const chunk of handle.createReadStream()) hash.update(chunk); }
    finally { await handle.close(); }
    if (hash.digest('hex') !== this.release.sha256) { this.file = undefined; this.emit({ phase: 'available', error: 'download' }); throw new Error('Update verification failed.'); }
    return this.file;
  }
  dispose() { this.cancel(); }
}
