# uTube-cli

## Revival in progress

This checkout is being repaired. Single-video downloads have been verified; broader playlist and platform testing is still in progress.

### uTube-cli is a command line tool to download YouTube videos and playlists.

![Web Page ScreenShot](https://i.ibb.co/VYw6ZST/Screenshot-from-2022-07-27-17-23-23.png)

It's a node package, so it's available for (Windows, Linux and Mac) operating systems, all you need is Node.js installed on your system.

> **Note**: uTube is built on [ YouTube.js ](https://github.com/LuanRT/YouTube.js) tool

## uTube 1.1.6 is here 🎉

### what's new?

- Manual updates through npm
- Pass url and quality within command
- Show downloading progress bar
- Set default download folder
- Bug fixes

## Features

- User friendly command line interface
- Download single YouTube video
- Download YouTube playlist
- Download some videos of YouTube playlist
- Playlists organized to folders by their names

## TODO

- [x] Support `-v` parameter to display tool version
- [x] Support shorts
- [x] support all youtube link formats
- [x] support `-u` parameter to pass url directly
- [x] support `-q` parameter to quality url directly
- [x] Show downloading porgress bar
- [x] Support setting downloading folder
- [ ] Optional update notifications
- [x] Support available MP4 qualities, including separate audio/video streams (requires FFmpeg)
- [ ] Support downloading sounds (mp3 format)

# Installation

Requires [Node.js](https://nodejs.org/en/) 20 or newer. Install [FFmpeg](https://ffmpeg.org/download.html) and ensure `ffmpeg` is on your PATH to download formats with separate video and audio streams.

For local development:

```sh
npm ci
npm test
npm start -- -u "https://www.youtube.com/watch?v=VIDEO_ID" -q 360p
```

The published npm package still contains the old release until a repaired version is published. Its installation command is:

    npm install -g utube-cli

# Updating

If you have uTube installed you can update it this command:

    npm update -g utube-cli

# Arguments

| Argument              | Description                                         | example                                   |
| --------------------- | --------------------------------------------------- | ----------------------------------------- |
| -v                    | show uTube version                                  | `utube -v`                                |
| -u                    | pass video or playlist url                          | `utube -u [url]`                          |
| -q                    | pass quality (falls back to 360p, then lowest available) | `utube -q 360p`                           |
| --set-download-folder | set the default downloading path                    | `utube --set-download-folder ~/Downloads` |
| --get-download-folder | get the downloading path                            | `utube --get-download-folder`             |

# Usage

uTube is very easy to use, just type `utube` on your terminal or cmd then you can use it.

Here examples of uses:

**- Download videos & playlists directly by passing url and quality:**

    utube -u https://www.youtube.com/shorts/ZKgEye8waGE -q 360p

**- Download videos & playlists by passing url then select quality manually:**

    utube -u https://www.youtube.com/shorts/ZKgEye8waGE

**- Download videos by 2 steps:**

    utube

1.  Paste the video URL.
2.  Choose the quality.

| ![enter image description here](https://i.ibb.co/Fx7qCgZ/Screenshot-from-2022-07-27-17-24-44.png) | ![enter image description here](https://i.ibb.co/cvYhyC9/Screenshot-from-2022-07-27-17-24-56.png) |
| ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |

**- Download playlists by 3 steps:**

    utube

1.  Paste the playlist URL.
2.  Choose the quality.
3.  Choose which videos will be downloaded.

| ![enter image description here](https://i.ibb.co/Njcqm0z/Screenshot-from-2022-07-27-17-27-02.png) | ![enter image description here](https://i.ibb.co/P6tL6Mr/Screenshot-from-2022-07-27-17-27-22.png) |
| ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |

> **Note**: playlists will be downloaded to a folder with the playlist name.

## Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.

## License

[MIT](https://choosealicense.com/licenses/mit/)

## Settings and downloads

Settings are saved in `$XDG_CONFIG_HOME/utube-cli/settings.json`, or `~/.config/utube-cli/settings.json` by default. Existing package settings are read as a fallback. Local commands such as `-v` and `--get-download-folder` do not need internet access. Updates are manual.

Downloads use sanitized filenames with video IDs. Existing files are skipped. Failed downloads clean up temporary files, and playlist failures are reported while remaining selected items continue. Available qualities depend on YouTube; audio extraction to MP3 is not implemented.

Stream downloads use small byte ranges and retry interrupted ranges once. If links are rejected or a connection keeps failing, uTube refreshes the video data and tries an alternate YouTube client. The alternate client may only offer a different resolution; uTube reports the actual quality used. Persistent server rejections show the HTTP status.
