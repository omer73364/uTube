# uTube-cli

### # Stand With Palestine 🇵🇸

### uTube-cli is a command line tool to download YouTube videos and playlists.

![Web Page ScreenShot](https://i.ibb.co/VYw6ZST/Screenshot-from-2022-07-27-17-23-23.png)

It's a node package, so it's available for (Windows, Linux and Mac) operating systems, all you need is Node.js installed on your system.

> **Note**: uTube is built on [ YouTube.js ](https://github.com/LuanRT/YouTube.js) tool

## uTube 1.1.5 is here 🎉

### what's new?

- Auto update
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
- [x] Auto Update package if new version available
- [ ] Support 480p & 720p & 1080p
- [ ] Support downloading sounds (mp3 format)

# Installation

Ensure that you have [Node.js](https://nodejs.org/en/) installed on your system, then you can install uTube using npm by this command:

    npm install -g utube-cli

# Updating

If you have uTube installed you can update it this command:

    npm update -g utube-cli

# Arguments

| Argument              | Description                                         | example                                   |
| --------------------- | --------------------------------------------------- | ----------------------------------------- |
| -v                    | show uTube version                                  | `utube -v`                                |
| -u                    | pass video or playlist url                          | `utube -u [url]`                          |
| -q                    | pass quality (if not available will return to 360p) | `utube -q 360p`                           |
| --set-download-folder | set the default downloading path                    | `utube --set-download-folder ~/Downloads` |

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
