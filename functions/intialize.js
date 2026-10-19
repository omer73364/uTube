import { runInNewContext } from "node:vm";
import { task } from "./ui.js";

export const initializeInternetVariables = async () => {
  try {
    global.youtube = await task("Connecting to YouTube", async () => {
      // Load the download engine only when needed, keeping local menus lightweight.
      const { Innertube, Platform } = await import("youtubei.js");
      // YouTube.js requires an evaluator for its generated player decipher script.
      Platform.shim.eval = async (data) => runInNewContext(data.output, {}, { timeout: 5000 });
      return Innertube.create();
    });
  } catch (err) {
    throw new Error(`Could not initialize YouTube: ${err.message}`, { cause: err });
  }
};
