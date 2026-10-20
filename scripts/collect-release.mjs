import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';

const root = process.cwd();
const { version } = JSON.parse(await fs.readFile('package.json', 'utf8'));
const desktop = JSON.parse(await fs.readFile('apps/desktop/package.json', 'utf8'));
if (desktop.version !== version) throw new Error('CLI and desktop versions must match.');
if (process.env.GITHUB_REF_TYPE === 'tag' && process.env.GITHUB_REF_NAME !== `v${version}`) {
  throw new Error('The release tag must match the package versions.');
}
const platform = process.platform === 'darwin' ? 'macos' : process.platform === 'win32' ? 'windows' : 'linux';
const destination = path.join(root, 'release-artifacts');
await fs.mkdir(destination, { recursive: true });
const collected = [];
async function visit(folder) {
  for (const entry of await fs.readdir(folder, { withFileTypes: true })) {
    const source = path.join(folder, entry.name);
    if (entry.isDirectory()) { await visit(source); continue; }
    if (!/\.(deb|exe|dmg|zip|AppImage)$/.test(entry.name)) continue;
    const extension = path.extname(entry.name);
    const kind = extension === '.exe' ? '-Setup' : '';
    const filename = `uTube-Desktop-${version}-${platform}-${process.arch}${kind}${extension}`;
    if (collected.some((item) => item.filename === filename)) throw new Error(`Duplicate artifact: ${filename}`);
    const bytes = await fs.readFile(source);
    await fs.copyFile(source, path.join(destination, filename));
    collected.push({ filename, hash: createHash('sha256').update(bytes).digest('hex') });
  }
}
await visit(path.join(root, 'apps/desktop/out/make'));
const required = platform === 'linux' ? ['.deb', '.zip', '.AppImage'] : platform === 'windows' ? ['.exe', '.zip'] : ['.dmg', '.zip'];
for (const extension of required) {
  if (!collected.some((item) => item.filename.endsWith(extension))) throw new Error(`Missing ${extension} artifact`);
}
await fs.writeFile(path.join(destination, `SHA256SUMS-${platform}-${process.arch}.txt`), collected.sort((a, b) => a.filename.localeCompare(b.filename)).map(({ filename, hash }) => `${hash}  ${filename}\n`).join(''));
console.log(`Collected ${collected.length} ${platform}/${process.arch} installers for ${version}.`);
