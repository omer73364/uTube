const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const app = path.resolve(__dirname, '..');
if (process.platform !== 'darwin') throw new Error('iOS builds require macOS and Xcode 26 or newer.');
if (!fs.existsSync(path.join(app, 'ios/Pods/Manifest.lock'))) throw new Error('Run pod install from apps/mobile/ios first.');
const test = process.argv.includes('--test');
let destination = process.env.UTUBE_IOS_DESTINATION || 'generic/platform=iOS Simulator';
if (test && !process.env.UTUBE_IOS_DESTINATION) {
  const list = spawnSync('xcrun', ['simctl', 'list', 'devices', 'booted', '--json'], { encoding: 'utf8' });
  if (list.status !== 0) throw new Error('Could not list simulators. Start an iOS simulator or set UTUBE_IOS_DESTINATION.');
  const device = Object.values(JSON.parse(list.stdout).devices).flat().find(device => device.state === 'Booted' && device.isAvailable);
  if (!device) throw new Error('Start an iOS simulator or set UTUBE_IOS_DESTINATION.');
  destination = `platform=iOS Simulator,id=${device.udid}`;
}
const args = ['-workspace', 'ios/uTube.xcworkspace', '-scheme', 'uTube', '-configuration', 'Release',
  '-destination', destination, '-derivedDataPath', 'build/ios-derived',
  'CODE_SIGNING_ALLOWED=NO', `SOURCEMAP_FILE=${path.join(app, 'build/ios/main.map')}`];
if (test) args.push('-parallel-testing-enabled', 'NO');
if (process.env.UTUBE_LIVE_URL) args.push(`UTUBE_LIVE_URL=${process.env.UTUBE_LIVE_URL}`);
fs.mkdirSync(path.join(app, 'build/ios'), { recursive: true });
const result = spawnSync('xcodebuild', [...args, test ? 'test' : 'build'], { cwd: app, stdio: 'inherit' });
if (result.status !== 0) process.exit(result.status || 1);
const check = spawnSync(process.execPath, [path.join(__dirname, 'check-bundle.cjs'), path.join(app, 'build/ios/main.map')], { cwd: app, stdio: 'inherit' });
process.exit(check.status || 0);
