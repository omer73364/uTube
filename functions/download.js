import fs from "node:fs";
import path from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { spawn } from "node:child_process";
import inquirer from "inquirer";
import { oraPromise } from "ora";
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
  if (format.quality_label !== quality) console.log(`Requested ${quality} unavailable; using ${format.quality_label}.`);
  const folder = path.resolve(getSetting("downloadFolder", process.cwd()), ...(listTitle ? [specialRemover(listTitle)] : []));
  await fs.promises.mkdir(folder, { recursive: true });
  const title = specialRemover(String(item.title || info.basic_info?.title || item.id));
  const target = path.join(folder, `${title} [${item.id}].mp4`);
  if (fs.existsSync(target)) { console.log(`Skipping existing file: ${target}`); return; }
  const temp = await fs.promises.mkdtemp(path.join(folder, ".utube-"));
  try {
    if (!format.has_audio) await ffmpeg(["-version"]);
    console.log(`Downloading: ${title} (${format.quality_label})`);
    const stream = await info.download({ itag: format.itag });
    const total = format.content_length;
    progressBar.start(total || 100, 0);
    await saveStream(stream, path.join(temp, "video.mp4"), (loaded) => { if (total) progressBar.update(loaded); });
    progressBar.stop();
    let result = path.join(temp, "video.mp4");
    if (!format.has_audio) {
      const audio = info.chooseFormat({ type: "audio", format: "mp4", quality: "best" });
      await saveStream(await info.download({ itag: audio.itag }), path.join(temp, "audio.m4a"));
      result = path.join(temp, "merged.mp4");
      await ffmpeg(["-nostdin", "-y", "-i", path.join(temp, "video.mp4"), "-i", path.join(temp, "audio.m4a"), "-map", "0:v:0", "-map", "1:a:0", "-c", "copy", "-movflags", "+faststart", result]);
    }
    // Exclusive creation avoids overwriting a download created by another process.
    await fs.promises.copyFile(result, target, fs.constants.COPYFILE_EXCL);
    console.log(`Saved: ${target}`);
  } finally {
    progressBar.stop();
    await fs.promises.rm(temp, { recursive: true, force: true });
  }
};

export const download = async ({ url, quality }) => {
  const { type, id } = getVideoOrListID(url);
  if (type === "video") {
    const info = await oraPromise(getVideoData(id), "Getting video data..");
    if (!quality) quality = await askForQuality(availavleQualities(videoFormats(info).map((format) => format.quality_label)));
    await downloadVideo({ id, title: info.basic_info?.title }, undefined, quality, info);
    return;
  }
  const data = await oraPromise(getListData(id), "Getting playlist data..");
  if (!data.items.length) throw new Error("This playlist is empty or has no accessible videos.");
  const { videos } = await inquirer.prompt([{
    name: "videos", type: "checkbox", message: "Choose videos to download:",
    choices: data.items.map((item, i) => ({ name: `#${i + 1} ${item.title}`, value: i })),
  }]);
  if (!videos.length) { console.log("No videos selected."); return; }
  if (!quality) {
    const info = await getVideoData(data.items[videos[0]].id);
    quality = await askForQuality(availavleQualities(videoFormats(info).map((format) => format.quality_label)));
  }
  const errors = [];
  for (const index of videos) {
    const item = data.items[index];
    try { await downloadVideo({ id: item.id, title: `#${index + 1}_${item.title}` }, data.info?.title || id, quality); }
    catch (error) { errors.push(error); console.error(`Failed: ${item.title}: ${error.message}`); }
  }
  if (errors.length) throw new Error(`${errors.length} playlist download(s) failed.`);
  console.log("Playlist downloaded successfully.");
};
