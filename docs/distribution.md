# Desktop downloads: the plan

The desktop should be something you install and open. Building from source should be a contributor workflow.

This is a proposal, not a list of published downloads. Public desktop installers are not available yet. The current Electron Forge configuration creates local Debian packages and ZIP archives; Windows and macOS still need platform testing and installer setup.

## Start with Linux

Ship an x64 **`.deb` for Debian and Ubuntu** first, using the existing maker. Keep a **ZIP archive** as a portable alternative for compatible Linux systems, with clear launch instructions. Test installation, first launch, a video, a playlist, MP3 conversion, opening files, and history after restart on a clean machine.

Consider AppImage next for broader Linux distribution. It needs separate packaging work and testing; the current project does not build it.

## Add native Windows and macOS installers

- **Windows:** a `Setup.exe` built with [Forge's Squirrel.Windows maker](https://www.electronforge.io/config/makers/squirrel.windows), including its startup event handling. Start with x64 and test on Windows.
- **macOS:** a `.dmg` built with [Forge's DMG maker](https://www.electronforge.io/config/makers/dmg). Build and test Apple Silicon and Intel versions on macOS.

Prepare [code signing](https://www.electronforge.io/guides/code-signing) for public Windows and macOS distribution, including macOS notarization. Keep platform downloads labeled with their version and architecture.

## Make installation complete

Packaged desktop apps include Electron and its Node.js runtime, so users should not need Node.js, npm, or a compiler. FFmpeg is still an external dependency today.

Before calling the desktop a complete installer experience, include a suitable FFmpeg binary for each supported platform, review that build's redistribution requirements, and test MP3 conversion and HD merging on a machine without system FFmpeg. Until then, state the FFmpeg requirement next to the download.

## Build first, publish separately

Use manually triggered CI jobs on Linux, Windows, and macOS to build and retain test artifacts. Include checksums and verify each platform before promoting an artifact to a public download. Building must not automatically publish a release.

When a desktop release is approved, attach the tested installers to its GitHub Release and link directly to them from the README and website. Keep the CLI available through npm; standalone CLI binaries can follow if users need them.

## Give the project a home

A small English/Arabic website would make the desktop easier to discover and install. Start with a static page in this repository, hosted on [GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages).

Lead with the benefit, show real desktop screenshots, and give visitors a clear download for their operating system alongside all platform choices. Include a copyable CLI install command, requirements, release notes, and links to documentation and issues.

Only show a platform download when its installer exists and has been tested. Keep downloads on GitHub Releases so the page can stay simple. A download page needs no account system or server-side video processing.
