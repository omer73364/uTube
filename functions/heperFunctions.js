export { specialRemover, getVideoOrListID, availavleQualities, convertToWatchUrl } from "../packages/core/urls.js";
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

