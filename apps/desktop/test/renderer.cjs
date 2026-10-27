const jobAction = require("./job-action.cjs");
// UI-only check against a running Vite dev server; no app build or downloads.
const { _electron: electron } = require("playwright");
const { expect } = require("@playwright/test");
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
(async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "utube-renderer-"));
  const url = process.env.UTUBE_RENDERER_URL || "http://127.0.0.1:4184/";
  const jobs = [
    {
      id: "one",
      videoId: "jNQXAC9IVRw",
      title: "Me at the zoo",
      status: "saved",
      loaded: 400,
      total: 400,
      quality: "720p",
      audio: false,
      playlistTitle: "First moments",
      createdAt: 1792700000000,
    },
    {
      id: "two",
      videoId: "XIdA1AZ4zYI",
      title: "A little music",
      status: "saved",
      loaded: 200,
      audio: true,
      playlistTitle: "First moments",
      createdAt: 1792700000000,
    },
    {
      id: "three",
      videoId: "abcdefghijk",
      title: "Next adventure",
      status: "running",
      stage: "video",
      loaded: 50,
      total: 100,
      quality: "1080p",
      audio: false,
    },
  ];
  await fs.writeFile(
    path.join(root, "preload.cjs"),
    `
    const { contextBridge } = require('electron');
    let prefs = { language: 'en', theme: 'light', resolvedTheme: 'light', folder: '/Downloads/uTube', version: '2.2.0', ffmpeg: true };
    let jobs = ${JSON.stringify(jobs)};
    let listener = () => {};
    contextBridge.exposeInMainWorld('__utubeTest', { state: () => ({ opened: globalThis.lastOpened, request: globalThis.lastEnqueue }) });
    contextBridge.exposeInMainWorld('utube', {
      settings: async () => prefs, jobs: async () => jobs,
      preferences: async patch => { prefs = { ...prefs, ...patch, resolvedTheme: patch.theme === 'dark' ? 'dark' : patch.theme ? 'light' : prefs.resolvedTheme }; return prefs; },
      onJobs: fn => { listener = fn; return () => {}; }, onTheme: () => () => {}, onHistoryError: () => () => {},
      inspect: async () => ({ type: 'playlist', id: 'PLtest', title: 'First moments', items: [{ id: 'jNQXAC9IVRw', title: 'Me at the zoo' }, { id: 'XIdA1AZ4zYI', title: 'A little music' }] }),
      enqueue: async request => { globalThis.lastEnqueue = request; return ['new']; },
      openFile: async id => { globalThis.lastOpened = id; }, openFolder: async () => {}, chooseFolder: async () => '/Downloads/uTube/A longer folder name for saved videos and playlists',
      cancel: async id => { jobs = jobs.map(j => j.id === id ? { ...j, status: 'cancelled' } : j); listener(jobs); }, retry: async () => {},
    });
  `,
  );
  await fs.writeFile(
    path.join(root, "main.cjs"),
    `
    const { app, BrowserWindow } = require('electron');
    app.whenReady().then(() => { const window = new BrowserWindow({ width: 1180, height: 850, webPreferences: { preload: ${JSON.stringify(path.join(root, "preload.cjs"))}, contextIsolation: true, sandbox: false } }); window.loadURL(${JSON.stringify(url)}); });
  `,
  );
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  const app = await electron.launch({
    executablePath: require("electron"),
    args: ["--no-sandbox", path.join(root, "main.cjs")],
    env,
  });
  try {
    const page = await app.firstWindow();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const aligned = async (selector) => {
      const heading = await page.locator(".page-heading").boundingBox();
      for (const card of await page.locator(selector).all()) {
        const bounds = await card.boundingBox();
        expect(Math.abs(bounds.x - heading.x)).toBeLessThan(1);
        expect(Math.abs(bounds.width - heading.width)).toBeLessThan(1);
      }
    };
    await expect(
      page.getByRole("heading", { name: "Download from YouTube, X, Instagram, or Facebook" }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Audio only" })).toHaveCount(
      0,
    );
    await aligned(".download-card, .queue-card, .job");
    await page.screenshot({
      path: "/tmp/utube-desktop-red-home.png",
      fullPage: true,
    });
    await page.getByRole("button", { name: "Library", exact: true }).click();
    await expect(page.getByTestId("job")).toHaveCount(2);
    await aligned(".library-toolbar, .library-list .job");
    const options = page.getByRole("button", {
      name: "Options for Me at the zoo",
      exact: true,
    });
    await options.focus();
    await page.keyboard.press("Enter");
    await expect(
      page.getByRole("menuitem", { name: "Open Me at the zoo", exact: true }),
    ).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(
      page.getByRole("menuitem", {
        name: "Show Me at the zoo in folder",
        exact: true,
      }),
    ).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("menu")).toHaveCount(0);
    await jobAction(page, "Open Me at the zoo");
    const videoCard = page.getByTestId("job").filter({
      has: page.getByRole("heading", { name: "Me at the zoo", exact: true }),
    });
    const titleBounds = await videoCard.locator("h3").boundingBox();
    const qualityBounds = await videoCard.locator(".format-tag").boundingBox();
    expect(qualityBounds.y).toBeGreaterThan(titleBounds.y);
    await expect(videoCard.locator(".format-tag")).toHaveText("MP4 · 720p");
    expect(
      await page
        .locator(".page-content")
        .evaluate((element) => getComputedStyle(element).scrollbarWidth),
    ).toBe("none");
    expect(await page.evaluate(() => window.__utubeTest.state().opened)).toBe(
      "one",
    );
    await page.getByRole("textbox", { name: "Search downloads" }).fill("music");
    await expect(page.getByTestId("job")).toHaveCount(1);
    await page.getByRole("button", { name: "Playlists", exact: true }).click();
    await page.getByRole("button", { name: /First moments/ }).click();
    await expect(page.getByTestId("job")).toHaveCount(2);
    await page.screenshot({
      path: "/tmp/utube-desktop-red-library.png",
      fullPage: true,
    });
    await page.getByRole("button", { name: /^Downloads/ }).click();
    await page
      .getByRole("group", { name: "Filter downloads" })
      .getByRole("button", { name: /^Active/ })
      .click();
    await expect(page.getByTestId("job")).toHaveCount(1);
    await expect(page.getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      "50",
    );
    await page.getByRole("button", { name: "Settings", exact: true }).click();
    await aligned(".settings-section");
    await page
      .getByRole("button", { name: "Choose folder", exact: true })
      .click();
    await expect(page.locator(".destination strong")).toHaveText(
      "/Downloads/uTube/A longer folder name for saved videos and playlists",
    );
    await page.getByRole("radio", { name: "Dark", exact: true }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await page.getByRole("radio", { name: "العربية", exact: true }).click();
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await page.locator(".destination").scrollIntoViewIfNeeded();
    const destinationBounds = await page.locator(".destination").boundingBox();
    const navigationBounds = await page.getByRole("navigation").boundingBox();
    const contentBounds = await page.locator(".page-content").boundingBox();
    expect(navigationBounds.y).toBeGreaterThan(contentBounds.y);
    expect(navigationBounds.y + navigationBounds.height).toBeLessThanOrEqual(
      contentBounds.y + contentBounds.height,
    );
    expect(destinationBounds.y + destinationBounds.height).toBeLessThan(
      navigationBounds.y,
    );
    await page.screenshot({
      path: "/tmp/utube-desktop-red-ar-settings.png",
      fullPage: true,
    });
    await page.getByRole("button", { name: "الرئيسية", exact: true }).click();
    await page
      .getByRole("textbox", { name: "رابط يوتيوب" })
      .fill("https://youtu.be/jNQXAC9IVRw");
    await page.getByRole("button", { name: "عرض الرابط", exact: true }).click();
    await expect(page.getByTestId("source-preview")).toContainText(
      "First moments",
    );
    await page.getByRole("button", { name: /صوت فقط/ }).click();
    await page
      .getByRole("button", { name: "تنزيل المقاطع الصوتية (2)", exact: true })
      .click();
    expect(
      await page.evaluate(() => window.__utubeTest.state().request),
    ).toMatchObject({
      audio: true,
      playlistTitle: "First moments",
      items: [{ id: "jNQXAC9IVRw" }, { id: "XIdA1AZ4zYI" }],
    });
    await expect(
      page.getByRole("textbox", { name: "رابط يوتيوب" }),
    ).toBeVisible();
    await page.keyboard.press("Control+l");
    await expect(
      page.getByRole("textbox", { name: "رابط يوتيوب" }),
    ).toBeFocused();
    for (const width of [1180, 850, 600, 400]) {
      await page.setViewportSize({ width, height: 740 });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    }
    await page.getByRole("button", { name: "الإعدادات", exact: true }).click();
    await aligned(".settings-section");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    const folder = await page.locator(".destination").boundingBox();
    const change = await page.locator(".destination-change").boundingBox();
    expect(change.x).toBeGreaterThanOrEqual(folder.x);
    expect(change.x + change.width).toBeLessThanOrEqual(
      folder.x + folder.width,
    );
    expect(errors).toEqual([]);
    console.log(
      "PASS: renderer navigation, saved library, playlist groups, search, open action, queue progress, Arabic/dark settings, playlist submission, shortcut, responsive layout.",
    );
  } finally {
    await app.close();
    await fs.rm(root, { recursive: true, force: true });
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
