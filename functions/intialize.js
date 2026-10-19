import { createYouTubeClient } from "../packages/core/youtube.js";
import { setYouTubeClient } from "./service.js";
import { task } from "./ui.js";
export const initializeInternetVariables = async () => {
  try { setYouTubeClient(await task("Connecting to YouTube", createYouTubeClient)); }
  catch (error) { throw new Error(`Could not initialize YouTube: ${error.message}`, { cause: error }); }
};
