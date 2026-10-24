# Android 1.0.0 verification

Verified on October 24, 2026.

- Mobile TypeScript check passed; all 23 mobile unit tests passed.
- `npm audit --omit=dev` reported zero production vulnerabilities.
- `assembleRelease` and Android's release lint checks passed.
- The release bundle contains one React instance and includes JavaScript assets.
- `apksigner` verified the APK against the committed production certificate;
  the release verifier correctly rejected the development-signed prototype.
- APK version is 1.0.0 (code 2), package `io.github.omer73364.utube.mobile`.
- The manifest is non-debuggable. ARM64 and x86-64 are packaged.
- APK ZIP alignment and all 40 native ELF libraries passed 16 KB alignment checks.
- The exact signed APK installed and cold-started without Metro on a clean
  Android 15 x86-64 emulator. No AndroidRuntime or ReactNativeJS startup errors
  were logged. The emulator ran with 4 KB pages; 16 KB compatibility was checked
  statically, not through a 16 KB runtime session.
- Receiving a real shared YouTube link and previewing its metadata succeeded.
- A real video and MP3 were queued through the release UI, then saved while the
  app was backgrounded. The test used the public video `jNQXAC9IVRw`.
- FFprobe confirmed video plus audio tracks in the MP4 and MP3 audio in the MP3.
- The media-source companion contains 17 versioned archives; every archive hash
  matches its manifest.

ARM64 is included and statically checked; this run did not use a physical
ARM64 phone. Previous development checks covered eight offline native
integration cases, adaptive 720p video, playlist folders, Arabic, and themes.
