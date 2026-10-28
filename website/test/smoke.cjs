const { _electron: electron } = require(
  process.cwd() + "/node_modules/playwright",
);
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const { spawn } = require("node:child_process");
const path = require("node:path");
const os = require("node:os");
(async () => {
  const profile = await fs.mkdtemp(path.join(os.tmpdir(), "utube-site-test-"));
  const server = spawn(process.execPath, ["scripts/serve-site.mjs"], {
    env: { ...process.env, UTUBE_SITE_PORT: "0" },
    stdio: ["ignore", "pipe", "inherit"],
  });
  let app;
  try {
    const url = await new Promise((resolve, reject) => {
      server.stdout.on("data", (chunk) => {
        const match = String(chunk).match(/Local: (http:\/\/127\.0\.0\.1:\d+)/);
        if (match) resolve(match[1]);
      });
      server.once("error", reject);
      server.once("exit", (code) =>
        reject(new Error("Preview server exited: " + code)),
      );
    });
    const env = { ...process.env, UTUBE_SITE_TEST_URL: url };
    delete env.ELECTRON_RUN_AS_NODE;
    app = await electron.launch({
      executablePath: require(process.cwd() + "/node_modules/electron"),
      args: [
        ...(process.env.UTUBE_TEST_NO_SANDBOX === "1" ? ["--no-sandbox"] : []),
        "--user-data-dir=" + profile,
        path.resolve(__dirname, "main.cjs"),
      ],
      env,
    });
    const page = await app.firstWindow();
    const capture = async (name) => {
      if (!process.env.UTUBE_SITE_SCREENSHOTS) return;
      await fs.mkdir("website/test-results", { recursive: true });
      await page.locator("img[src]").evaluateAll(async (images) => {
        for (const image of images) image.loading = "eager";
        await Promise.all(images.map((image) => image.decode()));
      });
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({
        path: `website/test-results/${name}.png`,
        fullPage: true,
      });
    };
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.waitForLoadState("networkidle");
    await page.addInitScript(() =>
      Object.defineProperty(navigator, "clipboard", {
        value: {
          writeText: async (text) => {
            window.copiedText = text;
          },
        },
      }),
    );
    await page.evaluate(() =>
      localStorage.setItem("utube-site-theme", "light"),
    );
    await page.reload();
    await page
      .getByRole("heading", { name: "uTube Video & audio downloader" })
      .waitFor();
    await capture("english-light");
    await page.getByRole("tab", { name: "Linux", exact: true }).click();
    assert.equal(await page.locator("#download-links a").count(), 3);
    assert.match(
      await page.locator("#download-links a").first().getAttribute("href"),
      /v2\.6\.0\/uTube-Desktop-2\.6\.0-linux/,
    );
    assert.match(
      await page.locator("#desktop-release-notes").getAttribute("href"),
      /v2\.6\.0$/,
    );
    await page.getByRole("tab", { name: "Windows", exact: true }).click();
    assert.equal(await page.locator("#download-links a").count(), 2);
    assert.match(
      await page.locator("#download-links a").first().getAttribute("href"),
      /v2\.6\.0\/uTube-Desktop-2\.6\.0-windows/,
    );
    assert.match(
      await page.locator('[data-i18n="versionLine"]').innerText(),
      /2\.6\.0/,
    );
    assert.match(
      await page.locator("#download-links a").first().getAttribute("href"),
      /windows-x64-Setup\.exe$/,
    );
    await page.getByRole("tab", { name: "macOS", exact: true }).click();
    assert.equal(await page.locator("#download-links a").count(), 4);
    await page.getByRole("tab", { name: "macOS", exact: true }).press("End");
    assert.equal(
      (
        await page.locator("[role=tab][aria-selected=true]").textContent()
      ).trim(),
      "Linux",
    );
    await page
      .getByRole("button", { name: "Copy installation command" })
      .click();
    assert.equal(
      await page.evaluate(() => window.copiedText),
      "npm install -g utube-cli@latest",
    );
    await page
      .getByRole("button", { name: "Switch to dark mode", exact: true })
      .click();
    await page.reload();
    assert.equal(await page.locator("html").getAttribute("data-theme"), "dark");
    await page
      .getByRole("button", { name: "Switch to light mode", exact: true })
      .click();
    await page.setViewportSize({ width: 1440, height: 980 });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page
      .getByRole("button", { name: "Switch to Arabic", exact: true })
      .click();
    assert.equal(await page.locator("html").getAttribute("dir"), "rtl");
    assert.equal(
      await page.locator("h1").innerText(),
      "uTube\nلتنزيل الفيديو والصوت",
    );
    assert.equal(
      (await page.locator("#download-title").innerText()).trim(),
      "تنزيل uTube لسطح المكتب",
    );
    assert.equal(
      await page.locator("#cli-title").innerText(),
      "من سطر الأوامر أيضًا",
    );
    await page
      .getByRole("button", { name: "التبديل إلى الوضع الداكن", exact: true })
      .click();
    await page.reload();
    assert.equal(await page.locator("html").getAttribute("lang"), "ar");
    assert.equal(await page.locator("html").getAttribute("data-theme"), "dark");
    await capture("arabic-dark");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => window.scrollTo(0, 0));
    for (const lang of ["ar", "en"]) {
      if ((await page.locator("html").getAttribute("lang")) !== lang)
        await page.locator("#language").click();
      for (const width of [320, 375, 768, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        );
        assert.equal(
          overflow,
          false,
          lang + " horizontal overflow at " + width,
        );
      }
    }
    assert.match(
      await page.locator("#android-download").getAttribute("href"),
      /v2\.6\.0\/uTube-android-2\.6\.0\.apk$/,
    );
    for (const id of ["desktop-image", "mobile-image", "cli-image"]) {
      await page.locator(`[data-image="${id}"]`).click();
      assert.equal(
        await page
          .locator("#screenshot-dialog")
          .evaluate((dialog) => dialog.open),
        true,
      );
      assert.equal(
        await page.locator("#enlarged-image").getAttribute("src"),
        await page.locator(`#${id}`).evaluate((image) => image.src),
      );
      await page.keyboard.press("Escape");
      assert.equal(
        await page
          .locator("#screenshot-dialog")
          .evaluate((dialog) => dialog.open),
        false,
      );
    }
    assert.equal(
      await page
        .locator("img")
        .evaluateAll((images) =>
          images.every((image) => image.complete && image.naturalWidth > 0),
        ),
      true,
    );
    assert.equal(await page.locator('a[href*="undefined"]').count(), 0);
    await page.setViewportSize({ width: 375, height: 844 });
    await capture("phone-english");
    const androidWindow = app.waitForEvent("window");
    await app.evaluate(({ BrowserWindow }) => {
      const window = new BrowserWindow({
        width: 390,
        height: 844,
        webPreferences: { contextIsolation: true, sandbox: true },
      });
      window.webContents.setUserAgent("Mozilla/5.0 (Linux; Android 15)");
      window.loadURL(process.env.UTUBE_SITE_TEST_URL);
    });
    const androidPage = await androidWindow;
    androidPage.on("pageerror", (error) => errors.push(error.message));
    await androidPage.waitForLoadState("networkidle");
    assert.equal(
      await androidPage.locator("#hero-download").getAttribute("href"),
      "#android",
    );
    await androidPage.close();
    assert.deepEqual(errors, []);
    console.log(
      "PASS: desktop and Android downloads, all three screenshots and keyboard zoom, command copy, saved themes/languages, Arabic RTL, and responsive widths 320–1440.",
    );
  } finally {
    await app?.close();
    server.kill();
    await fs.rm(profile, { recursive: true, force: true });
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
