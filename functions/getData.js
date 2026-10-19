import { getEngine } from "./service.js";
export { normalizePlaylistItem } from "../packages/core/playlist.js";
export const getVideoData = (id, name) => getEngine().getVideoData(id, name);
export const getListData = (id) => getEngine().getPlaylist(id);
