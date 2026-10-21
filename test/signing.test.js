import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { mkdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { verifyDesktopSignatures } from "../scripts/verify-desktop-signatures.mjs";

async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "utube-signing-test-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.mkdir(path.join(root, "apps/desktop/out/make"), { recursive: true });
  await fs.mkdir(
    path.join(
      root,
      "apps/desktop/out/uTube Desktop-darwin-x64/uTube Desktop.app",
    ),
    { recursive: true },
  );
  await fs.writeFile(
    path.join(root, "apps/desktop/package.json"),
    JSON.stringify({ productName: "uTube Desktop" }),
  );
  for (const ext of ["dmg", "zip"])
    await fs.writeFile(
      path.join(root, `apps/desktop/out/make/app.${ext}`),
      "fixture",
    );
  return root;
}
function macRunner(calls, reject) {
  return (command, args) => {
    calls.push([command, args]);
    if (command === "hdiutil" && args[0] === "attach")
      mkdirSync(
        path.join(args[args.indexOf("-mountpoint") + 1], "uTube Desktop.app"),
      );
    if (command === "ditto")
      mkdirSync(path.join(args.at(-1), "uTube Desktop.app"));
    if (reject?.(command, args))
      throw new Error("Native trust check rejected the application");
  };
}

test("macOS release requires trusted and stapled apps in both installer formats", async (t) => {
  const root = await fixture(t);
  const calls = [];
  const result = await verifyDesktopSignatures({
    platform: "darwin",
    arch: "x64",
    root,
    run: macRunner(calls),
  });
  assert.equal(result.verified, true);
  for (const command of ["codesign", "spctl", "xcrun"])
    assert.equal(calls.filter(([name]) => name === command).length, 3);
  assert.equal(
    calls.filter(([name, args]) => name === "hdiutil" && args[0] === "detach")
      .length,
    1,
  );
});

test("an unsigned ZIP payload blocks a release even when the original app passes", async (t) => {
  const root = await fixture(t);
  const calls = [];
  let extracted;
  await assert.rejects(
    verifyDesktopSignatures({
      platform: "darwin",
      arch: "x64",
      root,
      run: macRunner(calls, (command, args) => {
        if (command === "ditto") extracted = args.at(-1);
        return (
          command === "codesign" &&
          extracted &&
          args.at(-1).startsWith(extracted)
        );
      }),
    }),
    /Native trust check/,
  );
  await assert.rejects(fs.access(extracted));
});

test("failed notarization assessment rejects the release and detaches the disk image", async (t) => {
  const root = await fixture(t);
  const calls = [];
  let mounted;
  await assert.rejects(
    verifyDesktopSignatures({
      platform: "darwin",
      arch: "x64",
      root,
      run: macRunner(calls, (command, args) => {
        if (command === "hdiutil" && args[0] === "attach")
          mounted = args[args.indexOf("-mountpoint") + 1];
        return (
          command === "spctl" && mounted && args.at(-1).startsWith(mounted)
        );
      }),
    }),
    /Native trust check/,
  );
  assert.ok(
    calls.some(([name, args]) => name === "hdiutil" && args[0] === "detach"),
  );
  await assert.rejects(fs.access(mounted));
});

test("Windows trust verification failure cannot be ignored", async (t) => {
  const root = await fixture(t);
  let invoked = false;
  await assert.rejects(
    verifyDesktopSignatures({
      platform: "win32",
      arch: "x64",
      root,
      run(command, args) {
        invoked = true;
        assert.equal(command, "powershell.exe");
        assert.ok(args.includes("-File"));
        throw new Error("Authenticode: NotSigned");
      },
    }),
    /NotSigned/,
  );
  assert.equal(invoked, true);
});

test("Linux is reported as outside Windows/macOS signing verification", async () => {
  const result = await verifyDesktopSignatures({
    platform: "linux",
    run() {
      throw new Error("No native verifier expected");
    },
  });
  assert.equal(result.verified, false);
});
