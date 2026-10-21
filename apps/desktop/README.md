# uTube Desktop

A local desktop preview built with Electron, React, and the shared uTube download engine. Paste a video or playlist URL, choose MP4 or MP3, select playlist items, and follow downloads in the queue. Failed and cancelled jobs can be retried.

The desktop uses a compact download form and neutral colors. In **Settings**, choose light, dark, or system appearance and switch between English and العربية. Arabic mirrors the interface from right to left; links and file paths keep their natural direction. Preferences are saved between launches.

Search the queue by title or filter it to active, completed, or attention-needed downloads. Press Ctrl+L (Command+L on macOS) to return to the link input from any page. Completed downloads have separate **Open file** and **Show in folder** actions. Files open in your system's default media application; moved or deleted files produce a clear error.

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

Linux ZIP and Debian previews are written under `apps/desktop/out/make/`. Debian packaging needs `dpkg` and `fakeroot`. Nothing is uploaded by this command. FFmpeg remains a system dependency.

This preview has no partial-download resume or automatic updates. Windows and macOS packages have not been verified. The desktop package is private and does not change the public CLI version.
