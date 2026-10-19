<div align="center">

# ▶ uTube CLI

**YouTube downloads, right from your terminal.**

An interactive CLI for videos and playlists, with quality selection,<br>
clear progress, and a download folder that stays yours.

[![npm version](https://img.shields.io/npm/v/utube-cli?color=06b6d4&label=npm)](https://www.npmjs.com/package/utube-cli)
[![Node.js](https://img.shields.io/badge/Node.js-%E2%89%A520-22c55e)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/license-MIT-a78bfa)](LICENSE)

[Get started](#get-started) · [Usage](#usage) · [Troubleshooting](#troubleshooting) · [Release notes](CHANGELOG.md)

</div>

```text
  ╭──────────────────────────────────────────────────────╮
  │ ▶  uTube   /   v2.0.0                                │
  ├──────────────────────────────────────────────────────┤
  │ Your next watch, ready to go.                        │
  │                                                      │
  │ VIDEOS  /  PLAYLISTS  /  MP4                         │
  ╰──────────────────────────────────────────────────────╯

  ◆ What would you like to do?
  ❯ ↓  Download a video or playlist
    ▣  Change download folder
    ↗  Exit
```

## Why uTube?

- **A guided workflow.** Paste a URL, choose a quality, and download. Stay in the menu to start another.
- **Playlists on your terms.** Grab every video or select only the ones you want, organized into a playlist folder.
- **Progress you can read.** Separate video, audio, and merging stages, with size, speed, and ETA when available.
- **Recovery built in.** Small ranged transfers, bounded retries, refreshed links, and an alternate YouTube client when streams are rejected.
- **Predictable files.** MP4 output, sanitized filenames with video IDs, existing-file checks, and cleanup after failed downloads.

Built with [YouTube.js](https://github.com/LuanRT/YouTube.js). **Version 2.0.0** revives the project with a new interface and repaired video and playlist downloads.

## Get started

You need **Node.js 20 or newer** and npm. Install [FFmpeg](https://ffmpeg.org/download.html) and make sure `ffmpeg` is on your PATH to download qualities with separate video and audio streams.

```sh
npm install -g utube-cli@latest
utube
```

Already have uTube? Run the same installation command to update, then check your version:

```sh
utube --version
```

Live downloads have been verified on Linux. Windows and macOS need broader testing.

## Usage

### Let the menu guide you

Run `utube` without arguments:

1. Choose **Download a video or playlist**.
2. Paste the YouTube URL.
3. For a playlist, choose all videos or pick individual entries.
4. Choose a quality and follow the download progress.

Invalid URLs can be corrected in the prompt. When a playlist finishes, the summary shows saved, skipped, and failed items. One failed video does not stop the remaining selected downloads.

| Key | Action |
| --- | --- |
| `↑` / `↓` | Move between choices |
| `Enter` | Confirm a choice or submit input |
| `Space` | Toggle a video in playlist selection |
| `a` | Toggle all videos in playlist selection |
| `Ctrl+C` | Exit |

### Go straight to a video

Pass a URL to skip the URL prompt and choose a quality interactively:

```sh
utube -u "https://youtu.be/jNQXAC9IVRw"
```

Pass both URL and quality to skip those prompts:

```sh
utube -u "https://www.youtube.com/watch?v=jNQXAC9IVRw" -q 720p
```

Watch, Shorts, embed, live, mobile, and shortened YouTube URL formats are recognized. A live URL is accepted, but live-stream recording is not a verified feature.

### Pick videos from a playlist

```sh
utube -u "https://www.youtube.com/playlist?list=YOUR_PLAYLIST_ID"
```

Replace `YOUR_PLAYLIST_ID` with your playlist ID. You can also paste the complete URL into the interactive menu.

**Playlist selection needs an interactive terminal.** For noninteractive single-video downloads, provide both `-u` and `-q`.

### Choose where downloads go

By default, uTube downloads into your current directory. Change the folder from the main menu or save one with:

```sh
utube --set-download-folder "~/Downloads"
utube --get-download-folder
```

Quote paths containing spaces. Playlists get their own subfolder inside the download directory.

Settings live in `$XDG_CONFIG_HOME/utube-cli/settings.json`, or `~/.config/utube-cli/settings.json` when `XDG_CONFIG_HOME` is unset.

### Command reference

| Option | What it does |
| --- | --- |
| `-u <url>` | Use a video or playlist URL |
| `-q <quality>` | Request a quality, such as `360p` or `720p` |
| `-v`, `--version` | Print the installed version |
| `--set-download-folder <path>` | Save a default download folder |
| `--get-download-folder` | Print the current download folder |
| `-h`, `--help` | Show command help |

Help, version, and folder settings work offline. Set the `NO_COLOR` environment variable to disable app colors. Piped output uses plain status lines without animations.

## Quality and output

uTube saves **MP4 video with audio**. When YouTube provides video and audio separately, FFmpeg combines them. Available resolutions depend on the video and the YouTube client.

If your requested quality is unavailable, uTube tries 360p, then the lowest available quality. When a server rejects a stream, uTube can refresh its links and switch clients. That fallback may offer a different resolution; the app reports the actual quality used.

Files include the video ID, for example:

```text
Downloads/
├── Me at the zoo [jNQXAC9IVRw].mp4
└── My playlist/
    ├── #1_First video [VIDEO_ID].mp4
    └── #2_Second video [VIDEO_ID].mp4
```

An existing target file is skipped. Restarting a failed download starts that file again; partial-download resume is not implemented. MP3 extraction and authenticated downloads are not currently available.

## Troubleshooting

| What you see | What to try |
| --- | --- |
| `utube` is not found | Reopen your terminal and check that npm's global executable directory is on your PATH. |
| A quality requires FFmpeg | Install FFmpeg and confirm `ffmpeg -version` works in the same terminal. |
| A lower quality is downloaded | Read the fallback message. YouTube or the alternate client may not offer your requested resolution. |
| A download is rejected or interrupted | uTube retries supported transient failures automatically. If it still fails, try again later or choose another quality. |
| A playlist needs an interactive terminal | Run the command directly in your terminal without piping its output. |
| A private, restricted, or unavailable video fails | Confirm that the video is publicly accessible. The CLI has no login or cookie options. |

YouTube changes can still break downloads. If an issue persists, [open an issue](https://github.com/omer73364/uTube/issues) with your uTube and Node.js versions, operating system, exact error, and a public example URL when possible.

## Upgrading from 1.x

- Upgrade to **Node.js 20 or newer** before installing v2.
- Note your old download folder before updating, then set it again with `--set-download-folder`. Legacy package-local settings are read as a fallback, but npm upgrades can replace that file.
- Update manually with `npm install -g utube-cli@latest`; startup no longer runs a global npm update.
- New filenames include video IDs. Files downloaded by older versions may not be recognized and can be downloaded again.

See the [changelog](CHANGELOG.md) for the full release history.

## Development and contributions

```sh
git clone https://github.com/omer73364/uTube.git
cd uTube
npm ci
npm test
npm start
```

To pass CLI arguments through npm:

```sh
npm start -- -u "https://youtu.be/jNQXAC9IVRw" -q 360p
```

The regression suite covers argument handling, settings, playlist renderers and pagination, failed-download cleanup, ranged transfers, and retry behavior. Live checks against YouTube are separate from the automated tests.

Bug reports and pull requests are welcome. For major changes, open an issue first so we can agree on the scope.

## License

[MIT](LICENSE) © OMER ANWAR
