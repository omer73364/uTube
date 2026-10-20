# Changelog

## Unreleased

- Simplify the desktop with a compact layout, neutral colors, saved light/dark/system appearance, and English/Arabic language choices with RTL support.
- Open completed downloads in the default media application, with a separate action to reveal their containing folder.
- Add queue search and status filters, a link-input keyboard shortcut, and quick access to the download folder.

- Keep requested video quality across retries, try alternate encodings and HD-capable clients, and reduce rejected byte ranges before abandoning a stream.
- After exhausting the requested resolution across clients, try lower qualities from highest to lowest and report the quality successfully saved.

- Add a private Electron desktop preview with video and playlist previews, item selection, MP4/MP3 downloads, folder settings, and a visible download queue.
- Support cancelling and retrying desktop jobs, safe shutdown, and missing-FFmpeg guidance.
- Share the download engine between CLI and desktop with explicit inputs, progress events, and cancellation cleanup.
- Add desktop integration checks and local Linux packaging. The public CLI version remains 2.1.0.

## 2.1.0 — 2026-10-20

- Add MP3 downloads for single videos and selected playlist items through `--audio` / `-a` and the interactive menu.
- Convert audio to 192 kbps MP3 with title metadata using FFmpeg.
- Reuse stream retries, client fallback, safe filenames, and cleanup in audio mode.
- Match resolution requests such as 720p to available high-frame-rate variants such as 720p60.
- Add real FFmpeg/FFprobe coverage for MP3 output and 480p, 720p, and 1080p merging.

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
