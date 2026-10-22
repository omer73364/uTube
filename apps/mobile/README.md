# uTube Mobile

An Android-first React Native app, developed alongside the CLI and desktop app.
This is a local prototype, not a published mobile release.

## First phase

- Paste an individual YouTube video link and load its title and available MP4 formats with audio.
- Start a native Android download into `Downloads/uTube`.
- View saved download records, cancel active transfers, and open completed videos.
- Choose English or Arabic, with right-to-left layout and light, dark, or system appearance.

Android's DownloadManager handles the transfer independently of the JavaScript screen.
History and preferences are stored on the device. Actual transfer behavior still needs
verification on a phone, including background operation and expired YouTube links.

Only combined MP4 streams are supported in this phase. Some videos have no usable
combined stream. Playlists, MP3 conversion, separate HD video/audio merging, share-sheet
input, and iOS are later phases. There is no download server or account system.

## Run locally

Use Node.js 22.13+, npm 10.9+, JDK 17, and an Android SDK with platform/build tools 37
and NDK 27.1.12297006. Set `ANDROID_HOME` and `JAVA_HOME`; connect an Android 10+
device with USB debugging or start an emulator.

From the repository root:

```sh
npm ci
npm run mobile:start
# In another terminal:
npm run mobile:android
```

The debug app uses Metro. For a standalone local APK with JavaScript bundled:

```sh
npm run mobile:build
adb install -r apps/mobile/android/app/build/outputs/apk/prototype/app-prototype.apk
```

The `prototype` variant uses the public development key and is only for local testing.
The `release` variant deliberately has no signing identity. A public release needs a
private Android signing key and a separate release process. Never commit that key.

On Windows, run `gradlew.bat assemblePrototype` from `apps/mobile/android` instead
of the shell-based `mobile:build` command.

Builds include ARM64 phones and x86-64 emulators. To build one architecture faster:

```sh
cd apps/mobile/android
./gradlew assemblePrototype -PreactNativeArchitectures=x86_64 --max-workers=2
```

## Checks

```sh
npm run mobile:check
npm run mobile:test
npm run bundle:android --workspace=@utube/mobile
# After building the standalone APK:
npm run test:bundle --workspace=@utube/mobile
```

Domain tests cover shared URL parsing, media-host restrictions, progress values, and
messages from the player sandbox. Inspector tests verify rejected links fall through
to another client. These checks do not replace a real Android download test.

The bundle check rejects duplicate React instances in the packaged source map.
`mobile:build` runs it automatically after Gradle succeeds. Metro pins React and its
subpaths to this workspace so hoisted native libraries cannot load the desktop's copy.

The dependency audit currently flags `braces` through Metro/CLI's file-matching tools.
The latest published `braces` version is still affected. Do not use
`npm audit fix --force` here: its suggested React Native downgrade is incompatible with this app.
Recheck the advisory before preparing a public mobile release.

Before calling this phase complete on a device, test a public video end to end, leave
the app during transfer, restart it to check history, open the saved MP4, cancel a
transfer, and check both languages and themes. Check a failed link and airplane mode too.

## Architecture

### Prototype validation · October 22, 2026

The standalone APK builds successfully for ARM64 and x86-64, passes Android's vital
lint checks, and verifies with `apksigner`. Its JavaScript is bundled; Metro is not
needed to run it. Nine mobile tests and the 54 existing project tests pass, along with
mobile and desktop type checking. A live inspection of `jNQXAC9IVRw` found an MP4
whose normal GET request returned HTTP 200.

The original APK's startup crash was reproduced on an Android 15 emulator:
`Cannot read property 'useState' of null`. Its bundle contained two React instances.
The corrected APK passes the bundle check, renders its screen, survives repeated
cold starts, and supports Arabic and dark mode. End-to-end transfers and background
operation still need device testing before moving on to playlists, MP3, or HD merging.

### Implementation

`App.tsx` is the native interface. `src/youtube.ts` uses YouTube.js's React Native
entry point and the shared Node-free URL parser. Startup installs a `structuredClone`
polyfill when the runtime lacks it; the player parser needs it to copy syntax nodes.
Regression tests exercise the real parser with the native API removed and check that
cloning preserves values such as regular expressions and undefined fields.
Player deciphering runs in a hidden
WebView with network and file access disabled; only validated signature results return
to the app. Kotlin's `DownloadModule` validates media URLs, owns transfer IDs, and uses
Android content URIs to open saved files. The Node/FFmpeg download engine is not loaded
into the phone app.
