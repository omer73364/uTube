import fs from "fs";
import readline from "readline";
import terminal from "terminal-kit";
import cliProgress from "cli-progress";
import { oraPromise } from "ora";
import { Innertube, Utils } from "youtubei.js";

export const initialize = async (withInternet = false) => {
  try {
    if (!withInternet) {
      global.fs = fs;
      global.readline = readline;
      global.logger = terminal.terminal;
      global.packagePath = import.meta.url
        .replace("file://", "")
        .split("/")
        .slice(0, -2)
        .join("/");
    } else {
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
    }
  } catch (err) {
    logger.red("  - Error: Internet Connection Error!", err.toString());
    process.exit();
  }
};
