import inquirer from "inquirer";
import { version } from "../version.js";
import { getSetting, setDownloadFolder, getVideoOrListID } from "./heperFunctions.js";

export const askForQuality = async (qualities) => {
  if (!qualities.length) throw new Error("No downloadable video formats available.");
  const { quality } = await inquirer.prompt([{ name: "quality", type: "list", choices: qualities, message: "Choose quality:" }]);
  return quality;
};

export const readArgs = async () => {
  const args = process.argv.slice(2);
  const values = {};
  const flags = new Set(["-v", "--version", "-h", "--help", "--get-download-folder"]);
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
    console.log("Usage: utube [-u <YouTube URL>] [-q <quality>]\n\n-v, --version\n--set-download-folder <path>\n--get-download-folder\n-h, --help");
    return null;
  }
  if (values["--set-download-folder"]) {
    setDownloadFolder(values["--set-download-folder"]);
    console.log(`Download folder: ${getSetting("downloadFolder")}`);
    return null;
  }
  if (values["--get-download-folder"]) { console.log(getSetting("downloadFolder", process.cwd())); return null; }
  if (values["-q"] && !/^\d+p(?:\d+)?$/.test(values["-q"])) throw new Error("Quality must look like 360p or 720p.");
  let url = values["-u"];
  if (!url) {
    if (!process.stdin.isTTY) throw new Error("Provide a YouTube URL with -u <url>.");
    ({ url } = await inquirer.prompt([{ name: "url", message: "Enter (video/playlist) URL:" }]));
  }
  getVideoOrListID(url);
  return { url, quality: values["-q"] };
};
