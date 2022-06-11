export const getVideoData = async(id) => await youtube.getDetails(id);
export const getListData = async(id) =>await youtube.getPlaylist(id, { client: 'YOUTUBE' });