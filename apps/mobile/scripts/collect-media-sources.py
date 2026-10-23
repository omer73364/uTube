"""Retain versioned media-library sources alongside a public Android APK."""
import concurrent.futures
import hashlib
import json
from pathlib import Path
import sys
import urllib.request

REVISION = "469e560b89a9ba4cab357d2c306c676b0c611745"
SOURCES = {
    "ffmpegkit": ("ffmpegkit-maintained/ffmpeg", REVISION),
    "config": ("arthenica/gnu-config", "v20210814"),
    "cpu-features": ("arthenica/cpu_features", "v0.8.0"),
    "ffmpeg": ("arthenica/FFmpeg", "n8.1.3"),
    "lame": ("arthenica/lame", "RELEASE__3_100"),
    "libiconv": ("arthenica/libiconv", "v1.17"),
    "libilbc": ("arthenica/libilbc", "v3.0.4"),
    "libogg": ("arthenica/ogg", "v1.3.5"),
    "libsndfile": ("arthenica/libsndfile", "1.2.0"),
    "libvorbis": ("arthenica/vorbis", "v1.3.7"),
    "opencore-amr": ("arthenica/opencore-amr", "v0.1.6"),
    "opus": ("arthenica/opus", "v1.4"),
    "shine": ("arthenica/shine", "3.1.1"),
    "soxr": ("arthenica/soxr", "0.1.3"),
    "speex": ("arthenica/speex", "Speex-1.2.1"),
    "twolame": ("arthenica/twolame", "0.4.0"),
    "vo-amrwbenc": ("arthenica/vo-amrwbenc", "v0.1.3"),
}


def collect(destination):
    destination.mkdir(parents=True, exist_ok=True)

    def fetch(entry):
        name, (repository, revision) = entry
        url = f"https://codeload.github.com/{repository}/tar.gz/{revision}"
        target = destination / f"{name}-source.tar.gz"
        partial = target.with_suffix(".part")
        try:
            with urllib.request.urlopen(url, timeout=180) as response, partial.open("wb") as output:
                while chunk := response.read(1024 * 1024):
                    output.write(chunk)
            partial.replace(target)
        finally:
            partial.unlink(missing_ok=True)
        return {
            "name": name,
            "repository": f"https://github.com/{repository}",
            "revision": revision,
            "url": url,
            "sha256": hashlib.sha256(target.read_bytes()).hexdigest(),
        }

    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        manifest = list(pool.map(fetch, SOURCES.items()))
    (destination / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    print(f"Retained {len(manifest)} versioned source archives in {destination}")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("Usage: python3 collect-media-sources.py OUTPUT_DIRECTORY")
    collect(Path(sys.argv[1]))
