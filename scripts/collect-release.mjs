import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { parseArgs } from 'node:util';

const root = process.cwd();
const { version } = JSON.parse(await fs.readFile('package.json', 'utf8'));
const desktop = JSON.parse(await fs.readFile('apps/desktop/package.json', 'utf8'));
if (desktop.version !== version) throw new Error('CLI and desktop versions must match.');
if (process.env.GITHUB_REF_TYPE === 'tag' && process.env.GITHUB_REF_NAME !== `v${version}`) {
  throw new Error('The release tag must match the package versions.');
}
const platform = process.platform === 'darwin' ? 'macos' : process.platform === 'win32' ? 'windows' : 'linux';
const { values } = parseArgs({ options: { arch: { type: 'string', default: process.arch } } });
const architectures = ['x64', 'arm64', 'ia32', 'armv7l'];
const arch = values.arch;
if (!architectures.includes(arch)) throw new Error(`Unsupported target architecture: ${arch}`);
const makeRoot = path.join(root, 'apps/desktop/out/make');
const destination = path.join(root, 'release-artifacts');
await fs.mkdir(destination, { recursive: true });
const collected = [];
async function visit(folder) {
  for (const entry of await fs.readdir(folder, { withFileTypes: true })) {
    const source = path.join(folder, entry.name);
    if (entry.isDirectory()) { await visit(source); continue; }
    if (!/\.(deb|exe|dmg|zip|AppImage)$/.test(entry.name)) continue;
    const artifactArch = path.relative(makeRoot, source).split(path.sep).find(part => architectures.includes(part))
      || entry.name.match(/(?:^|[-_])(x64|arm64|ia32|armv7l)(?=[-_.]|$)/)?.[1];
    if (artifactArch && artifactArch !== arch) continue;
    if (!artifactArch && arch !== process.arch) throw new Error(`Cannot determine architecture of ${source}`);
    // Forge keeps previous make outputs. Never rename an old installer as this release.
    const builtVersion = entry.name.match(/(?:^|[-_])(\d+\.\d+\.\d+)(?=[-_.]|$)/)?.[1];
    if (builtVersion && builtVersion !== version) continue;
    const extension = path.extname(entry.name);
    const kind = extension === '.exe' ? '-Setup' : '';
    const filename = `uTube-Desktop-${version}-${platform}-${arch}${kind}${extension}`;
    if (collected.some((item) => item.filename === filename)) throw new Error(`Duplicate artifact: ${filename}`);
    const bytes = await fs.readFile(source);
    await fs.copyFile(source, path.join(destination, filename));
    collected.push({ filename, hash: createHash('sha256').update(bytes).digest('hex') });
  }
}
await visit(makeRoot);
const required = platform === 'linux' ? ['.deb', '.zip', '.AppImage'] : platform === 'windows' ? ['.exe', '.zip'] : ['.dmg', '.zip'];
for (const extension of required) {
  if (!collected.some((item) => item.filename.endsWith(extension))) throw new Error(`Missing ${extension} artifact`);
}
await fs.writeFile(path.join(destination, `SHA256SUMS-${platform}-${arch}.txt`), collected.sort((a, b) => a.filename.localeCompare(b.filename)).map(({ filename, hash }) => `${hash}  ${filename}\n`).join(''));
console.log(`Collected ${collected.length} ${platform}/${arch} installers for ${version}.`);
