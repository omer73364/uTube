# Optional FFmpeg setup

These instructions describe the next release. Existing public installers still
use a separately installed system FFmpeg.

## Desktop

If FFmpeg is missing, uTube offers setup when it starts. You can skip it and
open **Settings → Audio & video processing → Download FFmpeg** later. The
**FFmpeg not found** status and **Download in Settings** link jump directly to
that section. The app explains
the download before you start and shows progress. You can cancel and retry.
Setup takes about 20–30 MB of download data and needs roughly 150 MB of free
space while unpacking. No system settings or administrator permissions change.
New downloads can use FFmpeg immediately after setup.

## CLI

Run `utube --install-ffmpeg` to explicitly request setup. Interactive startup offers setup if FFmpeg is missing, with Yes selected by
default. You can decline and keep using the app. The CLI menu hides its setup
option once FFmpeg is available. Piped/non-interactive commands never
prompt or download automatically; they explain the setup command instead.
The downloaded tool is reused across CLI package updates.

Files are kept in `%LOCALAPPDATA%/uTube` on Windows,
`~/Library/Application Support/uTube` on macOS, or
`${XDG_DATA_HOME:-~/.local/share}/utube` on Linux. Desktop keeps its own copy in
its existing user-data folder. An existing system FFmpeg is preferred. Set
`UTUBE_FFMPEG` to use a particular executable; an invalid override is not silently
ignored.

## Downloads and licenses

The selected binaries come directly from the
[ffmpeg-static b6.1.1 release](https://github.com/eugeneware/ffmpeg-static/releases/tag/b6.1.1).
Each platform's compressed binary, executable, license, and build README have
pinned SHA-256 hashes in `packages/core/ffmpeg-releases.js`. The release includes
different actual versions across platforms (Linux x64 reports FFmpeg 7.0.2).
Those are third-party builds, not uTube-built or bundled binaries. Their own
licenses apply; the downloaded LICENSE and README identify licensing and build
sources. uTube's MIT license does not replace those licenses.

Only complete, hash-verified downloads that pass `ffmpeg -version` become usable.
Failures and cancellation remove temporary files. No executable is included in
the npm package or desktop build by this feature. Maintainers must review newer
upstream builds and security fixes; pinned hashes are integrity checks, not a
security audit. Manual installation remains available on all platforms.
