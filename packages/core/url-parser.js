/** Parse supported YouTube links without Node.js dependencies. */
export const getVideoOrListID = (input) => {
  let url;
  try { url = new URL(/^https?:\/\//i.test(input) ? input : `https://${input}`); }
  catch { throw new Error("Enter a valid YouTube URL."); }
  const host = url.hostname.toLowerCase();
  if (!["youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com", "youtu.be", "www.youtu.be"].includes(host) || !["http:", "https:"].includes(url.protocol)) {
    throw new Error("Enter a valid YouTube URL.");
  }
  const parts = url.pathname.split("/").filter(Boolean);
  const id = host.endsWith("youtu.be") ? parts[0] : url.searchParams.get("v") || (["shorts", "embed", "live"].includes(parts[0]) ? parts[1] : null);
  if (id && /^[\w-]{11}$/.test(id)) return { type: "video", id };
  const list = url.searchParams.get("list");
  if (list && /^[\w-]+$/.test(list)) return { type: "list", id: list };
  throw new Error("No valid video or playlist found in the URL.");
};
