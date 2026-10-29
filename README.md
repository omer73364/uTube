<div align="center">

<img src="apps/desktop/assets/icon.svg" alt="uTube logo" width="88">

# uTube

### Your favorite videos, offline. In one command or one click.

Save public videos from **YouTube, X, Instagram, and Facebook** as **MP4** or **MP3**.
Use the desktop app, the Android app, or a friendly terminal.

<br>

[![npm](https://img.shields.io/npm/v/utube-cli?style=for-the-badge&logo=npm&color=dd3b20&labelColor=292225)](https://www.npmjs.com/package/utube-cli)
[![Desktop](https://img.shields.io/badge/desktop-preview-dd3b20?style=for-the-badge&logo=electron&logoColor=white&labelColor=292225)](#-desktop-app)
[![Android](https://img.shields.io/badge/Android-2.6.0-dd3b20?style=for-the-badge&logo=android&logoColor=white&labelColor=292225)](#-android-app)
[![License](https://img.shields.io/badge/license-MIT-dd3b20?style=for-the-badge&labelColor=292225)](LICENSE)

[🌐 Website](https://omer73364.github.io/uTube/) · [⚡ Quick start](#-quick-start) · [🌍 Supported sites](#-supported-sites) · [🖥️ Desktop](#-desktop-app) · [📱 Android](#-android-app) · [💻 CLI](#-cli) · [🛟 Help](#-troubleshooting)

<br>

<img src="docs/images/utube-apps-preview.png" alt="uTube desktop and Android apps in English, alongside CLI install and run commands" width="1000">

<sub>🖥️ Desktop · 📱 Android · 💻 CLI</sub>

</div>

<br>

## 🎬 Pick your way to download

| 🖥️ **Desktop**                                                                           | 📱 **Android**                                                                   | 💻 **CLI**                                                               |
| :--------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------- | :----------------------------------------------------------------------- |
| A visual library, playlist groups, and a download manager for Linux, Windows, and macOS. | The same red theme on your phone, with background downloads and Android sharing. | From link to saved file through an interactive menu or a single command. |
| [Get the installer →](#-desktop-app)                                                     | [Get the APK →](#-android-app)                                                   | [Install with npm →](#-cli)                                              |

> [!NOTE]
> The CLI, desktop, and signed Android downloads are all at **2.6.0** under one release tag.
> Windows and macOS builds are unsigned previews and may show security warnings; macOS builds are not notarized.

<br>

## ✨ Why uTube?

- 🎞️ **Video or audio.** MP4 with sound, or 192 kbps MP3.
- 📏 **Compare sizes first.** Every quality option shows its estimated file size (or says it's unknown).
- 🎯 **Quality first.** Your resolution is tried across all available streams, then the best working lower one.
- 📚 **Whole playlists.** Select everything or just what you want, each saved in its own folder.
- 🔄 **Quiet recovery.** Retries stay out of the way, and progress never jumps backwards.
- 🧳 **History that sticks.** Desktop and Android keep history and preferences, with search, retry, and open-file actions.
- 🌍 **English & العربية.** Right-to-left layouts, plus light, dark, or system appearance on desktop and Android.

<br>

## 🌍 Supported sites

Paste a link in the desktop app, the Android app, or the CLI. Only **public** content is supported.

|     | Site            | You can save                                                 | Not supported                                                                   |
| :-: | :-------------- | :----------------------------------------------------------- | :------------------------------------------------------------------------------ |
| ▶️  | **YouTube**     | Videos and playlists                                         | Private videos; live-stream recording is unverified                             |
|  𝕏  | **X / Twitter** | Public native MP4 videos, including multi-video posts        | Private or restricted posts, GIFs, live broadcasts, photos, external videos     |
| 📸  | **Instagram**   | Public Reels and video posts                                 | Private posts, Stories, live streams, photos                                    |
| 📘  | **Facebook**    | Public videos and Reels (video, share, and `fb.watch` links) | Private or login-restricted videos, live streams, photos, stream-only playlists |

<details>
<summary><b>📋 Notes and CLI examples for each site</b></summary>

<br>

- **Multi-video posts** open the usual video selection screen.
- **Android** also accepts links shared from YouTube, X, Instagram, and Facebook, and from browser intents.
- **X** MP4s keep the original video and audio with no re-encoding.
- **Instagram** may temporarily limit anonymous requests. If it asks you to sign in, try again later.
- **Facebook** quality follows its metadata: **SD/HD**, or a resolution when provided. If HD fails, uTube can try SD.
- **MP3 conversion** needs FFmpeg on desktop and CLI (see [FFmpeg](#-ffmpeg)). Android has its own built in.

```sh
utube -u "https://x.com/username/status/1577855540407197696" -q 720p
utube --audio -u "https://www.instagram.com/reel/DemPo6-NFZK/"
utube -u "https://www.facebook.com/share/r/1BhmM7uP7K/" -q HD
```

</details>

<br>

## ⚡ Quick start

Install [Node.js](https://nodejs.org/) **20+**, then:

```sh
npm install -g utube-cli@latest
utube
```

Paste a link and follow the prompts. ✅ If FFmpeg is missing, uTube offers to download it for MP3 and HD video.

> [!TIP]
> Prefer clicking over typing? Try the [desktop app](#-desktop-app). Want it on your phone? Try the [Android app](#-android-app).

<br>

## 🖥️ Desktop app

A floating navigation bar connects **Home**, **Library**, and **Downloads**, in the same red accents, rounded cards, and warm charcoal dark theme as mobile.

### 📦 Download

Pick an installer from **[GitHub Releases](https://github.com/omer73364/uTube/releases)**:

|     | Platform                      | Formats                       |
| :-: | :---------------------------- | :---------------------------- |
| 🐧  | Linux (x64)                   | `.deb` · `.AppImage` · `.zip` |
| 🪟  | Windows (x64)                 | `Setup.exe` · portable `.zip` |
| 🍎  | macOS (Apple Silicon & Intel) | `.dmg` · `.zip`               |

Packages include their own runtime, so **Node.js is not needed**. The `.deb` installs FFmpeg as a dependency; otherwise use **Settings → Download FFmpeg** (see [FFmpeg](#-ffmpeg)). Platform steps and checksums are in the [installation guide](docs/distribution.md).

### 🪄 How it works

1. 🔗 On **Home**, paste a supported link or YouTube playlist and choose **Preview link**.
2. 🎚️ Choose MP4 or MP3, a quality, and any playlist items.
3. 📁 Confirm the destination and add your downloads.
4. 📋 Follow progress in **Downloads**, or open finished files from **Library**.

| Screen           | What's there                                                                       |
| :--------------- | :--------------------------------------------------------------------------------- |
| 🏠 **Home**      | Paste a link and see recent downloads                                              |
| 📚 **Library**   | Saved video and audio, with Files and Playlists views, playlist groups, and search |
| ⏬ **Downloads** | Full history with filters for active, completed, and attention-needed items        |
| ⚙️ **Settings**  | Theme, language, and download folder                                               |

Every thumbnail card has a three-dot menu: **Open file** and **Show in folder** for finished items, **Cancel** for active ones, and **Retry** for failed or interrupted ones. The header has a quick light/dark toggle and a folder shortcut, and **Ctrl+L** / **⌘+L** jumps back to the link box from any screen.

<details>
<summary><b>🌙 See it in Arabic · dark mode</b></summary>

<br>

<img src="docs/images/desktop-ar-dark.png" alt="uTube Desktop library in Arabic with the warm dark theme" width="820">

<sub>Development preview with sample downloads.</sub>

</details>

<details>
<summary><b>💤 What happens when I close it?</b></summary>

<br>

Titles, playlists, dates, quality, status, and file locations are saved locally in `downloads.json` in the app's user-data directory. Unfinished downloads return as **Interrupted**; **Retry** restarts them from the beginning, and nothing restarts on its own. The queue holds up to 500 unfinished items, and completed history doesn't count toward that limit.

See the [desktop guide](apps/desktop/README.md) for recovery behavior and development.

</details>

<br>

## 📱 Android app

**Download, install, go.** Get the signed APK from **[GitHub Releases](https://github.com/omer73364/uTube/releases/tag/v2.6.0)**. It needs Android 10 or newer.

The main APK covers both ARM64 and x86-64; smaller CPU-specific APKs are on the same page. Allow your browser or file manager to install it when Android asks. iOS is not implemented.

> [!IMPORTANT]
> If you used an older prototype signed with the development key, save anything you need from its history and uninstall it first.

- 🏠 **Home, Library, and Downloads** with thumbnail cards, search, status filters, and saved playlist groups.
- 🎞️ **HD MP4 and MP3**, with _Best available_ or a chosen resolution. The actual saved quality shows in history.
- 📚 **Playlist selection** with continuation-page loading and separate playlist folders.
- ⏬ **Background downloads** through a native foreground service.
- 🔗 **Share from supported apps**: pick your quality and videos, then let downloads run in the background.
- 🧳 **Persistent queue and preferences**, including failures and interrupted work.
- 📂 **Open and share saved files**, cancel active work, and retry failed downloads.
- 🗑️ **Remove from list** for single entries or all finished history. Downloaded files stay on your device.
- 🌍 **English and Arabic**, mirrored layouts, light/dark/system appearance, and a quick theme toggle.

Files are saved in **Downloads / uTube** through Android's media storage. The queue allows up to 1,000 unfinished downloads, and a playlist batch up to 1,000 videos. Android may stop background work after a force-stop, restart, or system limit; interrupted downloads stay available to retry, but partial transfers don't resume.

Want to build or run it yourself? See [Development](#-development) and the [mobile guide](apps/mobile/README.md).

<br>

## 💻 CLI

Requires **Node.js 20+**.

```sh
npm install -g utube-cli@latest
utube
```

The guided menu lets you download a video or playlist, save audio, change the folder, check for updates, or exit:

```text
◆ What would you like to do?
❯ ↓  Download a video or playlist
  ♫  Download audio (MP3)
  ▣  Change download folder
  ↗  Exit
```

Use **↑ / ↓** to move, **Enter** to confirm, and **Space** to select playlist items.

### 🚀 Or go direct

```sh
# 🎥 Video: pick the quality interactively
utube -u "https://youtu.be/jNQXAC9IVRw"

# 🎯 Video: request a resolution, with automatic fallback
utube -u "https://youtu.be/jNQXAC9IVRw" -q 720p

# 🎵 Audio: save as MP3
utube --audio -u "https://youtu.be/jNQXAC9IVRw"

# 📚 Playlist: choose all or specific items
utube -u "https://www.youtube.com/playlist?list=YOUR_PLAYLIST_ID"

# 📁 Remember a folder (quote paths with spaces)
utube --set-download-folder "~/Downloads/My videos"
```

<details>
<summary><b>🔧 All options & notes</b></summary>

<br>

| Option                         | Purpose                                                                 |
| :----------------------------- | :---------------------------------------------------------------------- |
| `-u <url>`                     | Video or playlist link from any [supported site](#-supported-sites)     |
| `-q <quality>`                 | Requested resolution, such as `720p` or `1080p` (`SD`/`HD` on Facebook) |
| `-a`, `--audio`                | Save MP3; don't combine with `-q`                                       |
| `--set-download-folder <path>` | Remember a destination                                                  |
| `--get-download-folder`        | Print the current destination                                           |
| `--install-ffmpeg`             | Download FFmpeg for uTube                                               |
| `--check-updates`              | Check npm for a newer version                                           |
| `-v`, `--version`              | Show the installed version                                              |
| `-h`, `--help`                 | Show help                                                               |

- 🤖 **Scripting:** video needs `-u` and `-q`; audio needs `--audio` and `-u`. Playlist selection needs an interactive terminal.
- 🔌 Help, version, and folder settings work offline.
- ⚙️ Settings live in `$XDG_CONFIG_HOME/utube-cli/settings.json`, or `~/.config/utube-cli/settings.json`.
- 🔔 The interactive CLI shows a notice when npm has a newer version, and checks are cached for 24 hours and skipped quietly when offline. Updating stays a command you run yourself: `npm install -g utube-cli@latest`.
- 🎨 `NO_COLOR=1` turns off colors. Piped output uses plain status lines instead of animated progress.

</details>

<details>
<summary><b>📊 What the CLI shows while downloading</b></summary>

<br>

Each video gets a text card with channel, duration, view count, format, destination, and watch link when available. One live progress block follows the video, audio, and merging stages, with bytes transferred, recent speed, and ETA when the total is known. Unknown sizes show activity without inventing a percentage, and narrow terminals use a compact layout.

Automatic retries keep the displayed progress steady. Playlists continue after an individual failure and finish with saved, skipped, and failed counts. The CLI is text-only, with no thumbnails.

</details>

<br>

## 🎞️ FFmpeg

FFmpeg is needed for **MP3 audio** and **HD video** on desktop and CLI. Android includes its own native media libraries.

- 🖥️ **Desktop:** **Settings → Audio & video processing → Download FFmpeg**, with progress and cancellation. Setup works without restarting.
- 💻 **CLI:** `utube --install-ffmpeg`, or accept the offer in the interactive menu.
- 🧰 **Already installed?** An existing system FFmpeg is used automatically, and manual installs work too.

Downloads are verified and saved for uTube only, with no administrator access or system changes. See the [setup guide](docs/ffmpeg-setup.md).

<br>

## 🗂️ Files and quality

The CLI saves to the current directory, desktop to your Downloads folder, and Android to **Downloads / uTube**. Each remembers its own destination, and playlists get a named subfolder.

```text
Downloads/
├── Video title [VIDEO_ID].mp4
├── Video title [VIDEO_ID].mp3
└── Playlist title/
    ├── #1_First video [VIDEO_ID].mp4
    └── #2_Second video [VIDEO_ID].mp4
```

- 🖥️💻 **Desktop and CLI** clean the filename and add the video ID so identical titles never collide. Existing files are **skipped, never overwritten**; move or rename one to download it again at another quality.
- 📱 **Android** adds a unique suffix and can save another copy. Removing a history entry keeps the file.
- 🎯 **Quality:** uTube tries your resolution across the available streams and clients before going lower, and reports any downgrade. It can't create a resolution the site doesn't offer.

<br>

## 🛟 Troubleshooting

| 😕 Problem                      | 💡 Try this                                                                                                                                                                               |
| :------------------------------ | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `utube` not found               | Reopen the terminal and check that npm's global bin folder is on your `PATH`.                                                                                                             |
| MP3 or HD needs FFmpeg          | Use **Download FFmpeg** in desktop Settings, or run `utube --install-ffmpeg`.                                                                                                             |
| A lower quality was saved       | The requested resolution was unavailable or its streams failed, so the best working lower one was used.                                                                                   |
| An item was skipped             | A file with that name exists. Move or rename it and retry.                                                                                                                                |
| Shows **Interrupted**           | Choose **Retry**. It restarts from the beginning.                                                                                                                                         |
| File won't open                 | Check that it still exists and a media player is installed.                                                                                                                               |
| Android debug bundle won't load | Run `npm run mobile:start`, then `adb reverse tcp:8081 tcp:8081`, and reload. For stale code, use `npm run mobile:start -- --reset-cache` ([details](apps/mobile/README.md#run-locally)). |
| Site rejects the download       | Retry later and check the video is public. Sites change, which can affect compatibility.                                                                                                  |

🐛 **Found a bug?** [Open an issue](https://github.com/omer73364/uTube/issues) with your platform, uTube version, the exact error, and a public example URL. Add Node.js for CLI or development issues, and the Android version for mobile ones.

> [!WARNING]
> **Current limits:** no partial-download resume and no private or authenticated downloads. In-app updates use verified installers and need [configured delivery](docs/app-updates.md), with system confirmation still required. Linux is the best-tested desktop platform; Windows, macOS, and Android devices need broader testing.

<br>

## 🧑‍💻 Development

Use **Node.js 22.13+**, **npm 10.9+**, and FFmpeg/FFprobe. (The published CLI still supports Node.js 20+.)

```text
apps/cli/       💻 Terminal commands and presentation
apps/desktop/   🖥️ Electron + React desktop app
apps/mobile/    📱 React Native + native Android app
packages/core/  ⚙️ Shared download engine and Node-free helpers
website/        🌐 Project website on GitHub Pages
```

```sh
git clone https://github.com/omer73364/uTube.git
cd uTube
npm ci

npm start                # CLI from this checkout
npm run desktop          # desktop development app
```

### 📱 Run Android on your phone

You'll also need **JDK 17**, Android platform/build tools **37**, NDK **27.1.12297006**, and `JAVA_HOME` and `ANDROID_HOME` configured, plus a phone on Android 10+ with USB debugging enabled.

```sh
npm run mobile:start                  # terminal 1: Metro, keep running
adb reverse tcp:8081 tcp:8081         # terminal 2: repeat after reconnecting the phone
npm run mobile:android                # install and launch the debug app
```

The root `npm start` runs the CLI, not Metro. For standalone builds, signing, dependency notices, and device tests, see the [mobile guide](apps/mobile/README.md).

### 🧪 Checks

```sh
npm test                 # core, CLI, media, queue, and history tests
npm run desktop:check    # desktop type checking
npm run mobile:check
npm run mobile:test
```

Media tests need FFmpeg/FFprobe. Desktop renderer checks use a disposable window and sample records, with no packaged app or real downloads ([instructions](apps/desktop/README.md#renderer-checks-without-building)). Full desktop integration tests need a freshly packaged app and a graphical session; Android native tests need a build and a connected phone or emulator.

### 📦 Local builds and website

```sh
npm run desktop:package        # package desktop for integration tests
npm run desktop:test
npm run desktop:test:packaged
npm run desktop:make           # local desktop installers
npm run mobile:build           # local standalone development APK
npm run mobile:release         # production APK; needs private signing credentials
npm run site:preview           # build and serve the website locally
npm run site:build
```

These commands only create local output. The website deploys through the Pages workflow when relevant changes reach `main`. Platform-specific steps are in the [website](website/README.md), [desktop](apps/desktop/README.md), and [mobile](apps/mobile/README.md) guides.

<br>

## 🤝 Contributing

Bug reports, fixes, translations, and testing on more devices are all welcome! ❤️ For larger changes, please open an issue first to discuss the approach. Adding a language? Follow the [desktop guide](apps/desktop/README.md#adding-a-language). Release history is in the [changelog](CHANGELOG.md).

## 📄 License and use

uTube is meant for content you have permission to download. Please respect creators' rights and each platform's terms.

[MIT](LICENSE) © Omar Anwar. Android media-library notices and redistribution instructions are in [THIRD_PARTY_NOTICES.md](apps/mobile/THIRD_PARTY_NOTICES.md).

<div align="center">

<br>

**If uTube saved you time, drop it a ⭐. It really helps!**

</div>
