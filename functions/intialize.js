import fs from "fs";
import readline from "readline";
import terminal from "terminal-kit";
import cliProgress from "cli-progress";
import { oraPromise } from "ora";
import { Innertube, Utils } from "youtubei.js";
import { Platform } from "youtubei.js";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";

// YouTube.js requires an evaluator for its generated player decipher script.
Platform.shim.eval = async (data) => runInNewContext(data.output, {}, { timeout: 5000 });

export const initializeLocalVariables = async () => {
  try {
    global.fs = fs;
    global.readline = readline;
    global.logger = terminal.terminal;
    global.packagePath = fileURLToPath(new URL("../", import.meta.url));
  } catch (err) {
    throw err;
  }
};

export const initializeInternetVariables = async () => {
  try {
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
    throw new Error(`Could not initialize YouTube: ${err.message}`, { cause: err });
  }
};
