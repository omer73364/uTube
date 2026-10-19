import { getPlaylist } from "../packages/core/playlist.js";
export { normalizePlaylistItem } from "../packages/core/playlist.js";
export const getVideoData = async (id, client = "IOS") => youtube.getInfo(id, { client });
export const getListData = async (id) => getPlaylist(youtube, id);
