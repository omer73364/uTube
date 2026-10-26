const { _electron: electron } = require("playwright");
const { expect } = require("@playwright/test");
const fs = require("node:fs/promises");
(async () => {
  const prefs = await fs.mkdtemp("/tmp/utube-startup-test-");
  const env = {
    ...process.env,
    UTUBE_TEST_USER_DATA: prefs,
    UTUBE_FFMPEG: "/missing/ffmpeg",
  };
  delete env.ELECTRON_RUN_AS_NODE;
  const app = await electron.launch({
    executablePath: require("electron"),
    args: ["--no-sandbox", require("node:path").resolve(__dirname, "..")],
    env,
  });
  try {
    const p = await app.firstWindow();
    await expect(
      p.getByRole("dialog", { name: "Enable MP3 and HD downloads?" }),
    ).toBeVisible({ timeout: 20000 });
    await p.getByRole("button", { name: "Not now", exact: true }).click();
    await p
      .getByRole("button", { name: "FFmpeg not found", exact: true })
      .click();
    await expect(
      p.getByRole("heading", { name: "Audio & video processing" }),
    ).toBeInViewport();
    await expect(
      p.getByRole("heading", { name: "Audio & video processing" }),
    ).toBeFocused();
    await p.getByRole("button", { name: "Home", exact: true }).click();
    await expect(
      p.getByRole("dialog", { name: "Enable MP3 and HD downloads?" }),
    ).not.toBeVisible();
    await p.getByRole("button", { name: "Settings", exact: true }).click();
    await p.getByRole("radio", { name: "العربية", exact: true }).click();
    await p
      .getByRole("button", { name: "لم يُعثر على FFmpeg", exact: true })
      .click();
    await expect(
      p.getByRole("heading", { name: "معالجة الصوت والفيديو" }),
    ).toBeFocused();
    console.log(
      "PASS: startup offer, dismiss once, clickable missing-tool status, direct section focus, Arabic link.",
    );
  } finally {
    await app.close();
    await fs.rm(prefs, { recursive: true, force: true });
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
