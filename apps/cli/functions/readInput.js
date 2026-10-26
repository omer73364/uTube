import { installFFmpeg, mediaTools, offerFFmpegAtStartup } from "./ffmpeg.js";
import inquirer from "./prompts.js";
import { welcome } from "./welcome.js";
import { muted, details, success, interactive, promptOptions } from "./ui.js";
import { version } from "../../../version.js";
import { getSetting, setDownloadFolder, getVideoOrListID } from "./heperFunctions.js";

export const askForQuality = async (qualities) => {
  if (!qualities.length) throw new Error("No downloadable video formats available.");
  if (!interactive()) throw new Error("Choose a quality with -q, for example -q 720p.");
  const choices = [...qualities].reverse().map((quality, index) => ({
    name: `${quality.padEnd(9)}${index === 0 ? muted("Best available") : ""}`, value: quality,
  }));
  const { quality } = await inquirer.prompt([{ ...promptOptions, name: "quality", type: "list", choices, message: "Video quality", loop: false }]);
  return quality;
};

export const home = async () => {
  while (true) {
    details([["Save to", getSetting("downloadFolder", process.cwd())]]);
    const { action } = await inquirer.prompt([{
      ...promptOptions, name: "action", type: "list", message: "What would you like to do?",
      choices: [
        { name: "↓  Download a video or playlist", value: "download" },
        { name: "♫  Download audio (MP3)", value: "audio" },
        { name: "▣  Change download folder", value: "folder" },
        ...(!await mediaTools.resolve() ? [{ name: "↓  Download FFmpeg (MP3 & HD video)", value: "ffmpeg" }] : []),
        { name: "↗  Exit", value: "exit" },
      ],
    }]);
    if (action === "ffmpeg") {
      if (await mediaTools.resolve()) success("FFmpeg is already available.");
      else await installFFmpeg();
      continue;
    }
    if (action !== "folder") return action;
    const { folder } = await inquirer.prompt([{
      ...promptOptions, name: "folder", message: "Download folder",
      default: getSetting("downloadFolder", process.cwd()), filter: (value) => value.trim(),
      validate: (value) => Boolean(value) || "Enter a folder path.",
    }]);
    setDownloadFolder(folder);
    success("Download folder updated");
  }
};

export const askForURL = async () => {
  const { url } = await inquirer.prompt([{
    ...promptOptions, name: "url", message: "YouTube URL", filter: (value) => value.trim(),
    validate: (value) => { try { getVideoOrListID(value); return true; } catch (error) { return error.message; } },
  }]);
  return url;
};

export const readArgs = async () => {
  const args = process.argv.slice(2);
  const values = {};
  const flags = new Set(["-v", "--version", "-h", "--help", "--get-download-folder", "-a", "--audio", "--install-ffmpeg"]);
  const valued = new Set(["-u", "-q", "--set-download-folder"]);
  for (let i = 0; i < args.length; i++) {
    const key = args[i];
    if (!flags.has(key) && !valued.has(key)) throw new Error(`Unknown argument: ${key}`);
    if (valued.has(key)) {
      if (!args[i + 1] || args[i + 1].startsWith("-")) throw new Error(`Missing value for ${key}`);
      values[key] = args[++i];
    } else values[key] = true;
  }
  if (values["-v"] || values["--version"]) { console.log(`uTube v${version}`); return null; }
  if (values["-h"] || values["--help"]) {
    console.log(`Usage: utube [-u <YouTube URL>] [-q <quality>] [--audio]

Run utube without arguments to open the interactive menu.

  -u <url>                     Video or playlist URL
  -q <quality>                 Quality, for example 720p
  -a, --audio                  Download audio as MP3 (requires FFmpeg)
  --install-ffmpeg             Download FFmpeg for uTube (MP3 and HD video)
  -v, --version                Show version
  --set-download-folder <path> Remember a download folder
  --get-download-folder        Show download folder
  -h, --help                   Show this help

Example: utube -u "https://youtu.be/jNQXAC9IVRw" -q 360p`);
    return null;
  }
  if (values["--install-ffmpeg"]) { await installFFmpeg(); return null; }
  if (values["--set-download-folder"]) {
    setDownloadFolder(values["--set-download-folder"]);
    console.log(`Download folder: ${getSetting("downloadFolder")}`);
    return null;
  }
  if (values["--get-download-folder"]) { console.log(getSetting("downloadFolder", process.cwd())); return null; }
  if (values["-q"] && !/^\d+p(?:\d+)?$/.test(values["-q"])) throw new Error("Quality must look like 360p or 720p.");
  let audio = Boolean(values["-a"] || values["--audio"]);
  if (audio && values["-q"]) throw new Error("-q selects video resolution. Omit it when using --audio.");
  const session = args.length === 0 && interactive();
  if (interactive()) { welcome(); await offerFFmpegAtStartup(); }
  if (session) {
    const action = await home();
    if (action === "exit") return null;
    audio = action === "audio";
  }
  let url = values["-u"];
  if (!url) {
    if (!interactive()) throw new Error("Provide a YouTube URL with -u <url>.");
    url = await askForURL();
  }
  getVideoOrListID(url);
  return { url, quality: values["-q"], audio, session };
};
