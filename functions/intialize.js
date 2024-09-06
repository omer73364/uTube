import fs from "fs";
import readline from "readline";
import terminal from "terminal-kit";
import cliProgress from "cli-progress";
import { oraPromise } from "ora";
import { Innertube, Utils } from "youtubei.js";

export const initializeLocalVariables = async () => {
  try {
    global.fs = fs;
    global.readline = readline;
    global.logger = terminal.terminal;
    global.packagePath = import.meta.url
      .replace("file://", "")
      .split("/")
      .slice(0, -2)
      .join("/");
  } catch (err) {
    logger.red("  - Error: Internet Connection Error!", err.toString());
    process.exit();
  }
};

export const initializeInternetVariables = async () => {
  try {
    console.clear();
    global.youtube = await oraPromise(
      Innertube.create(),
      "- Check internet connection.."
    );
    global.Utils = Utils;
    global.progressBar = new cliProgress.SingleBar(
      {
        format:
          "  - [uTube]: [{bar}] {percentage}% | ETA: {eta_formatted} | {value}/{total} ",
      },
      cliProgress.Presets.legacy
    );
  } catch (err) {
    logger.red("  - Error: Internet Connection Error!", err.toString());
    process.exit();
  }
};
