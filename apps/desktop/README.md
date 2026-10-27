# uTube Desktop

A local desktop preview built with Electron, React, and the shared uTube download engine. Paste a video or playlist URL, choose MP4 or MP3, select playlist items, and follow downloads in the queue. Failed and cancelled jobs can be retried.

The desktop shares mobile’s red accents, rounded thumbnail cards, and warm dark theme. **Home** previews a link before showing format options; **Library** contains saved videos and audio, grouped by playlist; **Downloads** shows transfer progress and history. Bottom navigation keeps all three screens within reach. In **Settings**, choose light, dark, or system appearance and switch between English and العربية. Arabic mirrors the interface from right to left; links and file paths keep their natural direction. Preferences are saved between launches.

Search the library by video or playlist name. Search Downloads by title or filter it to active, completed, or attention-needed downloads. Press Ctrl+L (Command+L on macOS) to return to the link input from any page. Each thumbnail card has a three-dot options menu. Completed downloads offer **Open file** and **Show in folder**; active downloads can be cancelled, and failed or cancelled items can be retried. Format and quality appear beneath the title. The content area scrolls without a permanent scrollbar track. Files open in your system's default media application; moved or deleted files produce a clear error.

## Saved downloads

Videos and playlist items stay in the queue after closing, including their titles, playlist names, dates, quality, status, and file locations. Search by video or playlist name. Failed downloads remain available to retry, and completed files can still be opened after restarting.

Unfinished downloads reopen as **Interrupted** and wait for you to retry them. Retrying starts the transfer from the beginning; the app does not resume partial files or start downloads automatically on launch.

History is stored locally as `downloads.json` in the application's user-data directory, alongside its preferences. Writes are atomic, and closing waits for the latest state to be saved. Damaged history is preserved as a `downloads.json.backup-*` file, with a visible recovery warning. The 500-item limit applies to unfinished downloads, so completed history does not prevent adding new videos.

## Adding a language

UI strings live in `src/locales.ts`. Register a language code, native name, and text direction in `languages`, add its dictionary to `dictionaries`, and type it as `Record<TextKey, string>` so missing translations are caught by TypeScript. Language types, validation, and the picker use the same registry. Keep placeholders such as `{count}` and `{title}` intact. Known download errors are translated; upstream or operating-system diagnostics may retain their original wording.

## Development

Use Node.js 22.13 or newer and npm 10.9 or newer for desktop tooling. Install FFmpeg and FFprobe on your PATH for audio conversion, merging, and media tests. The published CLI still supports Node.js 20.

Run these commands from the repository root:

```sh
npm ci
npm run desktop
```

The renderer has no Node.js access. A narrow preload API connects it to the main process; YouTube requests and conversions run in a separate utility process.

## Renderer checks without building

To inspect UI changes without packaging or compiling an Electron app, run the
renderer development server from `apps/desktop`:

```sh
npx vite --config vite.renderer.config.mjs --host 127.0.0.1 --port 4184 --strictPort
```

In another terminal, from the repository root:

```sh
npm run test:renderer --workspace=@utube/desktop
```

This opens a disposable Electron window with sample records and a simulated
preload API. It checks navigation, library search and playlist groups, file-open
requests, queue progress, preview submission, Arabic, dark mode, keyboard focus,
and narrow layouts. It does not touch real history or download media. It requires
a graphical session. Use `UTUBE_RENDERER_URL` to test another development port.
Full desktop tests below still require a newly packaged app.

## Checks

```sh
npm test
npm run desktop:check
npm run desktop:package
npm run desktop:test
npm run desktop:test:packaged
```

The desktop tests require a graphical session and FFmpeg/FFprobe. They use generated media and temporary settings to verify previews, playlist selection, MP4/MP3 downloads, failures, retries, cancellation, shutdown, themes, Arabic RTL, saved preferences, and file actions. Package first so the tests can load the built application. On restricted development hosts that cannot start Chromium's sandbox, tests accept `UTUBE_TEST_NO_SANDBOX=1`; normal application startup keeps its sandbox enabled.

The packaged check copies the actual installed app outside the repository and starts its production worker. It loads the real YouTube client, blocks network access in the test harness, and fails if any runtime dependency is missing. This catches packaging problems that generated-media tests cannot detect. `UTUBE_PACKAGED_APP` can point to another extracted package directory, including an extracted AppImage.

## Local packages

```sh
npm run desktop:make
```

Linux ZIP and Debian previews are written under `apps/desktop/out/make/`. Debian packaging needs `dpkg` and `fakeroot`. Nothing is uploaded by this command. The DEB still declares FFmpeg as a system dependency; source builds also offer the optional per-user download described below.

This preview has no partial-download resume or automatic updates. macOS ARM64 and Intel packages under Rosetta have been verified locally. Windows and physical Intel Macs still need manual verification. The desktop package is private and does not change the public CLI version.

### Optional FFmpeg download

Desktop 2.4.0 offers **Settings → Audio & video processing → Download FFmpeg**.
This downloads a pinned third-party executable directly from
[ffmpeg-static](https://github.com/eugeneware/ffmpeg-static/releases/tag/b6.1.1),
checks its SHA-256 digest before execution, and saves it inside uTube's user-data
folder with the upstream license and build/source notes. Nothing is bundled in
installers, added to PATH, or installed with administrator privileges. Existing
system FFmpeg takes priority; `UTUBE_FFMPEG` remains an authoritative override.
Downloads can be cancelled and retried. Newly started jobs use the tool without
restarting the app. Windows x64, macOS x64/ARM64, and Linux x64/ARM64 are supported;
other targets retain manual installation.

The upstream release label is not a promise that every platform has the same
FFmpeg version. For example, its Linux x64 binary reports 7.0.2. The pinned asset
manifest must be reviewed when updating providers or adopting newer builds;
hashes verify the selected files, not the absence of software vulnerabilities.
Desktop versions before 2.4.0 do not include this setup UI.

### X / Twitter videos

Paste a public `x.com` or `twitter.com` post into the same link field used for
YouTube. Preview the title, author, thumbnail, and actual MP4 resolutions. The
highest available X resolution is selected by default. Posts with several videos
use the existing selection list; a `/video/2` link selects just the second video.
Native MP4 downloads include audio and do not need FFmpeg. MP3 extraction uses
FFmpeg, with the same queue, progress, cancel, retry, history, and file actions as
YouTube. Portrait resolutions use the shorter edge, such as 720p for 720×900.

This supports public native MP4 videos exposed by X's embedded-post endpoint.
Private, deleted, restricted, or sign-in-only posts, photos, GIFs, live broadcasts,
and externally hosted videos are not supported. No account or cookies are read.
X may rate-limit requests or change this endpoint; errors remain retryable from
the queue. Android supports the same public X post flow through its native background downloader.

### Build an Intel macOS app on Apple Silicon

Electron Forge can cross-package the Intel runtime from this Mac:

```sh
npm run package --workspace=@utube/desktop -- --arch=x64
codesign --force --deep --sign - apps/desktop/out/uTube-darwin-x64/uTube.app
npm run make --workspace=@utube/desktop -- --arch=x64 --skip-package
node scripts/collect-release.mjs --arch=x64
```

The app is in `out/uTube-darwin-x64/`, and versioned DMG/ZIP files with SHA-256
checksums are in `release-artifacts/` at the repository root. The collector selects
the target architecture even when ARM64 builds are present. Use `--arch=arm64` for
Apple Silicon. Intel apps can be smoke-tested under Rosetta on Apple Silicon;
this does not replace testing on a physical Intel Mac. The signing command applies a local ad-hoc signature; these builds are not
Apple-notarized or signed with a Developer ID certificate.

### Instagram (next release)

Paste a public Instagram Reel or video-post link to preview and download it.
Video carousels support selecting individual videos. MP4 and MP3 use the existing
download flow. Private posts, Stories, live streams, and photos are not supported;
Instagram may limit access without signing in.

### Facebook (next release)

Paste a public Facebook video, Reel, share link, or `fb.watch` link. Choose SD/HD
(or a resolution when available) and save MP4 or MP3 through the existing download
flow. Private/login-restricted videos, live streams, photos, and streaming-only
videos are not supported.
