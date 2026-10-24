# Install uTube Desktop

Download the files for your system from [uTube 2.2.0 on GitHub Releases](https://github.com/omer73364/uTube/releases/tag/v2.2.0). The desktop includes its runtime; you do not need Node.js, npm, or a compiler.

This is the first desktop preview. Builds are unsigned and macOS builds are not notarized. Linux has desktop integration coverage; Windows and macOS installers are built on native runners, with broader interactive testing still needed.

## Debian and Ubuntu

Download the x64 `.deb` and install it with apt so FFmpeg and other declared dependencies are installed too:

```sh
sudo apt install ./uTube-Desktop-2.2.0-linux-x64.deb
```

Launch uTube Desktop from your application menu.

## Portable Linux

For AppImage, download the x64 file and make it executable:

```sh
chmod +x uTube-Desktop-2.2.0-linux-x64.AppImage
./uTube-Desktop-2.2.0-linux-x64.AppImage
```

AppImage requires FUSE support on your distribution. On systems without it, try the AppImage runtime's `--appimage-extract-and-run` option. For ZIP, extract the entire archive and run `utube-desktop` inside the extracted directory. Install FFmpeg through your distribution's package manager for MP3 conversion and HD merging.

## Windows

Run the x64 `Setup.exe`, or extract the entire Windows ZIP and open `utube-desktop.exe`. Install [FFmpeg](https://ffmpeg.org/download.html) and make it available on your `PATH`, then restart uTube. The preview installer is unsigned, so Windows may show a security warning.

## macOS

Choose `arm64` for Apple Silicon or `x64` for Intel. Open the DMG and drag uTube Desktop into Applications, or extract the ZIP and move its `.app` into Applications. Install FFmpeg and restart uTube. If a GUI launch cannot find a custom FFmpeg installation, launch with `UTUBE_FFMPEG` set to its absolute executable path.

The preview is unsigned and not notarized. macOS may block opening it; follow Apple's guidance for [opening an app from an unidentified developer](https://support.apple.com/guide/mac-help/open-a-mac-app-from-an-unidentified-developer-mh40616/mac). Only proceed when you trust the download.

## Verify a download

Each platform has a `SHA256SUMS` file alongside its downloads. On Linux, put it next to the matching downloaded files and run `sha256sum --check SHA256SUMS-linux-x64.txt`. On macOS, use `shasum -a 256 <filename>`; on Windows, use PowerShell `Get-FileHash <filename> -Algorithm SHA256`. Compare the result with the corresponding line. A missing-file message is expected if you downloaded only one of the listed formats.

## Build and release

`npm run desktop:make` creates packages for the current platform under `apps/desktop/out/make/`. Linux builds need `dpkg` and `fakeroot`. AppImage packaging uses electron-builder through a Forge 8 adapter; Windows uses Squirrel.Windows, and DMG creation runs on macOS.

The **Desktop release** workflow builds Linux x64, Windows x64, macOS Intel, and macOS Apple Silicon artifacts on native GitHub runners. A manual run keeps artifacts for inspection without publishing. A version-tag run publishes one GitHub Release only after all build jobs succeed. npm publishing remains a separate step.

Release steps: keep root, desktop, lockfile, and `version.js` versions aligned; update the changelog and versioned release notes; run tests; commit; then push the matching `vX.Y.Z` tag when a release is authorized. Public Windows/macOS releases are now blocked locally unless the app and archived payloads pass native signature and notarization checks. Signing provider setup remains pending; see the [trusted release guide](signing.md). Do not describe existing 2.2.0 builds as signed or as including FFmpeg.

## Project website

The [uTube website](https://omer73364.github.io/uTube/) provides English/Arabic app information, platform-specific desktop downloads, installation requirements, and the CLI install command. Its source lives in `website/` and deploys to GitHub Pages when website changes reach `main`. See the [website guide](../website/README.md) for local previews and browser checks.

## Android

Install the signed APK from the [Android 1.0.0 release](https://github.com/omer73364/uTube/releases/tag/android-v1.0.0) on Android 10+ ARM64 or x86-64 devices. It bundles JavaScript and native media processing, so it does not need Metro, Node.js, or an external FFmpeg installation.

If replacing a development/prototype build, save any needed history and uninstall it first because its signing identity differs. Subsequent production APKs use the permanent production key and can update this release. Android may request permission to install from the browser or file manager.

Android versions and `android-v*` tags are independent from desktop/CLI releases. Run `npm run mobile:release` with private signing credentials to build and verify a production APK. Publish its SHA-256 checksums, media source companion, notices, and verification report beside it. See [the Android guide](../apps/mobile/README.md) and [release checklist](releases/android-1.0.0.md).
