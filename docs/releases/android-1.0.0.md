# uTube for Android 1.0.0

The first signed Android release brings uTube's download queue and library to your phone.

## Install

Download **uTube-android-1.0.0.apk** and open it on an Android 10+ device.
The APK supports ARM64 phones and x86-64 devices and runs without Metro,
Node.js, or separately installed FFmpeg. Android may ask you to allow your
browser or file manager to install apps.

Development and prototype builds use a different signing identity. If you
installed one, save any history you need and uninstall it before installing
this release. Files already saved in Downloads / uTube remain there.
Subsequent production updates use the same permanent signing key.

## Included

- MP4 video and MP3 audio, including adaptive HD video with merged audio.
- Quality selection, quiet fallback attempts, and the actual saved quality.
- Playlists with item selection and separate folders.
- Background downloads, persistent history, cancellation, and retry.
- Thumbnail cards, search, filters, playlist groups, file opening and sharing.
- Removal from history without deleting downloaded media.
- English and Arabic, RTL layouts, and light/dark/system themes.
- The red uTube identity and warm dark appearance.

Android can stop background work after a force-stop, restart, battery policy,
or service time limit. Interrupted entries can be retried; partial downloads
start again. iOS is not included. YouTube changes may require app updates.

## Verify the download

Compare the APK's SHA-256 hash with `SHA256SUMS.txt` from this release.
The public production signing certificate is checked into
`apps/mobile/android/release-signing-certificate.pem`; the private key is
never part of the repository or release assets.

The release also includes media-library notices and
`uTube-android-1.0.0-media-sources.tar`, containing corresponding versioned
media sources and build recipes. uTube source is available through the
release tag. See `apps/mobile/THIRD_PARTY_NOTICES.md` for relinking instructions.

## Maintainer checklist

1. Run `npm ci`, `npm run mobile:check`, and the mobile tests.
2. Run `npm run mobile:release` with JDK 17, the documented Android SDK, and
   private signing credentials. This verifies the APK signature, version,
   architectures, bundled JavaScript, non-debuggable setting, and 16 KB alignment.
3. Install the signed release on a clean test device. Check standalone startup,
   a video download, and media processing; keep the test report with the release.
4. Collect media sources with `scripts/collect-media-sources.py`, package the
   sources/notices/rebuild instructions, and generate SHA-256 hashes for assets.
5. Commit the release changes, tag `android-v1.0.0`, and publish the APK and
   companion assets to GitHub Releases. Android tags are separate from CLI/desktop tags.

Back up `.private/android` securely offline. It contains the permanent signing
identity and its credentials, required for all future updates. Do not upload
that directory or its files to GitHub.
