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
const pkg = require("../package.json");
const output = path.join(app, "build/release");
fs.mkdirSync(output, { recursive: true });
const variants = [
  { architectures: "arm64-v8a,x86_64", suffix: "" },
  { architectures: "arm64-v8a", suffix: "-arm64-v8a" },
  { architectures: "x86_64", suffix: "-x86_64" },
];
for (const variant of variants) {
  const result = spawnSync(gradle, ["assembleRelease", "--max-workers=2", `-PreactNativeArchitectures=${variant.architectures}`], {
    cwd: path.join(app, "android"), env, stdio: "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
  const apk = path.join(output, `uTube-android-${pkg.version}${variant.suffix}.apk`);
  fs.copyFileSync(path.join(app, "android/app/build/outputs/apk/release/app-release.apk"), apk);
  const verify = spawnSync(process.execPath, [path.join(__dirname, "verify-release.cjs"), apk,
    ...(variant.suffix ? [variant.architectures] : [])], { env, stdio: "inherit" });
  if (verify.status !== 0) process.exit(verify.status ?? 1);
}
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
console.log(`Signed and verified ${variants.length} Android ${pkg.version} APKs in ${output}`);
