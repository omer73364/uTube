import { createDownloadEngine } from "../packages/core/engine.js";
let client;
export const setYouTubeClient = (value) => { client = value; };
export const getYouTubeClient = () => client;
const engine = createDownloadEngine({ client: {
  getInfo: (...args) => client.getInfo(...args),
  getPlaylist: (...args) => client.getPlaylist(...args),
} });
export const getEngine = () => engine;
