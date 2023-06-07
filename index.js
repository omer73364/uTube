#! /usr/bin/env node

import inquirer from "inquirer";
import terminal from "terminal-kit";
import { getListData, getVideoData } from "./functions/getData.js";
import {
  availavleQualities,
  downloadList,
  downloadVideo,
  getVideoOrListID,
} from "./functions/heperFunctions.js";

import Y from "youtubei.js";
import { oraPromise } from "ora";
import fs from "fs";
import readline from "readline";
import { version } from "./version.js";

if (process.argv.includes("-v")) {
  console.log(version);
  process.exit();
}

// initializing
try {
  console.clear();
  global.fs = fs;
  global.readline = readline;
  global.term = terminal.terminal;
  const { Innertube, Utils } = Y;
  global.youtube = await oraPromise(
    Innertube.create(),
    "- Check internet connection.."
  );
  global.Utils = Utils;
} catch (err) {
  term.red("  - Internet Connection Error!", err);
  process.exit();
}

// hello uTube
term.bold.cyan("\n----------------  uTube  ----------------\n\n");

// ask for URL
const { url } = await inquirer.prompt([
  {
    name: "url",
    message: "Enter (video/playlist) url:",
  },
]);

// check if the url for (video) or (playlist)
const urlResult = getVideoOrListID(url);

// if video
if (urlResult?.type === "video") {
  try {
    const { basic_info, streaming_data } = await oraPromise(
      getVideoData(urlResult.id),
      "- Get video data.."
    );
    const videoData = {
      id: urlResult.id,
      title: basic_info?.title,
    };

    term("  --------------------  \n");
    term.bold(`  - title: ${basic_info?.title}\n`);
    term("  --------------------  \n\n");

    const { quality } = await inquirer.prompt([
      {
        name: "quality",
        type: "list",
        choices: availavleQualities(
          streaming_data.formats.map((format) => format?.quality_label)
        ),
        message: "- Choose quality:",
      },
    ]);

    downloadVideo(videoData, quality);
  } catch (err) {
    term.red("  - Internet Connection Error!", err);
    process.exit();
  }
}

// if playlist
if (urlResult?.type === "list") {
  try {
    const data = await oraPromise(
      getListData(urlResult.id),
      "- Get playlist data.."
    );

    term("  --------------------  \n");
    term.bold(`  - title: ${data?.info?.title}\n`);
    term.bold(`  - videos: ${data?.info?.total_items}\n`);
    term("  --------------------  \n\n");

    // get available qualities for first video
    const { streaming_data } = await oraPromise(
      getVideoData(data.items[0].id),
      "- Get available qualities.."
    );

    const { quality } = await inquirer.prompt([
      {
        name: "quality",
        type: "list",
        choices: availavleQualities(
          streaming_data.formats.map((format) => format?.quality_label)
        ),
        message: "- Choose quality:",
      },
    ]);

    // select videos to be downloaded
    const { videos } = await inquirer.prompt([
      {
        name: "videos",
        type: "checkbox",
        choices: data.items.map((v, i) => `#${i + 1} - ${v.title}`),
        message: "- Choose videos to be downloaded:\n\n",
      },
    ]);

    const items = data.items.filter((vid, i) =>
      videos.includes(`#${i + 1} - ${vid.title}`)
    );
    term.yellow(`\n  - Start Downloading ${items.length} selected videos..\n`);
    downloadList(data?.info?.title, items, quality);
  } catch (err) {
    term.red("  - Internet Connection Error!", err);
    process.exit();
  }
}
