import { createDownloadEngine } from "../../../packages/core/engine.js";
let client;
export const setYouTubeClient = (value) => {
  client = value;
};
export const getYouTubeClient = () => client;
let ffmpegPath;
export const setFFmpegPath = (value) => {
  ffmpegPath = value;
};
const makeEngine = () =>
  createDownloadEngine({
    client: {
      getInfo: (...args) => client.getInfo(...args),
      getPlaylist: (...args) => client.getPlaylist(...args),
    },
    ffmpegPath,
  });
export const getEngine = () => makeEngine();
