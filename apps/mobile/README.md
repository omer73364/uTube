# uTube Mobile

Save YouTube videos, playlists, and MP3 audio on Android. Choose a quality,
select playlist items, and manage everything in one persistent download queue.

This app is developed alongside uTube's CLI and desktop app. Mobile builds
remain local prototypes; there is no public mobile release or download server.

## What you can do

- Download MP4 videos, including adaptive HD video with a separate audio track.
- Save MP3 audio at 192 kbps, preferring the original audio track.
- Load playlist pages, choose videos, and save each playlist in its own folder.
- Send a YouTube link to uTube from Android's share menu.
- Search and filter downloads, cancel work, retry failures, and open or share files.
- Keep download history and preferences after closing the app.
- Use English or Arabic, with right-to-left layout and light, dark, or system appearance.

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

## Local distribution builds

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

Twenty-three mobile tests cover adaptive quality order, audio pairing, playlist
pagination, URL restrictions, cancellation/deadlines, progress, and parser
compatibility. Seven Android integration tests use real tiny media fixtures to
verify 1080p muxing with audio, MP3 output, ranged retry without duplicate
bytes, persistent queue recovery, atomic batches, and isolated player execution.

On October 23, 2026, these seven offline Android checks passed on an Android 15 x86-64
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
