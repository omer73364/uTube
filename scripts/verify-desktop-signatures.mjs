import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

async function findFiles(folder, extensions) {
  const files = [];
  for (const entry of await fs.readdir(folder, { withFileTypes: true })) {
    const file = path.join(folder, entry.name);
    if (entry.isDirectory()) files.push(...(await findFiles(file, extensions)));
    else if (extensions.includes(path.extname(entry.name))) files.push(file);
  }
  return files;
}

// Verify shipped payloads, including archives made before signing by mistake.
// The publisher's chosen signing provider must run before these checks.
export async function verifyDesktopSignatures({
  platform = process.platform,
  arch = process.arch,
  root = process.cwd(),
  run = execFileSync,
} = {}) {
  if (!["win32", "darwin", "linux"].includes(platform))
    throw new Error(`Unsupported release platform: ${platform}`);
  if (platform === "linux")
    return {
      platform,
      verified: false,
      reason:
        "Windows/macOS publisher signing does not apply to Linux packages.",
    };
  const { productName } = JSON.parse(
    await fs.readFile(path.join(root, "apps/desktop/package.json"), "utf8"),
  );
  const packaged = path.join(
    root,
    "apps/desktop/out",
    `${productName}-${platform}-${arch}`,
  );
  const make = path.join(root, "apps/desktop/out/make");
  if (platform === "win32") {
    run(
      "powershell.exe",
      [
        "-NoProfile",
        "-NonInteractive",
        "-File",
        fileURLToPath(
          new URL("./verify-windows-signatures.ps1", import.meta.url),
        ),
        "-PackagedDirectory",
        packaged,
        "-ArtifactsDirectory",
        make,
      ],
      { stdio: "pipe" },
    );
  } else {
    function verify(app) {
      run("codesign", ["--verify", "--deep", "--strict", "--verbose=2", app], {
        stdio: "pipe",
      });
      // Gatekeeper rejects ad-hoc/untrusted signatures and unnotarized apps.
      run("spctl", ["--assess", "--type", "execute", "--verbose=2", app], {
        stdio: "pipe",
      });
      run("xcrun", ["stapler", "validate", app], { stdio: "pipe" });
    }
    const app = path.join(packaged, `${productName}.app`);
    await fs.access(app);
    const artifacts = await findFiles(make, [".dmg", ".zip"]);
    for (const extension of [".dmg", ".zip"]) {
      if (!artifacts.some((file) => file.endsWith(extension)))
        throw new Error(`Missing signed release format: ${extension}`);
    }
    verify(app);
    for (const file of artifacts) {
      const temporary = await fs.mkdtemp(
        path.join(os.tmpdir(), "utube-signature-"),
      );
      const diskImage = file.endsWith(".dmg");
      let mounted = false;
      try {
        if (diskImage) {
          run(
            "hdiutil",
            [
              "attach",
              "-readonly",
              "-nobrowse",
              "-mountpoint",
              temporary,
              file,
            ],
            { stdio: "pipe" },
          );
          mounted = true;
        } else run("ditto", ["-x", "-k", file, temporary], { stdio: "pipe" });
        const payload = path.join(temporary, `${productName}.app`);
        await fs.access(payload);
        verify(payload);
      } finally {
        try {
          if (mounted) {
            run("hdiutil", ["detach", temporary], { stdio: "pipe" });
            mounted = false;
          }
        } finally {
          // Never remove files through a mount when detaching fails.
          if (!mounted)
            await fs.rm(temporary, { recursive: true, force: true });
        }
      }
    }
  }
  return { platform, verified: true };
}
if (
  process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url
) {
  try {
    const result = await verifyDesktopSignatures();
    console.log(
      result.verified
        ? `Verified ${result.platform} publisher signatures and platform trust checks.`
        : result.reason,
    );
  } catch (error) {
    console.error(
      "Public release blocked: signature verification failed. Configure trusted signing (and macOS notarization) before releasing.",
    );
    console.error(error.message);
    process.exitCode = 1;
  }
}
