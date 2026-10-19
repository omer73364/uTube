import fs from "node:fs";
import path from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { spawn } from "node:child_process";
import inquirer from "inquirer";
import { heading, details, info as note, success, warning, failure, task, transfer, text, interactive, promptOptions } from "./ui.js";
import { getListData, getVideoData } from "./getData.js";
import { availavleQualities, getSetting, getVideoOrListID, specialRemover } from "./heperFunctions.js";
import { askForQuality } from "./readInput.js";

export const videoFormats = (info) => [
  ...(info.streaming_data?.formats || []),
  ...(info.streaming_data?.adaptive_formats || []),
].filter((format) => format.has_video && format.mime_type?.includes("video/mp4") && (format.url || format.signature_cipher || format.cipher));

export const selectFormat = (info, quality) => {
  const formats = videoFormats(info);
  if (!formats.length) throw new Error(info.playability_status?.reason || "No downloadable MP4 formats available.");
  const matching = formats.filter((format) => format.quality_label === quality);
  // Preserve the documented 360p fallback, then use the lowest available quality.
  const fallback = formats.filter((format) => format.quality_label === "360p");
  const candidates = matching.length ? matching : fallback.length ? fallback : [...formats].sort((a, b) => a.height - b.height);
  return candidates.find((format) => format.has_audio) || candidates[0];
};

export const saveStream = async (stream, filename, onProgress = () => {}) => {
  let loaded = 0;
  const progress = new Transform({ transform(chunk, encoding, callback) {
    loaded += chunk.length;
    onProgress(loaded);
    callback(null, chunk);
  } });
  try {
    await pipeline(Readable.fromWeb(stream), progress, fs.createWriteStream(filename));
  } catch (error) {
    await fs.promises.rm(filename, { force: true });
    throw error;
  }
};

export const streamStatus = (error) => error?.info?.response?.status;
export const retryableStreamError = (error) => {
  const status = streamStatus(error);
  return [403, 408, 410, 429].includes(status) || status >= 500 ||
    ["ECONNRESET", "ETIMEDOUT", "UND_ERR_SOCKET", "UND_ERR_CONNECT_TIMEOUT"].includes(error?.cause?.code || error?.code) ||
    error?.message === "terminated";
};

export const downloadFormat = async (info, format) => {
  const type = format.has_video ? (format.has_audio ? "video+audio" : "video") : "audio";
  const total = Number(format.content_length);
  if (!Number.isSafeInteger(total) || total <= 0) return info.download({ itag: format.itag, type });
  // Buffer each small range before publishing it so a failed range can be retried
  // without duplicating bytes already written to disk.
  async function* chunks() {
    const chunkSize = 256 * 1024;
    for (let start = 0; start < total; start += chunkSize) {
      const end = Math.min(start + chunkSize, total) - 1;
      for (let attempt = 0; ; attempt++) {
        try {
          const stream = await info.download({ itag: format.itag, type, range: { start, end } });
          const parts = [];
          let received = 0;
          for await (const part of stream) {
            received += part.length;
            if (received > end - start + 1) throw new Error("Server ignored the requested byte range.");
            parts.push(part);
          }
          if (received !== end - start + 1) {
            const error = new Error("Incomplete download range.");
            error.code = "ECONNRESET";
            throw error;
          }
          yield Buffer.concat(parts);
          break;
        } catch (error) {
          if (attempt >= 1 || !retryableStreamError(error)) throw error;
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }
    }
  }
  return Readable.toWeb(Readable.from(chunks()));
};

const ffmpeg = (args) => new Promise((resolve, reject) => {
  const child = spawn("ffmpeg", args, { stdio: ["ignore", "ignore", "pipe"] });
  let detail = "";
  child.stderr.on("data", (data) => { detail = (detail + data).slice(-2000); });
  child.on("error", (err) => reject(new Error(err.code === "ENOENT" ? "This quality requires FFmpeg. Install ffmpeg and try again." : err.message)));
  child.on("close", (code) => code === 0 ? resolve() : reject(new Error(`FFmpeg failed: ${detail}`)));
});

export const downloadVideo = async (item, listTitle, quality, suppliedInfo) => {
  const info = suppliedInfo || await getVideoData(item.id);
  const format = selectFormat(info, quality);
  if (format.quality_label !== quality) warning(`Requested ${quality} unavailable; using ${format.quality_label}.`);
  const folder = path.resolve(getSetting("downloadFolder", process.cwd()), ...(listTitle ? [specialRemover(listTitle)] : []));
  await fs.promises.mkdir(folder, { recursive: true });
  const title = specialRemover(String(item.title || info.basic_info?.title || item.id));
  const target = path.join(folder, `${title} [${item.id}].mp4`);
  if (fs.existsSync(target)) { note(`Already downloaded: ${target}`); return "skipped"; }
  const temp = await fs.promises.mkdtemp(path.join(folder, ".utube-"));
  try {
    if (!format.has_audio) await ffmpeg(["-version"]);
    heading(title);
    details([["Quality", format.quality_label], ["Save to", folder]]);
    await transfer("Downloading video", format.content_length, async (update) => {
      const stream = await downloadFormat(info, format);
      await saveStream(stream, path.join(temp, "video.mp4"), update);
    });
    let result = path.join(temp, "video.mp4");
    if (!format.has_audio) {
      const audio = info.chooseFormat({ type: "audio", format: "mp4", quality: "best" });
      await transfer("Downloading audio", audio.content_length, async (update) => {
        await saveStream(await downloadFormat(info, audio), path.join(temp, "audio.m4a"), update);
      });
      result = path.join(temp, "merged.mp4");
      await task("Merging video and audio", () => ffmpeg(["-nostdin", "-y", "-i", path.join(temp, "video.mp4"), "-i", path.join(temp, "audio.m4a"), "-map", "0:v:0", "-map", "1:a:0", "-c", "copy", "-movflags", "+faststart", result]));
    }
    // Exclusive creation avoids overwriting a download created by another process.
    await fs.promises.copyFile(result, target, fs.constants.COPYFILE_EXCL);
    success(`Saved: ${target}`);
    return "saved";
  } finally {
    await fs.promises.rm(temp, { recursive: true, force: true });
  }
};

export const download = async ({ url, quality }) => {
  const { type, id } = getVideoOrListID(url);
  if (type === "video") {
    const info = await task("Loading video details", () => getVideoData(id));
    heading(info.basic_info?.title || id);
    details([["Type", "Video"], ["Channel", info.basic_info?.author || "Unknown"], ["Save to", getSetting("downloadFolder", process.cwd())]]);
    if (!quality) quality = await askForQuality(availavleQualities(videoFormats(info).map((format) => format.quality_label)));
    await downloadVideo({ id, title: info.basic_info?.title }, undefined, quality, info);
    return;
  }
  const data = await task("Loading playlist", () => getListData(id));
  if (!data.items.length) throw new Error("This playlist is empty or has no accessible videos.");
  heading(data.info?.title || "Playlist");
  details([["Videos", data.items.length], ["Save to", getSetting("downloadFolder", process.cwd())]]);
  if (!interactive()) throw new Error("Playlist selection needs an interactive terminal. Run utube in your terminal.");
  const { selection } = await inquirer.prompt([{
    ...promptOptions, name: "selection", type: "list", message: "What would you like to download?",
    choices: [
      { name: `All ${data.items.length} videos`, value: "all" },
      { name: "Choose specific videos", value: "custom" },
      { name: "Cancel", value: "cancel" },
    ],
  }]);
  if (selection === "cancel") { note("Download cancelled."); return; }
  const videos = selection === "all" ? data.items.map((_, index) => index) : (await inquirer.prompt([{
    ...promptOptions, name: "videos", type: "checkbox", message: "Select videos",
    choices: data.items.map((item, i) => ({ name: `#${i + 1} ${text(item.title)}`, value: i })),
    validate: (selected) => selected.length > 0 || "Select at least one video, or press Ctrl+C to exit.",
    loop: false,
  }])).videos;
  if (!quality) {
    const info = await task("Loading available qualities", () => getVideoData(data.items[videos[0]].id));
    quality = await askForQuality(availavleQualities(videoFormats(info).map((format) => format.quality_label)));
  }
  const errors = [];
  let saved = 0;
  let skipped = 0;
  const started = Date.now();
  for (const index of videos) {
    const item = data.items[index];
    note(`Video ${videos.indexOf(index) + 1} of ${videos.length}`);
    try {
      const result = await downloadVideo({ id: item.id, title: `#${index + 1}_${item.title}` }, data.info?.title || id, quality);
      if (result === "skipped") skipped++; else saved++;
    } catch (error) { errors.push(error); failure(`${item.title}: ${error.message}`); }
  }
  heading("Playlist complete");
  details([["Saved", saved], ["Skipped", skipped], ["Failed", errors.length], ["Time", `${Math.round((Date.now() - started) / 1000)}s`]]);
  if (errors.length) throw new Error(`${errors.length} playlist download(s) failed.`);
  success("All selected videos are ready.");
};
