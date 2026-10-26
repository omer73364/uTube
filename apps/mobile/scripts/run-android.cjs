// Use the local release identity so development installs can replace the official app.
// Signing values stay in the child environment, never command arguments or logs.
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const app = path.resolve(__dirname, "..");
const identity = path.resolve(app, "../../.private/android/signing.json");
const env = { ...process.env };
if (fs.existsSync(identity)) {
  const signing = JSON.parse(fs.readFileSync(identity, "utf8"));
  for (const [key, value] of Object.entries(signing)) env[key] ??= value;
}
for (const key of [
  "UTUBE_ANDROID_KEYSTORE",
  "UTUBE_ANDROID_STORE_PASSWORD",
  "UTUBE_ANDROID_KEY_ALIAS",
  "UTUBE_ANDROID_KEY_PASSWORD",
]) {
  if (!env[key]) {
    throw new Error(
      "To install over the official app, configure the local Android release-signing identity. See apps/mobile/README.md. No app was uninstalled.",
    );
  }
}
const cli = path.join(path.dirname(require.resolve("react-native/package.json")), "cli.js");
const result = spawnSync(
  process.execPath,
  [cli, "run-android", ...process.argv.slice(2)],
  { cwd: app, env, stdio: "inherit" },
);
if (result.error) throw result.error;
process.exit(result.status ?? 1);
