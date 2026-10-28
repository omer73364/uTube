import fs from 'node:fs/promises';
import path from 'node:path';
import { version } from '../../../version.js';
import { compareVersions } from '../../../packages/core/update-policy.js';
import { settingsPath } from './heperFunctions.js';
import { details, info, interactive } from './ui.js';

const stable = value => typeof value === 'string' && /^\d{1,6}\.\d{1,6}\.\d{1,6}$/.test(value);
const DAY = 24 * 60 * 60 * 1000;
export function createCLIUpdateChecker({
  fetcher = (...args) => globalThis.fetch(...args), currentVersion = version,
  cacheFile = path.join(path.dirname(settingsPath()), 'update-check.json'),
  now = Date.now, timeout = 1500, enabled = interactive,
  notice = latest => details([['Update', `v${currentVersion} → v${latest}`], ['Run', 'npm install -g utube-cli@latest']]),
  message = info,
} = {}) {
  return async ({ force = false, manual = false } = {}) => {
    if (!manual && !enabled()) return;
    let cached;
    try {
      const stat = await fs.stat(cacheFile);
      if (stat.size <= 4096) cached = JSON.parse(await fs.readFile(cacheFile, 'utf8'));
    } catch { /* A cache failure must never prevent a download. */ }
    const valid = cached && stable(cached.latest) && Number.isSafeInteger(cached.checkedAt) && cached.checkedAt <= now();
    let latest = valid ? cached.latest : undefined;
    if (force || !valid || now() - cached.checkedAt >= DAY) {
      const controller = new AbortController();
      let timer;
      try {
        latest = await Promise.race([
          (async () => {
            const response = await fetcher('https://registry.npmjs.org/utube-cli/latest', {
              signal: controller.signal, redirect: 'error', credentials: 'omit', headers: { Accept: 'application/json' },
            });
            if (!response.ok) { await response.body?.cancel(); throw new Error('Registry unavailable'); }
            const reader = response.body?.getReader();
            if (!reader) throw new Error('Missing registry response');
            const parts = []; let size = 0;
            try {
              for (;;) {
                const { value, done } = await reader.read();
                if (done) break;
                size += value.length;
                if (size > 64 * 1024) throw new Error('Registry response too large');
                parts.push(Buffer.from(value));
              }
            } finally { void reader.cancel().catch(() => {}); reader.releaseLock(); }
            const data = JSON.parse(Buffer.concat(parts).toString('utf8'));
            if (data.name !== 'utube-cli' || !stable(data.version)) throw new Error('Invalid registry version');
            return data.version;
          })(),
          new Promise((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(new Error('Update check timed out')); }, timeout); }),
        ]);
        try {
          await fs.mkdir(path.dirname(cacheFile), { recursive: true });
          await fs.writeFile(cacheFile, JSON.stringify({ latest, checkedAt: now() }) + '\n', { mode: 0o600 });
        } catch { /* Read-only settings do not hide a valid update notice. */ }
      } catch {
        if (manual) { message('Could not check for updates. Try again later.'); return; }
        if (!valid) return;
        latest = cached.latest;
      } finally { clearTimeout(timer); }
    }
    if (latest && compareVersions(latest, currentVersion) > 0) { notice(latest); return latest; }
    if (manual && latest) message(`uTube v${currentVersion} is up to date.`);
  };
}
export const checkForCLIUpdate = createCLIUpdateChecker();
