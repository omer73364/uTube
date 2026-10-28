# uTube website

Live: **[omer73364.github.io/uTube](https://omer73364.github.io/uTube/)**

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

The [Website on GitHub Pages workflow](../.github/workflows/website-pages.yml) builds and deploys `website/dist/` when website source, screenshots, the app icon, or the build script changes on `main`. It can also be started manually from GitHub Actions. Local preview commands do not publish.

Repository Pages settings use **GitHub Actions** as the publishing source. The `github-pages` environment records deployments. Build jobs only need Node.js; dependency installation is unnecessary.

## Update a release

Update the versioned release links and download filename builder in `index.html` and `app.js` together. Verify every target against the assets on that GitHub Release. Keep platform architecture labels, FFmpeg requirements, and signing status accurate. Do not show a platform as available until its files have been published and tested.

The build copies screenshots from `docs/images/` and the existing desktop SVG icon. English text is readable in the HTML source; `app.js` contains the Arabic catalog and dynamic download labels. Add any new translated key to both catalogs and preserve the terminal's left-to-right direction.

## App theme and screenshots

The website uses uTube's warm red/coral palette, rounded controls, and warm dark
surfaces. It offers separate desktop and signed Android downloads, with the
Android action selected automatically on Android browsers. English and Arabic
copy, RTL layout, theme preferences, and keyboard controls remain supported.

All three app versions have real screenshots. Click a screenshot to enlarge it;
press Escape or use the close button to return. Source captures and provenance
are documented in [the image guide](../docs/images/README.md). Desktop and CLI screenshots show the interface released in 2.3.0; Windows and macOS are published as explicitly approved unsigned previews with signing notices. The mobile images come from the signed 1.0.0 release.

Set `UTUBE_SITE_SCREENSHOTS=1` when running `npm run site:test` to save English,
Arabic/dark, and narrow-phone browser captures under ignored `website/test-results/`.
