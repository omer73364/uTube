export const getVideoOrListID = (link) => {
  // check if url is a youtube valid url
  if (!/^(https?\:\/\/)?((www\.)?youtube\.com|youtu\.be)\/.+$/.test(link)) {
    term.red("\n  - enter a valid youtube URL! ❌");
    return null;
  }

  // get params
  const url = new URL(link);
  const video_id = url.searchParams.get("v");
  const playlist_id = url.searchParams.get("list");

  if (video_id) {
    term.cyan("\n  - Youtube video found ✅\n");
    term("  - getting video data..\n\n");
    return { type: "video", id: video_id };
  } else if (playlist_id) {
    term.cyan("\n  - Youtube playlist found ✅\n");
    return { type: "list", id: playlist_id };
  } else {
    term.red("\n  - No valid video or playlist found.. ❌");
    return null;
  }
};

export const downloadVideo = async (item, quality, listTitle, next) => {
  try {
    let stream = await youtube.download(item.id, {
      format: "mp4", // defaults to mp4
      quality: quality, // falls back to 360p if a specific quality isn't available
      type: "video+audio",
    });

    // to avoid naming errors
    let specialRemover = (dir) =>
      dir.replace(/[`~!@#$%^&*()_|+\-=?;:'",.<>\{\}\[\]\\\/]/gi, "");
    let title = specialRemover(item?.title?.text || item?.title);
    let listFolder;

    console.log(`  - [uTube]", "Start Downloading.. ${title}`);

    // download lists to folder with list name
    if (listTitle) {
      listFolder = "./" + specialRemover(listTitle);

      if (!fs.existsSync(listFolder)) {
        fs.mkdirSync(listFolder);
      }

      const file = fs.createWriteStream(`${listFolder}/.${title}.mp4`);
      for await (const chunk of Utils.streamToIterable(stream)) {
        file.write(chunk);
      }
      fs.rename(
        `${listFolder}/.${title}.mp4`,
        `${listFolder}/${title}.mp4`,
        function (err) {
          if (err) console.log("  - ERROR: " + err);
        }
      );
      next();
    } else {
      const file = fs.createWriteStream(`./.${title}.mp4`);
      for await (const chunk of Utils.streamToIterable(stream)) {
        file.write(chunk);
      }
      fs.rename(`./.${title}.mp4`, `./${title}.mp4`, function (err) {
        if (err) console.log("  - ERROR: " + err);
      });
    }
    term.cyan("  - Video Downloaded Successfully ✅\n\n");
  } catch (err) {
    if (err?.message?.includes("No matching formats found")) {
      downloadVideo(item, "360p", listTitle, next);
    } else console.log("  - [ERROR]", err);
  }
};

export const downloadList = (title, items, quality) => {
  let index = -1;
  const downloadNext = () => {
    index++;
    if (index < items.length) {
      term("\n");
      downloadVideo(items[index], quality, title, downloadNext);
    } else {
      term.cyan("\n  - Playlist Downloaded Successfully ✅\n");
    }
  };
  downloadNext();
};

export const availavleQualities = (list) =>
  list.filter((quality) => ["144p", "360p", "720p"].includes(quality));
