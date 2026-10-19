# uTube CLI

Download YouTube videos and playlists from an interactive terminal.

**Version 2.0.0 brings uTube back** with a redesigned interface, repaired playlist support, and more resilient downloads. Built with [YouTube.js](https://github.com/LuanRT/YouTube.js).

## Requirements

- Node.js 20 or newer.
- [FFmpeg](https://ffmpeg.org/download.html) on your PATH for qualities that have separate video and audio streams.
- An internet connection for downloads. Version, help, and folder settings work offline.

Live downloads have been checked on Linux. Windows and macOS still need broader testing. YouTube changes can affect availability and download reliability.

## Install or update

```sh
npm install -g utube-cli@latest
utube --version
```

## Interactive mode

```sh
utube
```

Use the arrow keys and Enter to download a video or playlist, change the download folder, or exit. Paste a YouTube URL and choose a quality. Invalid URLs can be corrected in the prompt.

For playlists, download all videos or select individual entries with Space. Press `a` to toggle all and Enter to continue. After a download, return to the main menu to start another.

The interface includes bordered panels, colored status messages, video/audio stages, transfer size, speed, and ETA when the size is available. Playlist summaries show saved, skipped, and failed items. Set `NO_COLOR=1` to disable app colors; piped output uses plain status lines.

## Direct commands

```sh
utube -u "https://www.youtube.com/watch?v=jNQXAC9IVRw" -q 360p
utube -u "https://www.youtube.com/playlist?list=PLAYLIST_ID"
utube --set-download-folder "~/Downloads"
utube --get-download-folder
```

| Option | Description |
| --- | --- |
| `-u <url>` | Video or playlist URL |
| `-q <quality>` | Requested quality, such as `360p` or `720p` |
| `-v`, `--version` | Show version |
| `--set-download-folder <path>` | Remember a download folder |
| `--get-download-folder` | Show the current download folder |
| `-h`, `--help` | Show help |

Playlist selection requires an interactive terminal. For noninteractive single-video commands, provide both `-u` and `-q`.

## Download behavior

- Supports watch, short, embed, live, mobile, and shortened YouTube URLs.
- Saves MP4 files with sanitized names and video IDs; existing files are skipped.
- Groups playlist downloads into a folder named after the playlist.
- Merges separate video and audio streams with FFmpeg.
- Fetches streams in small byte ranges and retries interrupted ranges once.
- Refreshes rejected links and tries an alternate YouTube client when needed. The fallback may offer a different resolution, such as 360p; the app reports the quality used.
- Falls back to 360p when a requested quality is unavailable, then to the lowest available quality.
- Cleans temporary files after download failures and continues with other selected playlist items.

Restricted, private, or unavailable videos may still fail. MP3 extraction is not implemented.

## Settings and upgrading from 1.x

Version 2 requires Node.js 20 or newer and no longer updates itself at startup. Update manually with npm.

Settings are stored in `$XDG_CONFIG_HOME/utube-cli/settings.json`, or `~/.config/utube-cli/settings.json` by default. An existing package-local settings file is read as a fallback, but npm upgrades can replace it. Before upgrading, note your old download folder and set it again with `--set-download-folder` after installation.

Downloaded filenames now include the video ID. Older filenames may not be recognized as existing downloads.

## Development

```sh
npm ci
npm test
npm start
npm start -- -u "https://www.youtube.com/watch?v=jNQXAC9IVRw" -q 360p
```

See [CHANGELOG.md](CHANGELOG.md) for release notes. Pull requests are welcome; please open an issue before proposing a major change.

## License

[MIT](LICENSE)
