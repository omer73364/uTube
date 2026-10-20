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
    await page.getByRole("tab", { name: "Linux", exact: true }).click();
    assert.equal(await page.locator("#download-links a").count(), 3);
    await page.getByRole("tab", { name: "Windows", exact: true }).click();
    assert.equal(await page.locator("#download-links a").count(), 2);
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
      "تنزيل uTube",
    );
    assert.equal(
      await page.locator("#cli-title").innerText(),
      "نسخة سطر الأوامر",
    );
    await page
      .getByRole("button", { name: "التبديل إلى الوضع الداكن", exact: true })
      .click();
    await page.reload();
    assert.equal(await page.locator("html").getAttribute("lang"), "ar");
    assert.equal(await page.locator("html").getAttribute("data-theme"), "dark");
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
    assert.equal(await page.locator('a[href*="undefined"]').count(), 0);
    assert.deepEqual(errors, []);
    console.log(
      "PASS: platform downloads, tab keyboard controls, command copy, theme/language persistence, Arabic RTL, and responsive widths 320–1440.",
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
