// Load the local signing identity without putting passwords in shell history.
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
  if (!env[key]) throw new Error(`Release signing requires ${key}`);
}
const gradle = process.platform === "win32" ? "gradlew.bat" : "./gradlew";
const result = spawnSync(gradle, ["assembleRelease", "--max-workers=2"], {
  cwd: path.join(app, "android"),
  env,
  stdio: "inherit",
});
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);
const check = spawnSync(
  process.execPath,
  [
    path.join(__dirname, "check-bundle.cjs"),
    path.join(
      app,
      "android/app/build/intermediates/sourcemaps/react/release/index.android.bundle.packager.map",
    ),
  ],
  { stdio: "inherit" },
);
if (check.status !== 0) process.exit(check.status ?? 1);
const verify = spawnSync(
  process.execPath,
  [path.join(__dirname, "verify-release.cjs")],
  { env, stdio: "inherit" },
);
process.exit(verify.status ?? 1);
