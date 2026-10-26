import os from "node:os";
import path from "node:path";
import inquirer from "./prompts.js";
import { createFFmpegManager } from "../../../packages/core/ffmpeg.js";
import {
  interactive,
  promptOptions,
  info,
  failure,
  success,
  createTransferDisplay,
} from "./ui.js";
import { setFFmpegPath } from "./service.js";

const directory =
  process.platform === "win32"
    ? path.join(process.env.LOCALAPPDATA || os.homedir(), "uTube")
    : process.platform === "darwin"
      ? path.join(os.homedir(), "Library", "Application Support", "uTube")
      : path.join(
          process.env.XDG_DATA_HOME ||
            path.join(os.homedir(), ".local", "share"),
          "utube",
        );
export const mediaTools = createFFmpegManager({ directory });
let asked = false;
export async function installFFmpeg() {
  info(
    "Downloading FFmpeg from the ffmpeg-static project on GitHub. It is saved for uTube only; no administrator access is needed.",
  );
  const controller = new AbortController();
  const cancel = () => controller.abort(new Error("FFmpeg setup cancelled."));
  process.once("SIGINT", cancel);
  process.once("SIGTERM", cancel);
  let display;
  let file;
  try {
    file = await mediaTools.install({
      signal: controller.signal,
      onProgress: ({ loaded, total }) => {
        display ||= createTransferDisplay("Downloading FFmpeg", total);
        display.update(loaded, total);
      },
    });
  } finally {
    display?.stop();
    process.removeListener("SIGINT", cancel);
    process.removeListener("SIGTERM", cancel);
  }
  setFFmpegPath(file);
  success("FFmpeg is ready. MP3 audio and HD video downloads are available.");
}
export async function ensureFFmpeg(needed, { optional = false } = {}) {
  const file = await mediaTools.resolve();
  if (file) {
    setFFmpegPath(file);
    return;
  }
  if (!needed || asked) return;
  if (optional && (!mediaTools.supported || process.env.UTUBE_FFMPEG)) return;
  if (!interactive())
    throw new Error(
      "This download requires FFmpeg. Run utube --install-ffmpeg, or install FFmpeg yourself.",
    );
  asked = true;
  const { install } = await inquirer.prompt([
    {
      ...promptOptions,
      type: "confirm",
      name: "install",
      default: true,
      message:
        "Download FFmpeg for uTube? This enables MP3 audio and HD video (about 20–30 MB).",
    },
  ]);
  if (install) await installFFmpeg();
  else if (!optional)
    throw new Error(
      "FFmpeg setup was skipped. Run utube --install-ffmpeg when ready, or choose a lower video quality.",
    );
}

export async function offerFFmpegAtStartup() {
  if (!interactive()) return;
  try {
    await ensureFFmpeg(true, { optional: true });
  } catch (error) {
    failure(error.message || error);
  }
}
