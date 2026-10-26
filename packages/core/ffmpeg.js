import fs from "node:fs/promises";
import { createReadStream, createWriteStream } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { createGunzip } from "node:zlib";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { release, releases } from "./ffmpeg-releases.js";

const run = promisify(execFile);
export async function probeFFmpeg(executable) {
  try {
    const { stdout } = await run(executable, ["-version"], {
      timeout: 5000,
      maxBuffer: 128 * 1024,
      windowsHide: true,
    });
    return /^ffmpeg version /i.test(stdout);
  } catch {
    return false;
  }
}
const hashFile = async (file) => {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest("hex");
};
export function createFFmpegManager({
  directory,
  platform = process.platform,
  arch = process.arch,
  fetch: fetcher = globalThis.fetch,
  probe = probeFFmpeg,
  manifest = releases,
}) {
  const target = `${platform}-${arch}`;
  const spec = manifest[target];
  const destination = path.join(directory, "ffmpeg", release, target);
  const executable = path.join(
    destination,
    platform === "win32" ? "ffmpeg.exe" : "ffmpeg",
  );
  let installing;
  async function validManaged() {
    if (!spec) return false;
    try {
      return (
        (await hashFile(executable)) === spec.executableSha256 &&
        (await probe(executable))
      );
    } catch {
      return false;
    }
  }
  async function resolve() {
    // An explicit override is authoritative, including for missing-tool diagnostics.
    if (process.env.UTUBE_FFMPEG)
      return (await probe(process.env.UTUBE_FFMPEG))
        ? process.env.UTUBE_FFMPEG
        : null;
    if (await probe("ffmpeg")) return "ffmpeg";
    return (await validManaged()) ? executable : null;
  }
  async function download(asset, file, signal, onProgress) {
    const response = await fetcher(asset.url, {
      signal,
      headers: {
        "User-Agent": "uTube-FFmpeg-setup",
        "Accept-Encoding": "identity",
      },
    });
    if (!response.ok || !response.body)
      throw new Error(`FFmpeg download failed (HTTP ${response.status}).`);
    let loaded = 0;
    const hash = createHash("sha256");
    const meter = new Transform({
      transform(chunk, _encoding, callback) {
        loaded += chunk.length;
        if (loaded > asset.size)
          return callback(
            new Error("FFmpeg download exceeded its expected size."),
          );
        hash.update(chunk);
        onProgress?.({ loaded, total: asset.size });
        callback(null, chunk);
      },
    });
    await pipeline(
      Readable.fromWeb(response.body),
      meter,
      createWriteStream(file, { flags: "wx", mode: 0o600 }),
      { signal },
    );
    if (loaded !== asset.size || hash.digest("hex") !== asset.sha256)
      throw new Error("FFmpeg verification failed. Please try again.");
  }
  async function install({ signal, onProgress } = {}) {
    if (installing) return installing;
    installing = (async () => {
      if (!spec)
        throw new Error(
          "Automatic FFmpeg setup is not available for this device. Install FFmpeg manually.",
        );
      if (process.env.UTUBE_FFMPEG)
        throw new Error(
          "UTUBE_FFMPEG is set. Fix or remove this override before downloading FFmpeg.",
        );
      if (await validManaged()) return executable;
      const parent = path.dirname(destination);
      await fs.mkdir(parent, { recursive: true });
      const temp = await fs.mkdtemp(path.join(parent, ".download-"));
      const timeout = AbortSignal.timeout(5 * 60 * 1000);
      const controller = new AbortController();
      const signals = [signal, timeout].filter(Boolean);
      const forwardAbort = (event) => controller.abort(event.target.reason);
      for (const source of signals) {
        if (source.aborted) controller.abort(source.reason);
        else source.addEventListener("abort", forwardAbort, { once: true });
      }
      const combined = controller.signal;
      try {
        const archive = path.join(temp, "ffmpeg.gz");
        await download(spec.binary, archive, combined, onProgress);
        const binary = path.join(temp, path.basename(executable));
        let expanded = 0;
        const bound = new Transform({
          transform(chunk, _encoding, callback) {
            expanded += chunk.length;
            callback(
              expanded > 200 * 1024 * 1024
                ? new Error("FFmpeg executable is too large.")
                : null,
              chunk,
            );
          },
        });
        await pipeline(
          createReadStream(archive),
          createGunzip(),
          bound,
          createWriteStream(binary, { flags: "wx", mode: 0o700 }),
          { signal: combined },
        );
        if ((await hashFile(binary)) !== spec.executableSha256)
          throw new Error("FFmpeg verification failed. Please try again.");
        await fs.chmod(binary, 0o755);
        await download(spec.license, path.join(temp, "LICENSE"), combined);
        await download(spec.readme, path.join(temp, "README"), combined);
        if (!(await probe(binary)))
          throw new Error(
            "FFmpeg could not run on this device. Install it manually instead.",
          );
        combined.throwIfAborted();
        await fs.unlink(archive);
        // Publish only a complete, verified tool; interrupted setup never becomes usable.
        if (!(await validManaged()))
          await fs.rm(destination, { recursive: true, force: true });
        try {
          await fs.rename(temp, destination);
        } catch (error) {
          if (!(await validManaged())) throw error;
        }
        return executable;
      } finally {
        for (const source of signals)
          source.removeEventListener("abort", forwardAbort);
        await fs.rm(temp, { recursive: true, force: true });
      }
    })().finally(() => {
      installing = undefined;
    });
    return installing;
  }
  return { resolve, install, supported: Boolean(spec), executable };
}
