import { checkAbort, withAbort, abortError } from "./cancellation.js";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { videoFormats, selectFormat, selectAudioFormat } from "./formats.js";
import { saveStream, downloadFormat, streamStatus, retryableStreamError } from "./streams.js";
import { specialRemover, getVideoOrListID, availavleQualities } from "./urls.js";
import { getPlaylist } from "./playlist.js";

const ffmpeg = (args, executable = "ffmpeg", signal) => new Promise((resolve, reject) => {
  try { checkAbort(signal); } catch (error) { reject(error); return; }
  const child = spawn(executable, args, { stdio: ["ignore", "ignore", "pipe"] });
  let killTimer;
  const cancel = () => {
    child.kill('SIGTERM');
    killTimer = setTimeout(() => child.kill('SIGKILL'), 2000);
    killTimer.unref();
  };
  signal?.addEventListener('abort', cancel, { once: true });
  if (signal?.aborted) cancel();
  let detail = "";
  child.stderr.on("data", (data) => { detail = (detail + data).slice(-2000); });
  child.on("error", (err) => reject(new Error(err.code === "ENOENT" ? "This download requires FFmpeg. Install ffmpeg and try again." : err.message)));
  child.on("close", (code) => {
    signal?.removeEventListener('abort', cancel);
    clearTimeout(killTimer);
    if (signal?.aborted) reject(abortError());
    else if (code === 0) resolve();
    else reject(new Error(`FFmpeg failed: ${detail}`));
  });
});

const downloadAttempt = async ({ item, playlistTitle: listTitle, quality, info: suppliedInfo, audio: audioOnly = false, folder: destination, ffmpegPath, onEvent: emit, signal }, getVideoData) => {
  checkAbort(signal);
  const info = suppliedInfo || await getVideoData(item.id);
  const format = audioOnly ? selectAudioFormat(info) : selectFormat(info, quality);
  if (!audioOnly && parseInt(format.quality_label) !== parseInt(quality)) emit({ type: "warning", message: `Requested ${quality} unavailable; using ${format.quality_label}.` });
  const folder = path.resolve(destination, ...(listTitle ? [specialRemover(listTitle)] : []));
  await fs.promises.mkdir(folder, { recursive: true });
  const title = specialRemover(String(item.title || info.basic_info?.title || item.id));
  const target = path.join(folder, `${title} [${item.id}].${audioOnly ? "mp3" : "mp4"}`);
  if (fs.existsSync(target)) { emit({ type: "skipped", path: target }); return { status: "skipped", path: target }; }
  const temp = await fs.promises.mkdtemp(path.join(folder, ".utube-"));
  try {
    if (audioOnly || !format.has_audio) await ffmpeg(["-version"], ffmpegPath, signal);
    emit({ type: "start", title, folder, format: audioOnly ? "mp3" : "mp4", quality: format.quality_label });
    const transfer = async (stage, media, filename) => {
      const stream = await downloadFormat(info, media, signal);
      emit({ type: "stage", stage, total: Number(media.content_length) || undefined });
      await saveStream(stream, filename, (loaded) => emit({ type: "progress", stage, loaded, total: Number(media.content_length) || undefined }), signal);
    };
    const source = path.join(temp, audioOnly ? "source.media" : "video.mp4");
    await transfer(audioOnly ? "audio" : "video", format, source);
    let result = source;
    if (audioOnly) {
      result = path.join(temp, "audio.mp3");
      emit({ type: "stage", stage: "converting" });
      await ffmpeg([
        "-nostdin", "-y", "-i", source, "-map", "0:a:0", "-vn",
        "-c:a", "libmp3lame", "-b:a", "192k", "-metadata", `title=${String(item.title || info.basic_info?.title || item.id)}`, result,
      ], ffmpegPath, signal);
    } else if (!format.has_audio) {
      const audio = info.chooseFormat({ type: "audio", format: "mp4", quality: "best" });
      await transfer("audio", audio, path.join(temp, "audio.m4a"));
      result = path.join(temp, "merged.mp4");
      emit({ type: "stage", stage: "merging" });
      await ffmpeg(["-nostdin", "-y", "-i", path.join(temp, "video.mp4"), "-i", path.join(temp, "audio.m4a"), "-map", "0:v:0", "-map", "1:a:0", "-c", "copy", "-movflags", "+faststart", result], ffmpegPath, signal);
    }
    checkAbort(signal);
    // Exclusive creation avoids overwriting a download created by another process.
    await fs.promises.copyFile(result, target, fs.constants.COPYFILE_EXCL);
    emit({ type: "saved", path: target });
    return { status: "saved", path: target };
  } finally {
    await fs.promises.rm(temp, { recursive: true, force: true });
  }
};

export function createDownloadEngine({ client, ffmpegPath = "ffmpeg" }) {
  const getVideoData = (id, name = "IOS") => client.getInfo(id, { client: name });
  return {
    getVideoData,
    getPlaylist: (id) => getPlaylist(client, id),
    async inspect(url, { signal } = {}) {
      checkAbort(signal);
      const { type, id } = getVideoOrListID(url);
      if (type === "list") {
        const data = await getPlaylist(client, id, { signal });
        return { type: "playlist", id, title: String(data.info?.title || id), items: data.items };
      }
      const info = await withAbort(getVideoData(id), signal);
      return {
        type: "video", id, title: String(info.basic_info?.title || id),
        author: String(info.basic_info?.author || ""),
        duration: info.basic_info?.duration || 0,
        thumbnail: info.basic_info?.thumbnail?.at(-1)?.url || null,
        qualities: availavleQualities(videoFormats(info).map((format) => format.quality_label)),
      };
    },
    async download(options) {
      if (!options.folder || !path.isAbsolute(options.folder)) throw new Error("An absolute download folder is required.");
      checkAbort(options.signal);
      const emit = options.onEvent || (() => {});
      for (const [attempt, name] of ["IOS", "IOS", "ANDROID"].entries()) {
        try {
          const info = attempt === 0 && options.info ? options.info : await withAbort(getVideoData(options.item.id, name), options.signal);
          return await downloadAttempt({ ...options, info, ffmpegPath, onEvent: emit }, getVideoData);
        } catch (error) {
          checkAbort(options.signal);
          const status = streamStatus(error);
          if (!retryableStreamError(error) || attempt === 2) {
            if (status) throw new Error(`Download rejected (HTTP ${status}). Try again later${options.audio ? "" : " or choose another quality"}.`, { cause: error });
            throw error;
          }
          emit({ type: "retry", attempt: attempt + 1, message: `Stream ${status ? `returned HTTP ${status}` : "was interrupted"}; refreshing download links (${attempt + 1}/2).` });
        }
      }
    },
  };
}
