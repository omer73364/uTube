import { getVideoOrListID } from "./url-parser.js";
export { getVideoOrListID } from "./url-parser.js";

export const specialRemover = (title) => {
  let name = String(title || "video").replace(/[<>:"/\\|?*\x00-\x1f]/g, "_").replace(/[. ]+$/g, "").slice(0, 150);
  const characters = Array.from(name);
  while (Buffer.byteLength(characters.join(""), "utf8") > 180) characters.pop();
  name = characters.join("").replace(/[. ]+$/g, "");
  if (!name || /^\.+$/.test(name)) name = "video";
  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name)) name = `_${name}`;
  return name;
};


export const availavleQualities = (list) => [...new Set(list.filter(Boolean))].sort((a, b) => parseInt(a) - parseInt(b));
export const convertToWatchUrl = (input) => {
  const { type, id } = getVideoOrListID(input);
  return type === "video" ? `https://www.youtube.com/watch?v=${id}` : `https://www.youtube.com/playlist?list=${id}`;
};
