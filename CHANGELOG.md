# Changelog

## 2.0.0 — 2026-10-19

uTube returns with a new terminal interface and repaired YouTube downloads.

### Added

- An interactive home menu, editable download folder, and repeat-download sessions.
- Rounded panels, color accents, status badges, transfer progress, and playlist summaries.
- Download-all and individual playlist selection.
- FFmpeg merging for MP4 qualities with separate video and audio.
- Ranged transfers, safe chunk retries, refreshed links, and alternate-client fallback.
- Regression tests for CLI commands, settings, playlist renderers, cleanup, and transfers.

### Fixed

- Playlists incorrectly reported as empty when YouTube returns newer lockup renderers.
- Stream rejections reported only as a generic non-2xx error.
- Unsafe output filenames, incorrect quality fallback, and incomplete download cleanup.
- Local commands depending on an internet connection.

### Changed

- Requires Node.js 20 or newer. FFmpeg is needed for separate-stream merging.
- Updated YouTube.js to 18.2.x and removed the Babel build step.
- Settings are saved in the user's config directory.
- Updates are manual; automatic global npm updates have been removed.
- Output filenames include the video ID. Existing 1.x filenames may be downloaded again.
- An alternate client may provide a different quality; uTube reports the actual resolution.

Live video and playlist-item downloads were verified on Linux, including the three previously failing playlist videos. All 13 regression tests pass. Windows and macOS need broader verification.
