import fs from "fs";
import inquirer from "inquirer";
import { version } from "../version.js";
import { getSetting } from "./heperFunctions.js";

const askForURL = async () => {
  const { url } = await inquirer.prompt([
    {
      name: "url",
      message: "Enter (video/playlist) url:",
    },
  ]);
  return url;
};

export const askForQuality = async (qualities) => {
  const { quality } = await inquirer.prompt([
    {
      name: "quality",
      type: "list",
      choices: qualities,
      message: "- Choose quality:",
    },
  ]);
  return quality;
};

export const readArgs = async () => {
  // version
  if (process.argv.includes("-v")) {
    console.log(`\n-  [uTube]: v${version}\n`);
    process.exit();
  }

  // get download folder
  if (process.argv.includes("--get-download-folder")) {
    const downloadFolder = getSetting("downloadFolder");
    if (downloadFolder) {
      console.log(`\n-  [uTube]: Download Folder Path: ${downloadFolder}\n`);
    } else {
      console.log(
        `\n-  [uTube]: No Download Folder set, uTube will download in current folder\n`
      );
    }
    process.exit();
  }

  // set download folder
  if (process.argv.includes("--set-download-folder")) {
    const value_index = process.argv.indexOf("--set-download-folder") + 1;
    const path = process.argv[value_index] || "";
    // set downloadFolder in settings.json
    fs.writeFileSync(
      `${global.packagePath}/settings.json`,
      JSON.stringify({ downloadFolder: path })
    );
    console.log(
      '\n  - [uTube]: "Download Folder Set To: ' +
        (path || "current folder") +
        '" ✅\n'
    );
    process.exit();
  }

  const values = {};

  // url
  if (process.argv.includes("-u")) {
    const value_index = process.argv.indexOf("-u") + 1;
    values.url = process.argv[value_index];
  } else {
    values.url = await askForURL();
  }

  // quality
  if (process.argv.includes("-q")) {
    const value_index = process.argv.indexOf("-q") + 1;
    values.quality = process.argv[value_index];
  }

  return values;
};
