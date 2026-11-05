# uTube for iOS

The iOS app uses the same React Native screens and provider parsers as Android:
YouTube videos/playlists, public X videos, Instagram video posts/carousels, and
Facebook videos; quality and size previews; selected playlist items; video and
192 kbps MP3; queue/history search, cancellation, retry, file preview/sharing;
English/Arabic and light/dark/system appearance.

For a step-by-step iPhone installation walkthrough and the status of TestFlight,
signed IPA, and App Store distribution, see [Install iOS](../../../README.md#-ios-app).

## Build and run

Use macOS, Xcode **26+**, CocoaPods, and the repository's Node version. Xcode 27
was used for initial verification. The deployment target is iOS 16. Native
processing uses AVFoundation and a pinned, source-built LAME Swift package.
No external FFmpeg executable is needed on an iPhone.

From the repository root:

```sh
npm ci
(cd apps/mobile/ios && pod install)
npm run mobile:build:ios
```

The unsigned Release simulator app is
`apps/mobile/build/ios-derived/Build/Products/Release-iphonesimulator/uTube.app`.
It includes Hermes, JavaScript, images, the encoder, and the Share Extension;
it runs without Metro. Install it on a running simulator:

```sh
xcrun simctl install booted apps/mobile/build/ios-derived/Build/Products/Release-iphonesimulator/uTube.app
xcrun simctl launch booted io.github.omer73364.utube.mobile
```

For development, run `npm run mobile:start`, then `npm run mobile:ios`.
Open `apps/mobile/ios/uTube.xcworkspace` in Xcode, rather than the project alone.
`create-project.rb` can regenerate the committed project with Ruby's `xcodeproj`
gem; run `pod install` afterwards to restore CocoaPods integration.

## Files and incoming links

Completed files appear under **Files → On My iPhone/iPad → uTube → uTube**.
The app exposes its Documents directory, with media inside the `uTube` folder.
Playlist folders preserve numbered filenames. Removing or clearing history keeps
the files. Files remain app-owned: uninstalling the app deletes them unless they
have been exported elsewhere. Use the card menu to preview or share/export media.

Share → uTube saves a supported URL into the shared app group. Open the main app
to preview it, select quality/items, and queue downloads. The extension does not
pretend it can start the containing app or keep an arbitrary JavaScript runtime
alive. The main app also accepts `utube://download?url=ENCODED_PUBLIC_URL`.
Provider parsing and validation still apply to every incoming link.

## Background behavior

Service status uses the same pinned P-256 signing keys as the other apps.
Verified, unexpired notices can hold only the affected provider’s queue; unknown
keys, invalid signatures, expired payloads, and revision rollback are rejected.
Apple controls executable updates on iOS.

On iOS 26+, a foreground-started queue requests a system continued-processing
task, with visible progress. If granted, the queue can resolve the next item,
transfer, mux, or encode while backgrounded. iOS may deny or expire the request;
older versions use UIKit's finite background allowance. Expiration cancels the
current work, cleans partial files, and records **Interrupted**. Retry resolves
fresh URLs. Remaining queued jobs continue when the app is active again.
Force-quit/relaunch recovers unfinished active work as Interrupted. Download byte
resume across termination is not implemented.

Transfers use disk-backed ephemeral URLSession download tasks and validate every
redirect against the job's provider. Background URLSessions bypass that redirect
delegate, so they are deliberately not used. Metadata is bounded to 2 MB for X
and 8 MB otherwise, with deadlines/cancellation, no shared cookies/cache, and
provider-specific host/path/method restrictions. Player scripts execute in
separate nonpersistent WKWebViews with a deny-by-default CSP, navigation blocking,
no app bridge, a 15-second deadline, and signature-result validation.

The queue uses SQLite/WAL with transactional batches, deduplication and a limit of
1,000 unfinished jobs. It processes one job at a time. Progress stays in memory;
phase changes are persisted. MP4 streams are copied into a composition and
exported without video re-encoding; MP3 uses bounded PCM buffers on a utility
worker. Unsupported codecs fall through to the next planned candidate; iOS's
codec coverage may differ from Android's bundled FFmpeg. Completed output is
moved into Documents only after processing succeeds.

## Verification

```sh
npm run mobile:check
npm run mobile:test
npm test
npm run mobile:test:ios:native
# Start a simulator first:
npm run mobile:test:ios
# Optional: creates real MP4 and MP3 files and history records:
UTUBE_LIVE_URL=https://x.com/SpaceX/status/1577855540407197696 npm run mobile:test:ios
```

`UTUBE_IOS_DESTINATION` overrides the build/test destination. Native package tests
run on macOS and verify real 1080p muxing with audio, MP3 frame output and duration,
cancellation cleanup, provider boundaries, queue recovery/retry, atomic batches,
capacity rollback, container relocation, bounded HTTP/cancellation, and signed
service-notice validation. They exercise the same source compiled into the iOS app;
they do not substitute for device/lifecycle checks. Release UI tests check startup
without Metro, settings, navigation, and relaunch. Live tests are opt-in.

## Verified on November 5, 2026

- Release simulator app and Share Extension build; unsigned ARM64 iPhone build.
- Release simulator UI startup, settings, navigation, and relaunch without Metro.
- Real X and YouTube MP4 and MP3 downloads through the native queue. FFprobe
  confirmed X's 720×900 H.264/AAC MP4, YouTube's available 320×240 H.264/AAC MP4,
  and real 192,000 bps MP3 audio from both providers.
- 15 native package tests, 48 mobile tests, 137 core tests, and TypeScript checking.
- Signed production service-status feed verified and cached by the installed app.
- One React instance in the standalone iOS JavaScript bundle.

Live Instagram/Facebook downloads, Share Extension interaction, long background
queues/expiration, Arabic UI, and file presentation still need broader iOS and
physical-device verification. The 1080p mux test uses an offline media fixture;
the live YouTube sample above has a lower native resolution.

## Signing and distribution

To install on a physical iPhone/iPad, use the source-install steps in the
[root README](../../../README.md#-ios-app). Select **Release** for the Xcode
scheme’s Run action before installing if the app should work after disconnecting
the Mac. Debug development builds normally depend on a reachable Metro server.
The unsigned simulator output from `mobile:build:ios` is not an iPhone installer.

The full project requires a signing team that can provision its App Group and
both app IDs. A free Personal Team has capability/expiration limits and is not a
guaranteed way to sign this project unchanged. The repository does not provide
a separate reduced-capability Personal Team variant.


Simulator builds require no signing identity. For an iPhone, choose your Apple
team for **both** targets and register their bundle IDs and the shared App Group:
`group.io.github.omer73364.utube.mobile`. If changing identifiers, update both
entitlements, `UTubeAppGroup`, URL configuration, and the continued-task identifier
and permitted pattern together. Private signing material stays outside Git.

If the default identifiers are unavailable to your team, configure your own:

| Setting | Example for a different team | Where |
| --- | --- | --- |
| Main app bundle ID | `com.example.utube` | uTube target → Signing & Capabilities |
| Share Extension bundle ID | `com.example.utube.share` | uTubeShare target → Signing & Capabilities |
| Shared App Group | `group.com.example.utube` | Register/enable for both targets; set `UTUBE_APP_GROUP` in both targets’ Build Settings. Both entitlements files and `UTubeAppGroup` Info.plist entries use this variable. |
| Continued-processing identifier | `com.example.utube.downloads.queue` | `uTube/ContinuedWork.swift` |
| Permitted background-task pattern | `com.example.utube.downloads.*` | `uTube/Info.plist` → `BGTaskSchedulerPermittedIdentifiers` |

Keep those settings in `create-project.rb` consistent if regenerating the project;
the script recreates the default bundle IDs and App Group. After choosing your
team, ensure automatic signing can provision both targets before running on your
phone. If Xcode reports an unavailable capability or App Group, resolve the team’s
provisioning instead of using the unsigned simulator build as an installer.

Archive/export through Xcode for the chosen development, registered-device, or
TestFlight channel. TestFlight users need only its iPhone/iPad app and a beta
invitation; they do not need Xcode or a laptop. Ad Hoc users need a signed IPA
whose profile includes their device. App Store installation requires an approved,
published release. No TestFlight link, signed IPA, or App Store listing is
currently provided by this repository. See [Apple’s distribution overview](https://developer.apple.com/documentation/xcode/distributing-your-app-for-beta-testing-and-releases)
for these methods and their membership requirements. The Android APK updater is replaced with Apple-distribution
information on iOS; there is no Android installer or unsigned OTA installation.

Before distributing, verify long background transfers and encoding, expiration,
force-quit, Files export/preview, low storage, all four providers and playlist
ordering, incoming shares, iPad presentation, and Arabic appearance on an actual
iPhone/iPad. Review the bundled LAME LGPL notice and provide complete source and
relinking instructions/artifacts required by its license with binary releases.
