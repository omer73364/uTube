<div align="center">

# uTube

**Download YouTube videos and playlists as MP4 or MP3, from your terminal or a desktop app.**

[![npm](https://img.shields.io/npm/v/utube-cli?style=flat-square&color=3769d6)](https://www.npmjs.com/package/utube-cli)
[![License: MIT](https://img.shields.io/badge/license-MIT-64748b?style=flat-square)](LICENSE)
[![Desktop: preview](https://img.shields.io/badge/desktop-preview-3769d6?style=flat-square)](#desktop-app)

[Website](https://omer73364.github.io/uTube/) · [CLI](#cli) · [Desktop](#desktop-app) · [How it works](#how-downloads-work) · [Troubleshooting](#troubleshooting)

<img src="docs/images/desktop-light.png" alt="uTube Desktop" width="720">

</div>

## Features

- **Video or audio**: save MP4 at the quality you choose, or extract 192 kbps MP3 with title metadata.
- **Playlists**: download everything or pick specific items. Each playlist gets its own folder, and one failed item never stops the rest.
- **Smart quality fallback**: if your requested resolution isn't available, uTube steps down to the best one that works and tells you what it saved.
- **Two interfaces**: an interactive CLI with scriptable flags, and an Electron desktop app with a persistent download queue.
- **Desktop extras**: searchable history, retry for interrupted downloads, light/dark themes, English and Arabic (full RTL).

## Quick start

**Requirements:** [Node.js](https://nodejs.org/) 20+ and [FFmpeg](https://ffmpeg.org/download.html) on your `PATH` (needed for MP3 conversion and merging HD video with audio).

```bash
npm install -g utube-cli@latest
utube
```

Paste a link, pick your options, done.

## CLI

Run `utube` with no arguments for the guided menu (`↑`/`↓` to move, `Enter` to confirm, `Space` to select playlist items), or pass flags when you already know what you want.

```bash
# Video, choose quality interactively
utube -u "https://youtu.be/jNQXAC9IVRw"

# Video at a specific resolution, no prompts
utube -u "https://youtu.be/jNQXAC9IVRw" -q 720p

# Audio only (MP3)
utube --audio -u "https://youtu.be/jNQXAC9IVRw"

# Playlist (interactive selection)
utube -u "https://www.youtube.com/playlist?list=YOUR_PLAYLIST_ID"

# Set and check the default download folder
utube --set-download-folder "~/Downloads"
utube --get-download-folder
```

| Option                         | Description                                |
| :----------------------------- | :----------------------------------------- |
| `-u <url>`                     | Video or playlist URL                      |
| `-q <quality>`                 | Resolution such as `480p`, `720p`, `1080p` |
| `-a`, `--audio`                | Download as MP3 (don't combine with `-q`)  |
| `--set-download-folder <path>` | Save a default destination                 |
| `--get-download-folder`        | Print the current destination              |
| `-v`, `--version`              | Print the installed version                |
| `-h`, `--help`                 | Show help                                  |

**Good to know**

- Non-interactive video downloads need both `-u` and `-q`. Audio needs `--audio -u` only.
- Playlist selection requires an interactive terminal.
- Without a saved folder, files go to the current directory.
- Settings live in `$XDG_CONFIG_HOME/utube-cli/settings.json` (fallback: `~/.config/utube-cli/settings.json`).
- `NO_COLOR` disables colors; piped output uses plain status lines.
- To update, rerun `npm install -g utube-cli@latest`.

## Desktop app

> **Preview:** v2.2.0 is the first public preview. Installers are unsigned and macOS builds are not notarized.

Download the installer for your platform from [GitHub Releases](https://github.com/omer73364/uTube/releases/tag/v2.2.0):

| Platform           | Formats                      |
| :----------------- | :--------------------------- |
| Linux (x64)        | `.deb`, `.AppImage`, `.zip`  |
| Windows (x64)      | `Setup.exe`, portable `.zip` |
| macOS (arm64, x64) | `.dmg`, `.zip`               |

Node.js is not required. The `.deb` installs FFmpeg automatically; for every other format, install [FFmpeg](https://ffmpeg.org/download.html) yourself. See the [installation guide](docs/distribution.md) for commands and checksum verification.

**Using it**

1. Paste a link and click **Find**.
2. Choose video or audio, a resolution, and which playlist items to keep.
3. Confirm the destination and start the download.
4. Use **Queue** to search, filter, cancel, retry, or open finished files.

**Your queue survives restarts.** History is stored locally in `downloads.json` in the app's user-data directory. Unfinished downloads come back as **Interrupted** and wait for you to hit **Retry** (retries restart from the beginning; nothing starts automatically). The queue holds up to 500 unfinished downloads, with completed history kept separately.

Shortcut: `Ctrl+L` / `⌘+L` focuses the link field, even on an Arabic keyboard layout.

<details>
<summary>Arabic · dark mode screenshot</summary>

<img src="docs/images/desktop-ar-dark.png" alt="uTube Desktop in Arabic with dark theme and RTL layout" width="720">

</details>

More details (storage, adding a language, local Linux packages) are in the [desktop guide](apps/desktop/README.md).

## How downloads work

**Quality.** uTube tries your requested resolution first, including alternate encodings and clients (a `720p` request can use a `720p60` stream). Only if that fails does it fall back to lower resolutions, highest first, and reports what was actually saved. Retries are quiet and the progress bar doesn't jump backward. uTube can't produce a resolution YouTube doesn't offer.

**Output.** Separate video and audio streams are merged into MP4 with FFmpeg. Audio-only downloads are 192 kbps MP3.

**Files.** The desktop app defaults to your system Downloads folder, the CLI to the current directory, and each keeps its own setting.

```
Downloads/
├── Video title [VIDEO_ID].mp4
├── Video title [VIDEO_ID].mp3
└── Playlist title/
    ├── #1_First video [VIDEO_ID].mp4
    └── #2_Second video [VIDEO_ID].mp4
```

Filenames are sanitized and include the video ID so identical titles don't collide. Existing files are **skipped, never overwritten**; to re-download at a different quality, move or rename the old file first.

## Troubleshooting

| Problem                            | What to try                                                                             |
| :--------------------------------- | :-------------------------------------------------------------------------------------- |
| `utube: command not found`         | Reopen your terminal and make sure npm's global bin directory is on your `PATH`.        |
| MP3 conversion or HD merging fails | Run `ffmpeg -version`. If it fails, install FFmpeg (restart the desktop app afterward). |
| A lower resolution was saved       | The requested one was unavailable or failed; the best working lower quality was used.   |
| A file was skipped                 | A file with that name already exists. Move or rename it and download again.             |
| Playlist selection doesn't work    | It needs an interactive terminal. Don't pipe the command, or use the desktop app.       |
| Download shows **Interrupted**     | Click **Retry**. It restarts from the beginning.                                        |
| YouTube rejects the download       | Retry later, try another quality, and confirm the video is public.                      |
| A file won't open                  | Check that it still exists and that your OS has a default app for MP4/MP3.              |

YouTube changes can break downloads. If you hit a reproducible bug, [open an issue](https://github.com/omer73364/uTube/issues) with your OS, interface (CLI or desktop), uTube and Node.js versions, the exact error, and a public example URL.

**Current limits:** Linux is the best-tested platform (Windows and macOS need more testing). No partial-download resume, authenticated downloads, or desktop auto-update. Live-stream recording is unverified.

## Development

```
apps/cli/       Terminal interface and command handling
apps/desktop/   Electron + React + TypeScript desktop app
packages/core/  Shared YouTube and download engine
website/        Project site (GitHub Pages)
```

Requires Node.js 22.13+, npm 10.9+, and FFmpeg.

```bash
git clone https://github.com/omer73364/uTube.git
cd uTube
npm ci

npm start                 # run the CLI
npm run desktop           # run the desktop app
npm test                  # core, CLI, media, queue, and history tests
npm run desktop:check     # desktop type checking
npm run desktop:test      # desktop integration tests (needs a graphical session)
npm run desktop:make      # build installers for your platform → apps/desktop/out/
npm run site:preview      # preview the website locally
```

Pass CLI arguments with `npm start -- -u "<url>" -q 360p`. Media tests use FFmpeg/FFprobe and are skipped if they're missing. Build the desktop app before running its integration tests. Debian packaging needs `dpkg` and `fakeroot`.

## Contributing

Bug reports, fixes, and translations are welcome. For larger changes, please open an issue first. To add a language, follow the [desktop guide](apps/desktop/README.md#adding-a-language). Release history is in the [changelog](CHANGELOG.md).

## Disclaimer

uTube is for saving content you have the right to download. Downloading may violate YouTube's Terms of Service or copyright law in your region; you are responsible for how you use this tool.

## License

[MIT](LICENSE) © Omer Anwar
