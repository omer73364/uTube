<div align="center">

# ▶ uTube CLI

**Download YouTube videos, playlists, and MP3s from your terminal.**

Interactive prompts · Quality selection · Readable progress · Automatic recovery

[![npm version](https://img.shields.io/npm/v/utube-cli?color=06b6d4&label=npm)](https://www.npmjs.com/package/utube-cli)
[![Node.js](https://img.shields.io/badge/Node.js-%E2%89%A520-22c55e)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/license-MIT-a78bfa)](LICENSE)

[Quick start](#-quick-start) · [Usage](#-usage) · [Reference](#-command-reference) · [Troubleshooting](#-troubleshooting) · [Changelog](CHANGELOG.md)

</div>

```text
  ╭──────────────────────────────────────────────────────╮
  │ ▶  uTube   /   v2.1.0                                │
  ├──────────────────────────────────────────────────────┤
  │ Your next watch, ready to go.                        │
  │                                                      │
  │ VIDEOS  /  PLAYLISTS  /  MP3                         │
  ╰──────────────────────────────────────────────────────╯

  ◆ What would you like to do?
  ❯ ↓  Download a video or playlist
    ♫  Download audio (MP3)
    ▣  Change download folder
    ↗  Exit
```

## ✨ Features

|                          |                                                                                         |
| ------------------------ | --------------------------------------------------------------------------------------- |
| 🧭 **Guided workflow**   | Paste a URL, pick a quality, download. Stay in the menu to start another.               |
| 📂 **Playlist control**  | Grab everything or select individual videos. Each playlist gets its own folder.         |
| 🎧 **MP3 mode**          | Convert videos or whole playlists to 192 kbps MP3 with the title embedded.              |
| 📊 **Clear progress**    | Separate video, audio, and merge stages with size, speed, and ETA when available.                      |
| 🛡️ **Built-in recovery** | Ranged transfers, bounded retries, refreshed links, and an alternate YouTube client.    |
| 🗂️ **Predictable files** | MP4 output, sanitized names with video IDs, skip-if-exists, and cleanup after failures. |

Built on [YouTube.js](https://github.com/LuanRT/YouTube.js).

## 🚀 Quick start

**Requirements**

- [Node.js](https://nodejs.org/) 20 or newer
- [FFmpeg](https://ffmpeg.org/download.html) on your `PATH`. It is needed to merge separate video and audio streams, and for every MP3 conversion.

Check that FFmpeg is available in the same terminal:

```sh
ffmpeg -version
```

**Install and run**

```sh
npm install -g utube-cli@latest
utube
```

**Update** by running the same install command, then check your version:

```sh
utube --version
```

**Try a download**

```sh
# Video: download at the requested quality
utube -u "https://youtu.be/jNQXAC9IVRw" -q 360p

# Playlist: paste your playlist URL to choose all or individual videos
utube -u "https://www.youtube.com/playlist?list=YOUR_PLAYLIST_ID"

# Audio: convert to MP3 (requires FFmpeg)
utube --audio -u "https://youtu.be/jNQXAC9IVRw"
```

Replace `YOUR_PLAYLIST_ID` with your playlist's ID. Playlist selection requires an interactive terminal.

> [!NOTE]
> Live downloads have been verified on Linux. Windows and macOS need broader testing.

## 📖 Usage

### Interactive menu

Run `utube` with no arguments, then:

1. Choose **Download a video or playlist**.
2. Paste the YouTube URL (typos can be corrected in the prompt).
3. For a playlist, download everything or pick individual entries.
4. Choose a quality and watch the progress.

When a playlist finishes, you get a summary of saved, skipped, and failed items. One failed video never stops the rest.

| Key       | Action                                  |
| --------- | --------------------------------------- |
| `↑` / `↓` | Move between choices                    |
| `Enter`   | Confirm or submit                       |
| `Space`   | Toggle a video in playlist selection    |
| `a`       | Toggle all videos in playlist selection |
| `Ctrl+C`  | Exit                                    |

### Download a video

```sh
# Choose the quality interactively
utube -u "https://youtu.be/jNQXAC9IVRw"

# Skip every prompt
utube -u "https://www.youtube.com/watch?v=jNQXAC9IVRw" -q 720p
```

Watch, Shorts, embed, live, mobile, and short URL formats are all recognized. Live URLs are accepted, but recording live streams is not a verified feature.

### Download a playlist

```sh
utube -u "https://www.youtube.com/playlist?list=YOUR_PLAYLIST_ID"
```

Or paste the full URL into the interactive menu.

> [!IMPORTANT]
> Playlist selection needs an interactive terminal. For non-interactive MP4 downloads, pass both `-u` and `-q`. For MP3, use `--audio -u` without `-q`.

### Download audio as MP3

Pick **Download audio (MP3)** in the menu, or use `--audio` (`-a`):

```sh
utube --audio -u "https://youtu.be/jNQXAC9IVRw"
utube --audio -u "https://www.youtube.com/playlist?list=YOUR_PLAYLIST_ID"
```

- Output is **192 kbps MP3** with the title stored in the metadata.
- Original audio-only streams are preferred. If only a combined stream exists, the audio is extracted from it.
- Playlist selection, retries, skipping, and cleanup all work in audio mode.
- Don't combine `--audio` with `-q`. `-q` selects video resolution, not audio bitrate.
- MP3 and MP4 files are tracked separately, so an existing video won't block its audio download.

### Choose where files go

By default, uTube saves to the current directory. Change it from the main menu, or from the command line:

```sh
utube --set-download-folder "~/Downloads"
utube --get-download-folder
```

Quote paths that contain spaces. Settings are stored in `$XDG_CONFIG_HOME/utube-cli/settings.json`, or `~/.config/utube-cli/settings.json` if `XDG_CONFIG_HOME` is unset.

## ⚙️ Command reference

| Option                         | Description                                 |
| ------------------------------ | ------------------------------------------- |
| `-u <url>`                     | Video or playlist URL                       |
| `-q <quality>`                 | Video quality, e.g. `480p`, `720p`, `1080p` |
| `-a`, `--audio`                | Download as MP3 (requires FFmpeg)           |
| `-v`, `--version`              | Print the installed version                 |
| `--set-download-folder <path>` | Save a default download folder              |
| `--get-download-folder`        | Print the current download folder           |
| `-h`, `--help`                 | Show help                                   |

Help, version, and folder settings work offline. Set `NO_COLOR` to disable colors. Piped output uses plain status lines with no animations.

## 🎞️ Quality and output

uTube saves **MP4 with audio**, or **MP3** when `--audio` is used. When YouTube serves video and audio separately, FFmpeg merges them.

- **Resolutions:** 480p, 720p, and 1080p are supported when YouTube offers them, and other available resolutions are accepted too. A `720p` request can use a `720p60` stream.
- **Retries:** uTube first tries other formats and alternate clients at your requested resolution. If it is unavailable or every attempt fails, uTube tries lower resolutions from highest to lowest and reports the quality successfully saved. Retries stay silent and keep the progress display steady.
- **Filenames** include the video ID:

```text
Downloads/
├── Me at the zoo [jNQXAC9IVRw].mp4
├── Me at the zoo [jNQXAC9IVRw].mp3
└── My playlist/
    ├── #1_First video [VIDEO_ID].mp4
    └── #2_Second video [VIDEO_ID].mp4
```

Video IDs distinguish videos with identical titles and help uTube recognize existing downloads. MP3 and MP4 versions have separate filenames.

**Limitations:** existing target files are skipped; a failed download restarts from scratch (no partial resume); authenticated downloads are not available.

To replace an earlier 360p fallback with HD, move or rename the existing MP4 before downloading again. The filename does not include resolution, so choosing a higher quality alone does not replace an existing file.

## 🩺 Troubleshooting

<details>
<summary><strong>Common problems and fixes</strong></summary>

<br>

| What you see                                      | What to try                                                                                           |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `utube` is not found                              | Reopen your terminal and make sure npm's global bin directory is on your `PATH`.                      |
| A download requires FFmpeg                        | Install FFmpeg and confirm `ffmpeg -version` works in the same terminal.                              |
| A lower quality was downloaded                    | The requested resolution was unavailable or failed across clients. uTube saved the best working lower quality. |
| A download is rejected or interrupted             | Transient failures are retried automatically. If it still fails, try later or choose another quality. |
| A playlist needs an interactive terminal          | Run the command directly, without piping its output.                                                  |
| A private, restricted, or unavailable video fails | Confirm the video is public. The CLI has no login or cookie options.                                  |

</details>

YouTube changes can still break downloads. If a problem persists, [open an issue](https://github.com/omer73364/uTube/issues) with your uTube and Node.js versions, OS, the exact error, and a public example URL if possible.

## ⬆️ Upgrading from 1.x

<details>
<summary><strong>What changed in v2</strong></summary>

<br>

- **Node.js 20+** is now required. Upgrade it before installing v2.
- Note your old download folder first, then set it again with `--set-download-folder`. Legacy package-local settings are read as a fallback, but npm upgrades can replace that file.
- Update manually with `npm install -g utube-cli@latest`. Startup no longer runs a global npm update.
- Filenames now include video IDs, so files from older versions may not be recognized and could be downloaded again.

</details>

See the [changelog](CHANGELOG.md) for the full release history.

## 🖥️ Desktop preview

The repository now includes a local desktop app with video previews, playlist selection, MP4 and MP3 downloads, and a queue with cancellation and retry controls.

With Node.js 22.13+ and npm 10.9+, run `npm ci` followed by `npm run desktop`. Install FFmpeg for MP3 conversion and video/audio merging. See the [desktop guide](apps/desktop/README.md) for testing, local Linux packages, and preview limitations.

## 🛠️ Development

Repository development uses Node.js 22.13+ and npm 10.9+ for desktop tooling. The published CLI continues to support Node.js 20+.

```sh
git clone https://github.com/omer73364/uTube.git
cd uTube
npm ci
npm test
npm start
```

Pass CLI arguments through npm with `--`:

```sh
npm start -- -u "https://youtu.be/jNQXAC9IVRw" -q 360p
```

The test suite covers argument handling, settings, playlist rendering and pagination, failed-download cleanup, ranged transfers, and retry behavior. With FFmpeg and FFprobe installed, extra media tests generate real MP3 files and verify 480p, 720p, and 1080p merging; they're skipped when those tools are missing. Live checks against YouTube are kept separate from automated tests.

## 🤝 Contributing

Bug reports and pull requests are welcome. For major changes, please open an issue first so we can agree on scope.

## 📄 License

[MIT](LICENSE) © OMER ANWAR
