# uTube Mobile

Save YouTube videos and playlists, public X/Twitter videos, and MP3 audio on Android. Choose a quality,
select playlist items, and manage everything in one persistent download queue.

This app is developed alongside uTube's CLI and desktop app.

## Install Android

Download the signed **uTube 2.5.0 APK** from [GitHub Releases](https://github.com/omer73364/uTube/releases/tag/v2.5.0). It supports Android 10+ on ARM64 phones and x86-64 devices. The app bundles its JavaScript and media tools; Metro and a computer are only needed for development.

Android may ask you to allow installation from your browser or file manager. If replacing a development/prototype build, uninstall that build first because it uses a different signing key. Save any history you need before uninstalling; downloaded media stays in Downloads / uTube. Updates from the same production signing identity can be installed over this release.

## What you can do

- Download MP4 videos, including adaptive HD video with a separate audio track.
- Save MP3 audio at 192 kbps, preferring the original audio track.
- Load playlist pages, choose videos, and save each playlist in its own folder.
- Send a YouTube or X post link to uTube from Android's share menu.
- Browse thumbnail cards in Home, Library, and Downloads; group saved files by playlist.
- Search and filter downloads, cancel work, retry failures, and open or share files.
- Use each card’s menu to remove an entry without deleting its downloaded file.
- Keep download history and preferences after closing the app.
- Choose English or Arabic and light, dark, or system appearance in Settings.
  The header also has a quick light/dark toggle.

Files are saved in **Downloads / uTube**. Clearing finished history keeps the
files. A playlist batch can contain up to 1,000 videos; the unfinished queue
also has a 1,000-item limit.

## Quality and background downloads

Choose **Best available** or a resolution. uTube tries candidates at the
requested resolution across several YouTube clients before trying lower
qualities. It shows the quality actually saved. Candidate retries stay inside
one download entry and do not reset the progress bar.

The native Android foreground service performs transfers and media processing.
The queue stores video requests, then resolves fresh links just before each
transfer. Metadata requests have deadlines and cancellation. Playlist lookup
finishes before adding selected items to the queue.

Leaving the screen does not cancel the native service. Android may still stop
work because of a force-stop, restart, battery policy, or foreground-service
time limit. Unfinished records become **Interrupted** after process recovery;
**Retry** resolves fresh links and restarts the item. Partial files are cleaned
up; byte-level resume across process death is not implemented.

## Run locally

Use Node.js 22.13+, JDK 17, Android platform/build tools 37, and NDK
27.1.12297006. Set `ANDROID_HOME` and `JAVA_HOME`. Connect an Android 10+
phone with USB debugging or start an emulator.

From the repository root:

```sh
npm ci
npm run mobile:start
# In another terminal:
npm run mobile:android
```

Start Metro before launching the debug app, and keep that terminal running.
If running commands from `apps/mobile`, use `npm start` first, then
`npm run android` in another terminal. The repository root's `npm start` runs
the CLI, so use the `mobile:*` commands shown above from there.

For a USB-connected phone, ensure Metro is reachable:

```sh
adb reverse tcp:8081 tcp:8081
```

Repeat this after reconnecting the phone. With multiple devices, pass
`adb -s YOUR_DEVICE_ID reverse tcp:8081 tcp:8081`. Over Wi-Fi, configure the
phone's React Native development server address to your computer's LAN IP and
port 8081, with both devices on the same network.

For a standalone APK with JavaScript bundled:

```sh
npm run mobile:build
adb install -r apps/mobile/android/app/build/outputs/apk/prototype/app-prototype.apk
```

The prototype uses the public development key and does not need Metro.
Builds include ARM64 phones and x86-64 emulators. For one architecture:

```sh
cd apps/mobile/android
./gradlew assemblePrototype -PreactNativeArchitectures=x86_64 --max-workers=2
```

On Windows use `gradlew.bat` in place of `./gradlew`.

## Development builds

```sh
cd apps/mobile/android
./gradlew assemblePrototype bundlePrototype --max-workers=2
```

Outputs are in `app/build/outputs/apk/prototype/` and
`app/build/outputs/bundle/prototype/`. These commands build locally; they do
not upload or publish anything.

The `release` variant is unsigned unless all four environment variables are
set: `UTUBE_ANDROID_KEYSTORE` (absolute path), `UTUBE_ANDROID_STORE_PASSWORD`,
`UTUBE_ANDROID_KEY_ALIAS`, and `UTUBE_ANDROID_KEY_PASSWORD`. Supply them through
your private environment, then run `assembleRelease bundleRelease`. Partial
configuration fails clearly. Never commit a private signing key or password.
The prototype always uses its development identity.

## Signed production APK

Run `npm run mobile:release` from the repository root. The build requires all four signing variables listed above, or the ignored local `.private/android/signing.json` file created for the maintainer. It fails if credentials are missing, bundles JavaScript, and checks for duplicate React copies. The verified outputs are written to `build/release/`.

Keep an offline backup of the permanent signing key and its credentials. Future updates must use the same key. Never commit `.private`, keystores, or passwords. See [the release checklist](../../docs/releases/android-1.0.0.md).

Media processing uses dynamically linked FFmpegKit Audio libraries. Read
[dependency notices and source/rebuild instructions](THIRD_PARTY_NOTICES.md)
before distributing a binary. The app also includes an open-source licenses
screen.

## Verification

```sh
npm run mobile:check
npm run mobile:test
npm test
# After building:
npm run test:bundle --workspace=@utube/mobile
# With an emulator or phone connected:
cd apps/mobile/android
./gradlew connectedPrototypeAndroidTest --max-workers=2
```

Mobile tests cover adaptive quality order, audio pairing, playlist
pagination, URL restrictions, cancellation/deadlines, progress, and parser
compatibility. Android integration tests use real tiny media fixtures to
verify 1080p muxing with audio, MP3 output, ranged retry without duplicate
bytes, persistent queue recovery, atomic batches, individual removal without deleting files, and isolated player execution.

On October 23, 2026, these eight offline Android checks passed on an Android 15 x86-64
emulator. All 54 existing project tests passed, along with mobile type checking.
Live lookup and Android share input were verified using public video links.
The opt-in live test also saved the supplied `XIdA1AZ4zYI` video at 720p with
audio while the app was backgrounded, checking the actual MP4 track height.
A real MP3 download passed through the same queue, including checks for its
playlist folder and numbered filename.
These checks do not establish compatibility with every video, device, or
manufacturer's background restrictions.

For an opt-in live test, first install the app and test APKs built by
`assemblePrototype assemblePrototypeAndroidTest`, then run:

```sh
adb shell am instrument -w \
  -e class com.utubemobile.LiveDownloadTest \
  -e liveVideo XIdA1AZ4zYI -e quality 720p -e minimumHeight 720 \
  io.github.omer73364.utube.mobile.test/androidx.test.runner.AndroidJUnitRunner
```

This test backgrounds the app and checks the actual saved media tracks. It
creates a real download and history record. Use `-e mode mp3` for audio and
`-e playlist Test` to check playlist-folder output. It is skipped unless a
`liveVideo` argument is supplied, so the regular integration suite stays offline.

The bundle check rejects duplicate React instances, which caused the first
prototype's startup crash. Startup also installs a tested `structuredClone`
polyfill for the YouTube player parser when Hermes lacks it.

The current dependency audit reports a high-severity `braces` advisory through
Metro/CLI's pattern-matching tools (GHSA-vfj7-8cjw-p6xm). Its suggested automatic
fix downgrades React Native to 0.72.17 and is incompatible with this app; it was
not applied. Review the tooling advisory again before a public mobile release.

## Implementation

`App.tsx` contains the interface. `src/youtube.ts` uses YouTube.js's React Native
entry point and the shared Node-free URL and format helpers. Playlist collection
and download-plan selection are independently tested.

Kotlin's metadata transport bounds responses, restricts hosts, and supports
cancellation. Player script execution runs in an isolated native WebView with
no file access, storage, network, or native JavaScript interface; only validated
signature strings return. The native queue persists in SQLite and coordinates
fresh-link preparation through a React Native headless task.

Native ranged transfers write temporary files. FFmpeg copies video/audio into
MP4 or encodes MP3, then Android's MediaStore publishes the completed file.
Partial output stays hidden and is removed on failure or cancellation. Opening
and sharing files use owned content URIs and temporary read grants.

## Remaining platform work

Android is the implemented platform. iOS still needs a native transfer/media
backend, Xcode project integration, signing, and testing on macOS and an iPhone.
An Android build does not verify iOS behavior.

The release builds `uTube-android-2.5.0.apk`, `uTube-android-2.5.0-arm64-v8a.apk`, and `uTube-android-2.5.0-x86_64.apk`
for smaller downloads. The universal APK remains the website's main download.
Android, CLI, and desktop now share the same version and GitHub release tag.
Verify split APKs with `node scripts/verify-release.cjs APK_PATH ABI`.

### Switching between official and development builds

`npm run android` keeps the official app ID and uses your local release-signing
identity, loaded from the ignored `.private/android/signing.json` file or the four
`UTUBE_ANDROID_*` signing environment variables used by `build:release`. Passwords
are passed through the child environment and are never printed or added to Git.
With this identity available, development and official builds can replace each
other without uninstalling or clearing app data (Android version downgrade rules
still apply). The command stops if the signing identity is missing instead of
silently installing an incompatible debug-signed app.

Prototype APKs still use the public development key. They cannot replace official
builds. Keep the private release identity local; do not distribute debug builds
signed with it as public releases.

### Quick downloads from other apps

In YouTube or X/Twitter, choose **Share → uTube** to open a compact sheet over the current app.
Choose video or MP3 audio, select quality, and add the download. The sheet closes
once the queue accepts it; downloads continue in the background with notification
progress. Shared playlists queue up to 1,000 videos in their original order.
The sheet follows the saved language and theme. Closing it before adding a
download leaves the queue unchanged; lookup failures offer a retry.


## X / Twitter support

The main link field, Android share sheet, and supported browser links accept
public `x.com` and `twitter.com` video posts. Preview actual MP4 resolutions,
choose videos from a multi-video post, or use `/video/N` to select one video.
**Best available** keeps the highest available native resolution. Portrait
resolution labels use the shorter edge, such as 720p for 720×900.

X uses the same persistent native queue, foreground notifications, cancellation,
retry, media processing, file actions, and English/Arabic interface as YouTube.
Thumbnails are saved with history. Links are resolved again immediately before
background transfers, so a retry does not depend on an expired preview URL.
At a requested resolution, the native service tries alternate encodings before
lower qualities; **Best available** tries candidates from highest to lowest.
MP3 extraction uses the bundled FFmpeg libraries.

Metadata is requested through the existing cancellable native HTTP bridge.
Only X's embedded-post endpoint is added to the metadata allowlist; media is
restricted to HTTPS MP4 files on `video.twimg.com`, with native HTTP byte ranges.
The metadata/format parser is shared with desktop and CLI and has no Node.js
runtime dependencies.

Support covers public native MP4 videos exposed by X. Private, deleted,
login-restricted, or unavailable posts, photos, GIFs, live broadcasts, external
videos, and HLS-only media are unsupported. X can rate-limit or change its public
endpoint; the app reports lookup failures and keeps queue retries available.
No account or cookies are read.

X-specific automated checks cover routing, preview/selection, fresh links,
quality ordering, MP3 plans, cancellation, URL restrictions, Android share
intents, native byte ranges, queue recovery, and combined-MP4 processing.
The opt-in `LiveDownloadTest` also accepts IDs such as
`x-1577855540407197696-1` for a real X download through the background service.


On October 27, 2026, 34 mobile tests, 75 core/CLI tests, and 15 offline Android
integration tests passed. The standalone ARM64 APK built successfully and passed
the single-React bundle check. Live public X downloads saved a 720p MP4 with audio
and an MP3 through the real native background queue on an ARM64 emulator.
Desktop integration and packaged-worker checks passed after sharing the parser.

### Instagram

Paste a public Instagram Reel or video-post link to preview and download it.
Video carousels support selecting individual videos. MP4 and MP3 use the existing
download flow. Private posts, Stories, live streams, and photos are not supported;
Instagram may limit access without signing in.

### Facebook

Paste a public Facebook video, Reel, share link, or `fb.watch` link. Choose SD/HD
(or a resolution when available) and save MP4 or MP3 through the existing download
flow. Private/login-restricted videos, live streams, photos, and streaming-only
videos are not supported.

## File sizes before downloading

The preview and Android share sheet show an estimated size for the chosen quality
or MP3 format before starting a download. Changing quality, format, or selected
videos updates it immediately. HD estimates include audio, and MP3 uses the app's
192 kbps encoding rate. Actual saved sizes can vary when another stream is used.
Missing metadata is shown as Size unavailable. Partial totals identify how many
selected videos have known sizes; unknown sizes never count as zero. This uses
existing preview metadata without extra media requests. Ordinary YouTube playlist
entries may lack the stream metadata needed for size estimates.
