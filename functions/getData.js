import Innertube from 'youtubei.js';
const youtube = await new Innertube();

export const getVideoData = async(id) => await youtube.getDetails(id);