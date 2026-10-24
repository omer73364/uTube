# Android phases

Implemented with focused commits. Production Android distribution uses a permanent private signing key and separate `android-v*` releases.

- [x] Bounded metadata requests, cancellation, and live lookup
- [x] Adaptive MP4 qualities and quiet client/quality fallback
- [x] Persistent SQLite queue, ranged transfers, cancellation, retry, and recovery
- [x] Native HD muxing and MP3 conversion
- [x] Playlist pagination, selection, folders, and batch queueing
- [x] Android share-sheet input and incoming YouTube links
- [x] Queue search/filter, file sharing, history controls, and Arabic/English UI
- [x] Local APK/AAB builds, dependency notices, and private signing configuration
- [x] Android integration tests and updated guides

Verified on October 23, 2026: 23 mobile tests, eight offline native checks, and
54 existing project tests; mobile and desktop type checks; real background 720p
MP4 and MP3 downloads; playlist-folder and numbered-filename checks. The supplied
playlist loads four accessible videos. Arabic/dark mode, share input, and opening
a completed file were checked on the Android 15 x86-64 emulator.

Both ARM64 and x86-64 are packaged. The APK passes signature and 16 KB archive
alignment checks; all 40 native libraries passed 16 KB ELF alignment checks.
ARM64 was built, not run on a physical phone here.

Android is the implemented scope. iOS needs its own native backend, macOS/Xcode,
signing, and device verification. See the mobile guide for signed APK installation and the release checklist for
production verification and redistribution requirements.
