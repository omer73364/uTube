const { _electron: electron } = require("playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const { constants } = require("node:fs");
const os = require("node:os");
const path = require("node:path");

(async () => {
  const { productName } = require("../package.json");
  const source =
    process.env.UTUBE_PACKAGED_APP ||
    path.resolve(
      __dirname,
      "../out",
      `${productName}-${process.platform}-${process.arch}`,
    );
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "utube-packaged-"));
  let app;
  try {
    // Isolate the actual shipped app from the checkout's hoisted node_modules.
    const installed = path.join(root, "installed");
    await fs.cp(source, installed, {
      recursive: true,
      mode: constants.COPYFILE_FICLONE,
      // Keep macOS framework links relative so the copy is self-contained.
      verbatimSymlinks: true,
    });
    let executablePath = path.join(
      installed,
      process.platform === "win32" ? "utube-desktop.exe" : "utube-desktop",
    );
    if (process.platform === "darwin") {
      const bundle = (await fs.readdir(installed)).find((name) =>
        name.endsWith(".app"),
      );
      const binaries = path.join(installed, bundle, "Contents/MacOS");
      executablePath = path.join(binaries, (await fs.readdir(binaries))[0]);
    }
    const bootstrap = path.join(root, "worker-smoke.cjs");
    await fs.writeFile(
      bootstrap,
      `
      // Exercise the shipped worker and real YouTube.js without network access.
      globalThis.fetch = async () => {
        process.parentPort.postMessage({ smoke: 'dependency-loaded' });
        throw new Error('Network deliberately blocked by packaged smoke test');
      };
      require(process.argv[2]);
    `,
    );
    const env = { ...process.env };
    delete env.ELECTRON_RUN_AS_NODE;
    delete env.UTUBE_TEST_MEDIA;
    app = await electron.launch({
      executablePath,
      args: [
        ...(process.env.UTUBE_TEST_NO_SANDBOX === "1" ? ["--no-sandbox"] : []),
        `--user-data-dir=${path.join(root, "profile")}`,
      ],
      env,
    });
    const page = await app.firstWindow();
    await page.getByRole("textbox", { name: "YouTube URL", includeHidden: true }).waitFor();
    assert.equal(await app.evaluate(({ app }) => app.getPath("userData")), path.join(root, "profile"));
    const result = await app.evaluate(
      ({ app, utilityProcess }, bootstrap) =>
        new Promise((resolve, reject) => {
          const worker = utilityProcess.fork(
            bootstrap,
            [`${app.getAppPath()}/.vite/build/worker.cjs`],
            {
              stdio: "pipe",
              env: { ...process.env, UTUBE_TEST_MEDIA: "" },
            },
          );
          let stderr = "";
          worker.stderr?.on("data", (chunk) => {
            stderr += String(chunk);
          });
          const deadline = setTimeout(
            () => finish(new Error(`Packaged worker timed out: ${stderr}`)),
            15000,
          );
          let settled = false;
          function finish(error) {
            if (settled) return;
            settled = true;
            clearTimeout(deadline);
            worker.kill();
            if (error) reject(error);
            else resolve({ packaged: app.isPackaged, dependencyLoaded: true });
          }
          worker.on("message", (message) => {
            if (message.smoke === "dependency-loaded") finish();
            else if (message.error) finish(new Error(message.error.message));
          });
          worker.on("exit", (code) => {
            if (!settled)
              finish(new Error(`Packaged worker exited (${code}): ${stderr}`));
          });
          worker.postMessage({
            id: "packaged-smoke",
            type: "inspect",
            url: "https://youtu.be/jNQXAC9IVRw",
          });
        }),
      bootstrap,
    );
    assert.deepEqual(result, { packaged: true, dependencyLoaded: true });
    console.log(
      "PASS: isolated installed app loads its production worker and YouTube client without host dependencies.",
    );
  } finally {
    await app?.close();
    await fs.rm(root, {
      recursive: true,
      force: true,
      maxRetries: 5,
      retryDelay: 200,
    });
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
