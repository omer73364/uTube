import axios from "axios";
import util from "util";
import { exec as normal_exec } from "child_process";
import { oraPromise } from "ora";
import { getSetting } from "./heperFunctions.js";
const exec = util.promisify(normal_exec);

const getLatestVersion = async () => {
  const { data } = await axios.get(
    "https://raw.githubusercontent.com/omer73364/uTube/main/version.js",
    { responseType: "text" }
  );
  const srartIndex = data.indexOf('"') + 1;
  const endIndex = data.indexOf('"', srartIndex);
  return Number(data.slice(srartIndex, endIndex).replace(/\./g, ""));
};

export const autoUpdate = async () => {
  const { version } = await import(`${global.packagePath}/version.js`);
  const downloadFolder = getSetting("downloadFolder");
  const currentVersion = Number(version.replace(/\./g, ""));
  const latestVersion = await getLatestVersion();
  if (currentVersion < latestVersion) {
    console.clear();
    await oraPromise(exec("npm update -g utube-cli"), "- Updating uTube..");
    logger.bold.cyan("  - [uTube]: Updated Successfully, now try again ✅\n");
    if (downloadFolder) {
      await exec(`utube --set-download-folder ${downloadFolder}`);
    }
    process.exit();
  }
};
