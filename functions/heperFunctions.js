import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

export const settingsPath = () => path.join(
  process.env.XDG_CONFIG_HOME || path.join(os.homedir(), ".config"),
  "utube-cli", "settings.json"
);

export const getSetting = (key, defaultValue = "") => {
  for (const filename of [settingsPath(), fileURLToPath(new URL("../settings.json", import.meta.url))]) {
    try {
      const settings = JSON.parse(fs.readFileSync(filename, "utf8"));
      if (Object.hasOwn(settings, key)) return settings[key] || defaultValue;
    } catch (err) {
      if (err.code !== "ENOENT") throw new Error(`Cannot read settings: ${err.message}`);
    }
  }
  return defaultValue;
};

export const setDownloadFolder = (folder) => {
  const filename = settingsPath();
  fs.mkdirSync(path.dirname(filename), { recursive: true });
  const expanded = folder === "~" ? os.homedir() : folder.replace(/^~[\\/]/, `${os.homedir()}/`);
  fs.writeFileSync(filename, JSON.stringify({ downloadFolder: expanded ? path.resolve(expanded) : "" }, null, 2));
};

export const specialRemover = (title) => {
  let name = String(title || "video").replace(/[<>:"/\\|?*\x00-\x1f]/g, "_").replace(/[. ]+$/g, "").slice(0, 150);
  if (!name || /^\.+$/.test(name)) name = "video";
  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name)) name = `_${name}`;
  return name;
};

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

export const availavleQualities = (list) => [...new Set(list.filter(Boolean))].sort((a, b) => parseInt(a) - parseInt(b));
export const convertToWatchUrl = (input) => {
  const { type, id } = getVideoOrListID(input);
  return type === "video" ? `https://www.youtube.com/watch?v=${id}` : `https://www.youtube.com/playlist?list=${id}`;
};
