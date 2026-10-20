import path from "node:path";
import inquirer from "inquirer";
import { heading, details, info as note, success, warning, failure, task, text, interactive, promptOptions, createTransferDisplay } from "./ui.js";
import { getListData, getVideoData } from "./getData.js";
import { getEngine } from "./service.js";
import { availavleQualities, getSetting, getVideoOrListID } from "./heperFunctions.js";
import { askForQuality } from "./readInput.js";
import { videoFormats } from "../../../packages/core/formats.js";
import { createProgressFilter } from "../../../packages/core/progress.js";
export { videoFormats, selectFormat, selectAudioFormat } from "../../../packages/core/formats.js";
export { saveStream, downloadFormat, streamStatus, retryableStreamError } from "../../../packages/core/streams.js";

export const downloadVideo = async (item, playlistTitle, quality, info, audio = false) => {
  let display;
  let started = false;
  let formatWarning;
  const shownStages = new Set();
  const showProgress = createProgressFilter();
  const stages = { video: "Downloading video", audio: "Downloading audio", merging: "Merging video and audio", converting: "Converting to MP3" };
  try {
    const result = await getEngine().download({
      item, playlistTitle, quality, info, audio, folder: path.resolve(getSetting("downloadFolder", process.cwd())),
      onEvent(event) {
        if (!showProgress(event)) return;
        if (event.type === "start") {
          if (started) return;
          started = true;
          heading(event.title);
          details([["Format", event.format === "mp3" ? "MP3 · 192 kbps" : "MP4"], ...(event.quality ? [["Quality", event.quality]] : []), ["Save to", event.folder]]);
        } else if (event.type === "stage") {
          display?.stop();
          if (["video", "audio"].includes(event.stage)) {
            display = createTransferDisplay(stages[event.stage], event.total, { quiet: shownStages.has(event.stage) });
            shownStages.add(event.stage);
          }
          else { display = undefined; note(stages[event.stage]); }
        } else if (event.type === "progress") display?.update(event.loaded, event.total);
        else if (event.type === "retry") { formatWarning = undefined; }
        else if (event.type === "warning") formatWarning = event.message;
        else if (event.type === "saved" || event.type === "skipped") {
          display?.stop(); display = undefined;
          if (event.type === "saved" && formatWarning) warning(formatWarning);
          if (event.type === "saved") success(`Saved: ${event.path}`); else note(`Already downloaded: ${event.path}`);
        }
      },
    });
    return result.status;
  } finally { display?.stop(); }
};

export const download = async ({ url, quality, audio = false }) => {
  const { type, id } = getVideoOrListID(url);
  if (type === "video") {
    const info = await task("Loading video details", () => getVideoData(id));
    heading(info.basic_info?.title || id);
    details([["Type", audio ? "Audio · MP3" : "Video · MP4"], ["Channel", info.basic_info?.author || "Unknown"], ["Save to", getSetting("downloadFolder", process.cwd())]]);
    if (!audio && !quality) quality = await askForQuality(availavleQualities(videoFormats(info).map((format) => format.quality_label)));
    await downloadVideo({ id, title: info.basic_info?.title }, undefined, quality, info, audio);
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
  if (!audio && !quality) {
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
      const result = await downloadVideo({ id: item.id, title: `#${index + 1}_${item.title}` }, data.info?.title || id, quality, undefined, audio);
      if (result === "skipped") skipped++; else saved++;
    } catch (error) { errors.push(error); failure(`${item.title}: ${error.message}`); }
  }
  heading("Playlist complete");
  details([["Saved", saved], ["Skipped", skipped], ["Failed", errors.length], ["Time", `${Math.round((Date.now() - started) / 1000)}s`]]);
  if (errors.length) throw new Error(`${errors.length} playlist download(s) failed.`);
  success("All selected videos are ready.");
};
