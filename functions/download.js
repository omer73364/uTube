import fs from "fs";
import axios from "axios";
import inquirer from "inquirer";
import { cwd } from "process";
import { oraPromise } from "ora";
import { getListData, getVideoData } from "./getData.js";
import {
  availavleQualities,
  convertToWatchUrl,
  getSetting,
  getVideoOrListID,
  specialRemover,
} from "./heperFunctions.js";
import { askForQuality } from "./readInput.js";

const downloadList = (title, items) => {
  let index = -1;
  const downloadNext = async () => {
    index++;
    if (index < items.length) {
      logger("\n");
      const { streaming_data } = await getVideoData(items[index].id);
      const defaultQuality = streaming_data?.formats?.[0];
      const selectedQuality = streaming_data?.formats?.find(
        (q) => q.quality_label === items[index].quality
      );
      items[index].quality = selectedQuality || defaultQuality;
      downloadVideo(items[index], title, downloadNext);
    } else {
      logger.cyan("\n  - Playlist Downloaded Successfully ✅\n");
    }
  };
  downloadNext();
};

const downloadVideo = async (item, listTitle, next) => {
  try {
    const downloadFolder = getSetting("downloadFolder", cwd());
    const title = specialRemover(item?.title?.text || item?.title);
    const listFolder = listTitle ? `/${specialRemover(listTitle)}` : "";
    const downloadPath = `${downloadFolder}${listFolder}`;
    if (!fs.existsSync(downloadPath)) {
      fs.mkdirSync(downloadPath);
    }

    console.log(`  - [uTube]: "Start Downloading.. ${title}`);

    const url = item.quality.decipher(youtube.session.player);
    const tempPath = `${downloadFolder}/.${Date.now()}`;
    const videoPath = `${downloadPath}/${item?.title}.mp4`;

    progressBar.start(100, 0);

    // downloading..
    const response = await axios.get(url, {
      responseType: "stream",
      onDownloadProgress: (progressEvent) => {
        const { loaded, total } = progressEvent;
        const percentage = Math.round((loaded * 100) / total);
        progressBar.update(percentage);
      },
    });
    const writer = fs.createWriteStream(tempPath);
    response.data.pipe(writer);

    writer.on("finish", () => {
      progressBar.stop();
      fs.renameSync(tempPath, videoPath);
      logger.cyan("  - Video Downloaded Successfully ✅\n\n");
      if (next) next();
    });
  } catch (err) {
    if (err?.message?.includes("No matching formats found")) {
      downloadVideo(item, "360p", listTitle, next);
    } else console.log("  - [ERROR]", err.toString());
  }
};

export const download = async (args) => {
  const url = args.url;
  let quality = args.quality;

  // check if the url for (video) or (playlist)
  const urlResult = getVideoOrListID(convertToWatchUrl(url));

  // if video
  if (urlResult.type === "video") {
    try {
      const { basic_info, streaming_data } = await oraPromise(
        getVideoData(urlResult.id),
        "- Getting video data.."
      );
      const qualities = streaming_data?.formats?.map(
        ({ quality_label }) => quality_label
      );

      const videoData = {
        id: urlResult.id,
        title: basic_info?.title,
      };

      logger("  --------------------  \n");
      logger.bold(`  - title: ${basic_info?.title}\n`);
      logger("  --------------------  \n");

      if (!quality) {
        quality = await askForQuality(availavleQualities(qualities));
      }

      videoData.quality = streaming_data.formats.find(
        (format) => format?.quality_label === quality
      );

      downloadVideo(videoData);
    } catch (err) {
      logger.red("  - Error: Failed To Download Video!", err.toString());
      process.exit();
    }
  }

  // if playlist
  else if (urlResult?.type === "list") {
    try {
      const data = await oraPromise(
        getListData(urlResult.id),
        "- Getting playlist data.."
      );

      logger("  --------------------  \n");
      logger.bold(`  - title: ${data?.info?.title}\n`);
      logger.bold(`  - videos: ${data?.info?.total_items}\n`);
      logger("  --------------------  \n\n");

      // get available qualities for first video
      const { streaming_data } = await oraPromise(
        getVideoData(data.items[0].id),
        "- Getting available qualities.."
      );
      const qualities = streaming_data?.formats?.map(
        ({ quality_label }) => quality_label
      );

      if (!quality) {
        quality = await askForQuality(availavleQualities(qualities));
      }

      // select videos to be downloaded
      const { videos } = await inquirer.prompt([
        {
          name: "videos",
          type: "checkbox",
          choices: data.items.map((v, i) => ` - #${i + 1}_${v.title}`),
          message: "- Choose videos to be downloaded:\n\n",
        },
      ]);

      const items = data.items.filter((vid, i) => {
        vid.quality = quality;
        vid.title = `#${i + 1}_${vid.title}`;
        return videos.includes(` - ${vid.title}`);
      });

      logger.yellow(
        `\n  - Start Downloading ${items.length} selected videos..\n`
      );

      downloadList(data?.info?.title, items, quality);
    } catch (err) {
      logger.red("  -  Error: Failed To Download Playlist!", err.toString());
      process.exit();
    }
  }
};
