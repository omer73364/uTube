<div align="center">

# uTube

**Build your offline collection.**

Save a tutorial for later, keep a playlist together, or take your favorite tracks offline. Choose what matters to you; uTube takes care of the download.

[![npm](https://img.shields.io/npm/v/utube-cli?style=flat-square&color=3769d6)](https://www.npmjs.com/package/utube-cli)
[![License: MIT](https://img.shields.io/badge/license-MIT-64748b?style=flat-square)](LICENSE)
[![Desktop: preview](https://img.shields.io/badge/desktop-preview-3769d6?style=flat-square)](#desktop)

[CLI](#cli) · [Desktop](#desktop) · [Download behavior](#download-behavior) · [Development](#development) · [Troubleshooting](#troubleshooting)

</div>

## Make room for your favorites

**Keep the video. Or just the audio.** Save MP4 videos in your preferred quality, or turn a video or playlist into 192 kbps MP3s.

**Bring the whole playlist.** Download every item or choose a few. Playlist downloads stay together in their own folder.

**Find it again.** The desktop remembers your downloads after you close it. Search your history and open a saved file straight from the app.

### Desktop, at your pace

Preview a video, choose your quality, and follow your downloads in one place. Make it yours with light and dark themes, English or Arabic, and a layout that feels natural in either language.

[Explore the desktop preview ↓](#desktop)

### Terminal, on your terms

Follow the guided menu, or use a command when you already know what you want. Download videos, select playlist items, and save MP3s without leaving your terminal.

[Install the CLI ↓](#cli)

> [!NOTE]
> Desktop 2.2.0 is the first public preview. Get the platform installers from [GitHub Releases](https://github.com/omer73364/uTube/releases/tag/v2.2.0), or use the CLI from npm. See the [installation guide](docs/distribution.md) for requirements and platform details.

## CLI

### Install and run

Install [Node.js](https://nodejs.org/) 20 or newer. Install [FFmpeg](https://ffmpeg.org/download.html) on your `PATH` for MP3 conversion and video/audio merging.

```sh
npm install -g utube-cli@latest
utube
```

Running `utube` opens the interactive menu:

```text
◆ What would you like to do?
❯ ↓  Download a video or playlist
  ♫  Download audio (MP3)
  ▣  Change download folder
  ↗  Exit
```

Paste a link, select playlist items if needed, and choose a video quality. Use `↑` / `↓` to navigate, `Enter` to confirm, and `Space` to select playlist items. A playlist summary shows saved, skipped, and failed downloads; one failed item does not stop the rest.

### Examples

```sh
# Video: choose quality interactively
utube -u "https://youtu.be/jNQXAC9IVRw"

# Video: request a resolution without prompts
utube -u "https://youtu.be/jNQXAC9IVRw" -q 360p

# Playlist: choose all or specific videos
utube -u "https://www.youtube.com/playlist?list=YOUR_PLAYLIST_ID"

# Audio: save a video as MP3
utube --audio -u "https://youtu.be/jNQXAC9IVRw"

# Audio: select tracks from a playlist
utube --audio -u "https://www.youtube.com/playlist?list=YOUR_PLAYLIST_ID"

# Remember a download folder
utube --set-download-folder "~/Downloads"
utube --get-download-folder
```

Replace `YOUR_PLAYLIST_ID` with your playlist's ID. Playlist selection requires an interactive terminal. For a non-interactive video download, provide `-u` and `-q`; for audio, provide `--audio -u` without `-q`.

### Command reference

| Option                         | Description                                              |
| :----------------------------- | :------------------------------------------------------- |
| `-u <url>`                     | Video or playlist URL                                    |
| `-q <quality>`                 | Requested resolution, such as `480p`, `720p`, or `1080p` |
| `-a`, `--audio`                | Download as MP3; do not combine with `-q`                |
| `--set-download-folder <path>` | Save a default destination                               |
| `--get-download-folder`        | Print the current destination                            |
| `-v`, `--version`              | Print the installed version                              |
| `-h`, `--help`                 | Show help                                                |

Without a saved destination, the CLI uses the current directory. Settings live in `$XDG_CONFIG_HOME/utube-cli/settings.json`, falling back to `~/.config/utube-cli/settings.json`. Quote paths containing spaces.

Help, version, and folder settings work offline. `NO_COLOR` disables terminal colors; piped output uses plain status lines.

To update, run `npm install -g utube-cli@latest` again, then check `utube --version`.

## Desktop

A compact download form, a queue you can come back to, and direct access to your files.

![uTube Desktop in English with the light theme](docs/images/desktop-light.png)

### Download and install

Get **uTube Desktop 2.2.0** from [GitHub Releases](https://github.com/omer73364/uTube/releases/tag/v2.2.0):

- **Linux:** Debian/Ubuntu `.deb`, portable `.AppImage`, or `.zip` (x64).
- **Windows:** `Setup.exe` or portable `.zip` (x64).
- **macOS:** `.dmg` or `.zip` for Apple Silicon (arm64) and Intel (x64).

Desktop installers include the app runtime: Node.js and npm are not needed. The Debian package installs FFmpeg through apt. Other downloads need [FFmpeg](https://ffmpeg.org/download.html) installed separately for MP3 conversion and HD video merging. These preview builds are unsigned and macOS builds are not notarized.

See the [installation guide](docs/distribution.md) for installation commands and checksum verification.

### Run from source

Use **Node.js 22.13+**, **npm 10.9+**, and FFmpeg on your `PATH`.

```sh
git clone https://github.com/omer73364/uTube.git
cd uTube
npm ci
npm run desktop
```

1. Paste a video or playlist link and select **Find**.
2. Choose video or audio, a resolution, and playlist items.
3. Check the destination, then start the download.
4. Use **Queue** to search, filter, cancel, retry, or open completed files.

### Made for everyday downloads

- **Your collection stays with you.** Videos, playlist names, dates, quality, and file locations survive app restarts.
- **Less searching, more watching.** Search by video or playlist name, filter by status, then open the file or its folder.
- **A familiar workspace.** Your folder, language, and theme are remembered. Choose light, dark, or system appearance.
- **Comfortable in Arabic and English.** Arabic has a mirrored right-to-left layout, while links and file paths stay readable.
- **One shortcut to the next download.** `Ctrl+L` / `⌘+L` focuses the link input, including with an Arabic keyboard layout.

<details>
<summary><strong>Arabic · Dark mode</strong></summary>

![uTube Desktop in Arabic with the dark theme and RTL layout](docs/images/desktop-ar-dark.png)

</details>

### Close it. Come back later.

The queue is stored locally in `downloads.json` inside the application's user-data directory, alongside its preferences. Closing waits for the latest history to be written. Saved files remain available through **Open file** and **Show in folder** after restarting.

Unfinished downloads return as **Interrupted** and wait for you to select **Retry**. Retries start from the beginning; opening the app does not automatically start transfers. The queue allows up to 500 unfinished downloads, while completed history is retained separately from that limit.

See the [desktop guide](apps/desktop/README.md) for storage details, adding languages, testing, and local Linux packages. The [installation guide](docs/distribution.md) covers ready-to-install downloads.

## Download behavior

### Quality and recovery

- **Requested quality first.** The current engine tries matching encodings and alternate clients at your chosen resolution. A `720p` request can use a `720p60` stream.
- **Best working fallback.** Only after the requested resolution is unavailable or exhausted does it try lower resolutions, from highest to lowest. The successfully saved quality is reported.
- **Quiet retries.** Automatic recovery happens without repeated warnings or a progress bar jumping back to zero. The display holds its position until a new attempt catches up.
- **Audio included.** Separate video and audio streams are merged into MP4 with FFmpeg. MP3 output uses 192 kbps audio with title metadata.

Available resolutions depend on the video. Requesting 1080p cannot create a resolution YouTube does not offer.

### Files and destinations

The desktop starts with your system Downloads folder; the CLI starts with the current directory. Their preferences are separate. Playlists get their own subfolder.

```text
Downloads/
├── Video title [VIDEO_ID].mp4
├── Video title [VIDEO_ID].mp3
└── Playlist title/
    ├── #1_First video [VIDEO_ID].mp4
    └── #2_Second video [VIDEO_ID].mp4
```

Names are sanitized, and video IDs distinguish videos with identical titles. MP3 and MP4 files are tracked separately. Existing target files are skipped rather than overwritten: to replace an older low-quality copy, move or rename it before downloading again.

## Website

The [project website](website/README.md) introduces the desktop and CLI with English/Arabic content, light/dark appearance, real app previews, and platform-specific installer links.

Preview it locally with `npm run site:preview`, or generate a static build with `npm run site:build`. Public hosting is a separate step.

## Development

The repository contains three parts:

```text
apps/cli/       Terminal interface and command handling
apps/desktop/   Electron, React, and TypeScript desktop app
packages/core/  Shared YouTube and download engine
```

Use Node.js 22.13+ and npm 10.9+ for repository development. The published CLI runtime requirement remains Node.js 20+.

```sh
npm ci

# Run either interface
npm start
npm run desktop

# Pass arguments to the CLI
npm start -- -u "https://youtu.be/jNQXAC9IVRw" -q 360p

# Core, CLI, media, queue, and history tests
npm test

# Desktop type checking and integration tests
npm run desktop:check
npm run desktop:package
npm run desktop:test

# Build local installers for the current platform
npm run desktop:make
```

Media tests use FFmpeg and FFprobe to generate and inspect real output; those checks are skipped if the tools are missing. Desktop integration tests require a graphical session and cover downloads, playlists, recovery, file actions, themes, Arabic/RTL, and history across restarts. Build the desktop before running them.

Local desktop artifacts are written under `apps/desktop/out/`. Debian packaging requires `dpkg` and `fakeroot`. Packaging commands create local files and do not publish them.

## Troubleshooting

| Problem                                     | What to check                                                                                           |
| :------------------------------------------ | :------------------------------------------------------------------------------------------------------ |
| `utube` is not found                        | Reopen the terminal and check that npm's global bin directory is on your `PATH`.                        |
| MP3 conversion or HD merging is unavailable | Confirm `ffmpeg -version` works. Restart the desktop after installing FFmpeg.                           |
| A lower resolution was saved                | The requested resolution was unavailable or failed; the engine selected the best working lower quality. |
| An older file is skipped                    | Move or rename it before downloading again at a different quality.                                      |
| A playlist requires a terminal              | CLI playlist selection is interactive. Run it without piping, or use the desktop.                       |
| A file will not open                        | Check that it still exists and that your OS has a default app for MP4 or MP3.                           |
| A transfer returns as Interrupted           | Select Retry. It starts again from the beginning.                                                       |
| YouTube rejects a download                  | Retry later, try another available quality, and confirm the video is public.                            |

YouTube changes can break downloads. For a reproducible problem, [open an issue](https://github.com/omer73364/uTube/issues) with your OS, interface, uTube and Node.js versions, exact error, and a public example URL if possible.

### Current limits

Linux is the verified platform; Windows and macOS need broader testing. FFmpeg is a system dependency, installed automatically by the Debian package. Partial-download resume, authenticated downloads, and automatic desktop updates are not available. Live-stream recording is not verified, even though live-style URLs are recognized.

## Contributing

Bug reports, fixes, and translations are welcome. For larger changes, open an issue first to discuss scope. The [desktop guide](apps/desktop/README.md#adding-a-language) explains how to add a language.

See [CHANGELOG.md](CHANGELOG.md) for release history and unreleased changes.

## License

[MIT](LICENSE) © OMER ANWAR
