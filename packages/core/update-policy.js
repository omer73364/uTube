/** Data-only update protocol, shared by desktop, mobile, and release tooling. */
export const providers = ['youtube', 'x', 'instagram', 'facebook'];
export const serviceStates = ['available', 'degraded', 'unavailable', 'retired'];
export const MAX_MANIFEST_BYTES = 256 * 1024;
export const MAX_UPDATE_BYTES = 1024 * 1024 * 1024;
export function providerForID(id) {
  return id.startsWith('ig-') ? 'instagram' : id.startsWith('fb-') ? 'facebook' : id.startsWith('x-') ? 'x' : 'youtube';
}
export function compareVersions(a, b) {
  const parse = (v) => {
    if (typeof v !== 'string' || !/^\d{1,6}\.\d{1,6}\.\d{1,6}$/.test(v)) throw new Error('Invalid release version.');
    return v.split('.').map(Number);
  };
  const left = parse(a), right = parse(b);
  for (let i = 0; i < 3; i++) if (left[i] !== right[i]) return Math.sign(left[i] - right[i]);
  return 0;
}
export function trustedAssetURL(value) {
  if (typeof value !== 'string') throw new Error('Invalid update URL.');
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || url.port || url.search || url.hash ||
      url.hostname !== 'github.com' || !/^\/omer73364\/uTube\/releases\/download\/v\d+\.\d+\.\d+\/[-\w.]+$/.test(url.pathname)) throw new Error('Invalid update URL.');
  return url.href;
}
export function validateManifest(data, now = Date.now()) {
  if (!data || data.schema !== 1 || !Number.isSafeInteger(data.revision) || data.revision < 1 ||
      !Number.isSafeInteger(data.issuedAt) || !Number.isSafeInteger(data.expiresAt) || data.issuedAt > now + 300000 ||
      data.expiresAt <= now || data.expiresAt <= data.issuedAt || data.expiresAt - data.issuedAt > 7 * 86400000 ||
      !Array.isArray(data.services) || data.services.length > 100 || !Array.isArray(data.releases) || data.releases.length > 32) throw new Error('Invalid or expired update manifest.');
  const message = (value) => value && typeof value.en === 'string' && typeof value.ar === 'string' && value.en.length <= 4000 && value.ar.length <= 4000;
  for (const rule of data.services) {
    if (!providers.includes(rule.provider) || !serviceStates.includes(rule.state) || !message(rule.message) ||
        (rule.platforms !== undefined && (!Array.isArray(rule.platforms) || !rule.platforms.length || rule.platforms.some(p => !['darwin', 'win32', 'linux', 'android'].includes(p))))) throw new Error('Invalid service status.');
    for (const field of ['minVersion', 'maxVersion', 'fixedVersion']) if (rule[field] !== undefined) compareVersions(rule[field], '0.0.0');
  }
  const targets = new Set();
  for (const release of data.releases) {
    compareVersions(release.version, '0.0.0');
    if (!['darwin', 'win32', 'linux', 'android'].includes(release.platform) || !['x64', 'arm64', 'universal'].includes(release.arch) ||
        !['exe', 'dmg', 'deb', 'AppImage', 'apk'].includes(release.kind) || !/^[a-f0-9]{64}$/.test(release.sha256) ||
        !Number.isSafeInteger(release.size) || release.size <= 0 || release.size > MAX_UPDATE_BYTES || !message(release.notes)) throw new Error('Invalid release artifact.');
    const allowed = { darwin: ['dmg'], win32: ['exe'], linux: ['deb', 'AppImage'], android: ['apk'] };
    if (!allowed[release.platform].includes(release.kind)) throw new Error('Invalid installer type.');
    const url = trustedAssetURL(release.url);
    if (!url.includes(`/v${release.version}/`) || !url.endsWith(`.${release.kind}`)) throw new Error('Artifact does not match its release.');
    if (release.platform === 'android' && (!Number.isSafeInteger(release.versionCode) || release.versionCode < 1)) throw new Error('Invalid Android version code.');
    const target = `${release.platform}/${release.arch}/${release.kind}`;
    if (targets.has(target)) throw new Error('Duplicate release target.');
    targets.add(target);
  }
  return data;
}
export function serviceStatus(manifest, provider, platform, version, now = Date.now()) {
  if (!manifest || manifest.expiresAt <= now) return undefined;
  return manifest.services.find(rule => rule.provider === provider && (!rule.platforms || rule.platforms.includes(platform)) &&
    (!rule.minVersion || compareVersions(version, rule.minVersion) >= 0) &&
    (!rule.maxVersion || compareVersions(version, rule.maxVersion) <= 0) &&
    (!rule.fixedVersion || compareVersions(version, rule.fixedVersion) < 0));
}
export function isServiceBlocked(status) { return status?.state === 'unavailable' || status?.state === 'retired'; }
export function selectRelease(manifest, platform, arch, version, kind, versionCode) {
  if (!manifest) return undefined;
  const matches = manifest.releases.filter(release => release.platform === platform && (release.arch === arch || release.arch === 'universal') &&
    (!kind || release.kind === kind) && compareVersions(release.version, version) > 0 &&
    (platform !== 'android' || release.versionCode > versionCode));
  return matches.sort((a, b) => compareVersions(b.version, a.version) || Number(b.arch === arch) - Number(a.arch === arch))[0];
}
