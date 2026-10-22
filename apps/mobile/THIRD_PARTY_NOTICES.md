# Mobile media dependencies

uTube's own source is MIT licensed. Native media processing dynamically links
`dev.ffmpegkit-maintained:ffmpeg-kit-audio:8.1.9`, licensed under LGPLv3,
with the component licenses included in its AAR. This is the audio package,
without the optional GPL video encoders. Video is copied into MP4; MP3 audio
is encoded with LAME.

The app's **Open-source licenses** screen includes the project's MIT license,
LGPLv3, the GPLv3 text incorporated by LGPLv3, and bundled component notices.
These notices must stay in redistributed builds.

## Source and rebuilding

- Maintained source: https://github.com/ffmpegkit-maintained/ffmpeg
- Versioned Android source: https://github.com/ffmpegkit-maintained/ffmpeg/tree/469e560b89a9ba4cab357d2c306c676b0c611745
- Maven artifact: https://repo.maven.apache.org/maven2/dev/ffmpegkit-maintained/ffmpeg-kit-audio/8.1.9/
- uTube build configuration: `android/app/build.gradle`

The upstream source tree contains Android build scripts, external-library
recipes, and source download configuration. Retain the corresponding source
and build inputs for any public binary distribution, including modifications
to the media libraries. No public mobile binary is published by this change.

To relink uTube with a modified compatible library, build the audio AAR from
upstream source, place it outside Git, and replace the Maven `implementation`
with `implementation(files('/absolute/path/to/modified-audio.aar'))`. Retain the
AAR's transitive `com.arthenica:smart-exception-java:0.2.1` dependency explicitly
when using a local file. Rebuild the app using the mobile guide. Use your own
Android signing key; Android requires uninstalling a differently signed app
before installing your build. Export any files you want to keep first.

The app does not prevent debugging or reverse engineering needed to modify
or debug these LGPL components. The native shared libraries remain separate
from the application code. Review the bundled licenses for their full terms.
