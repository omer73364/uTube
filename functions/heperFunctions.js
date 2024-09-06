import fs from "fs";

export const getSetting = (key, defaultValue) => {
  try {
    const value =
      JSON.parse(fs.readFileSync("./settings.json", "utf8"))[key] ||
      defaultValue;
    return value;
  } catch (err) {
    return defaultValue;
  }
};

export const specialRemover = (dir) => {
  return dir.replace(/[`~!@#$%^&*()_|+\-=?;:'",.<>\{\}\[\]\\\/]/gi, "");
};

export const getVideoOrListID = (link) => {
  // check if url is a youtube valid url
  if (!/^(https?\:\/\/)?((www\.)?youtube\.com|youtu\.be)\/.+$/.test(link)) {
    logger.red("\n  - enter a valid youtube URL! ❌");
    return {};
  }

  // get params
  const url = new URL(link);
  const video_id = url.searchParams.get("v");
  const playlist_id = url.searchParams.get("list");

  if (video_id) {
    logger.cyan("\n  - Youtube video found ✅\n\n");
    return { type: "video", id: video_id };
  } else if (playlist_id) {
    logger.cyan("\n  - Youtube playlist found ✅\n");
    return { type: "list", id: playlist_id };
  } else {
    logger.red("\n  - No valid video or playlist found.. ❌");
    return {};
  }
};

export const availavleQualities = (list) => {
  return list.filter((quality) => ["144p", "360p", "720p"].includes(quality));
};

export const convertToWatchUrl = (url) => {
  if (url.includes("playlist")) return url;
  const regex =
    /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|embed|watch)\?v=|shorts\/)|youtu\.be\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/;
  const match = url.match(regex);

  if (match) {
    const videoId = match[1];
    return `https://www.youtube.com/watch?v=${videoId}`;
  }

  return null; // Return null if the URL is not valid
};
