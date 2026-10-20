# uTube website

A static English/Arabic product and download page, with real desktop screenshots, system-aware platform selection, saved appearance/language, keyboard-accessible download tabs, and a copyable CLI installation command.

## Preview locally

From the repository root:

```sh
npm run site:preview
```

Open `http://127.0.0.1:4173`. No dependency installation or framework build is needed for the site. Its generated files live in `website/dist/` and are ignored by Git.

## Browser checks

Use Node.js 22.13+ for the Electron browser tooling. After `npm ci`, run `npm run site:test` from the repository root in a graphical session. The checks use the existing Electron/Playwright tooling, start a temporary local server, and verify platform downloads, keyboard controls, command-copy behavior, saved language/theme, RTL, and mobile overflow. They close the browser and server afterward.

On a restricted Linux test host that cannot use Chromium’s sandbox, explicitly set `UTUBE_TEST_NO_SANDBOX=1` for this test command only.

## Build and host

```sh
npm run site:build
```

Serve the contents of `website/dist/` through any static host. Assets use relative paths, so the same build works at a domain root or a GitHub Pages project path such as `/uTube/`. No API keys, server, external fonts, or analytics are included. JavaScript enables language switching, platform selection, appearance, and copy; the no-script message links directly to GitHub Releases.

GitHub Pages is the intended public host. Publishing is separate from local development; no deployment workflow is enabled in this change.

## Update a release

Update the versioned release links and download filename builder in `index.html` and `app.js` together. Verify every target against the assets on that GitHub Release. Keep platform architecture labels, FFmpeg requirements, and signing status accurate. Do not show a platform as available until its files have been published and tested.

The build copies screenshots from `docs/images/` and the existing desktop SVG icon. English text is readable in the HTML source; `app.js` contains the Arabic catalog and dynamic download labels. Add any new translated key to both catalogs and preserve the terminal's left-to-right direction.
