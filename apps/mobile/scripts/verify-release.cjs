const assert = require("node:assert/strict");
const { X509Certificate } = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const app = path.resolve(__dirname, "..");
const sdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
assert(sdk, "Set ANDROID_HOME to verify the APK");
const tools = path.join(sdk, "build-tools/37.0.0");
const apk =
  process.argv[2] ||
  path.join(app, "android/app/build/outputs/apk/release/app-release.apk");
function run(name, args) {
  return execFileSync(path.join(tools, name), args, { encoding: "utf8" });
}
const signed = run(
  process.platform === "win32" ? "apksigner.bat" : "apksigner",
  ["verify", "--verbose", "--print-certs", apk],
);
const certificate = new X509Certificate(
  fs.readFileSync(path.join(app, "android/release-signing-certificate.pem")),
);
const fingerprint = certificate.fingerprint256
  .replaceAll(":", "")
  .toLowerCase();
assert(
  signed.includes("certificate SHA-256 digest: " + fingerprint),
  "APK must use the permanent uTube production signing certificate",
);
assert(
  !signed.includes("CN=Android Debug"),
  "Development signatures cannot be published",
);
const badging = run("aapt2", ["dump", "badging", apk]);
const pkg = require("../package.json");
assert(badging.includes("package: name='io.github.omer73364.utube.mobile'"));
assert(badging.includes(`versionName='${pkg.version}'`));
assert(badging.includes(`versionCode='${pkg.androidVersionCode}'`));
assert(
  !badging.includes("application-debuggable"),
  "Release APK must not be debuggable",
);
assert(
  badging.includes("native-code: 'arm64-v8a' 'x86_64'"),
  "Release must support ARM64 phones and x86-64 devices",
);
run("zipalign", ["-c", "-P", "16", "-v", "4", apk]);
const files = execFileSync("unzip", ["-Z1", apk], { encoding: "utf8" })
  .trim()
  .split("\n");
assert(
  files.includes("assets/index.android.bundle"),
  "Release must run without Metro",
);
let libraries = 0;
for (const file of files.filter((name) => /^lib\/.*\.so$/.test(name))) {
  const elf = execFileSync("unzip", ["-p", apk, file], {
    maxBuffer: 150 * 1024 * 1024,
  });
  assert.equal(elf.subarray(0, 4).toString("hex"), "7f454c46");
  assert.equal(elf[4], 2, `Expected 64-bit ELF: ${file}`);
  const offset = Number(elf.readBigUInt64LE(32));
  const size = elf.readUInt16LE(54);
  const count = elf.readUInt16LE(56);
  for (let index = 0; index < count; index++) {
    const start = offset + index * size;
    if (elf.readUInt32LE(start) === 1) {
      assert(
        elf.readBigUInt64LE(start + 48) >= 16384n,
        `Native library lacks 16 KB alignment: ${file}`,
      );
    }
  }
  libraries++;
}
console.log(
  `Verified uTube Android ${pkg.version}: production signature, bundled JS, non-debuggable manifest, both architectures, and 16 KB alignment for ${libraries} native libraries.`,
);
console.log("Signing certificate SHA-256: " + certificate.fingerprint256);
