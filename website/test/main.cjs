const { app, BrowserWindow } = require("electron");
app.whenReady().then(() => {
  const window = new BrowserWindow({
    width: 1440,
    height: 980,
    webPreferences: { contextIsolation: true, sandbox: true },
  });
  window.loadURL(process.env.UTUBE_SITE_TEST_URL);
});
app.on("window-all-closed", () => app.quit());
