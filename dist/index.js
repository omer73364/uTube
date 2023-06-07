#! /usr/bin/env node
"use strict";

var _inquirer = _interopRequireDefault(import ("inquirer"));

var _terminalKit = _interopRequireDefault(import("terminal-kit"));

var _getData = import("../functions/getData.js");

var _heperFunctions = import("../functions/heperFunctions.js");

var _youtubei = _interopRequireDefault(import("youtubei.js"));

var _ora = import("ora");

var _fs = _interopRequireDefault(import("fs"));

var _readline = _interopRequireDefault(import("readline"));

import { version as _version } from "../version.js";

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

if (process.argv.includes('-v')) {
  console.log(_version);
  process.exit();
} // initializing


try {
  console.clear();
  global.fs = _fs.default;
  global.readline = _readline.default;
  global.term = _terminalKit.default.terminal;
  global.youtube = await (0, _ora.oraPromise)(new _youtubei.default(), '- Check internet connection..');
} catch (err) {
  term.red('  - Internet Connection Error!');
  process.exit();
} // hello uTube


term.bold.cyan('\n----------------  uTube  ----------------\n\n'); // ask for URL

const {
  url
} = await _inquirer.default.prompt([{
  name: 'url',
  message: 'Enter (video/playlist) url:'
}]); // check if the url for (video) or (playlist)

const urlResult = (0, _heperFunctions.getVideoOrListID)(url); // if video

if (urlResult?.type === 'video') {
  try {
    const {
      title,
      metadata
    } = await (0, _ora.oraPromise)((0, _getData.getVideoData)(urlResult.id), '- Get video data..');
    const videoData = {
      id: urlResult.id,
      title
    };
    term('  --------------------  \n');
    term.bold(`  - title: ${title}\n`);
    term('  --------------------  \n\n');
    const {
      quality
    } = await _inquirer.default.prompt([{
      name: 'quality',
      type: 'list',
      choices: (0, _heperFunctions.availavleQualities)(metadata.available_qualities),
      message: '- Choose quality:'
    }]);
    (0, _heperFunctions.downloadVideo)(videoData, quality);
  } catch (err) {
    term.red('  - Internet Connection Error!');
    process.exit();
  }
} // if playlist


if (urlResult?.type === 'list') {
  try {
    const data = await (0, _ora.oraPromise)((0, _getData.getListData)(urlResult.id), '- Get playlist data..');
    term('  --------------------  \n');
    term.bold(`  - title: ${data.title}\n`);
    term.bold(`  - videos: ${data.total_items}\n`);
    term('  --------------------  \n\n'); // get available qualities for first video

    const video = await (0, _ora.oraPromise)((0, _getData.getVideoData)(data.items[0].id), '- Get available qualities..');
    const {
      quality
    } = await _inquirer.default.prompt([{
      name: 'quality',
      type: 'list',
      choices: (0, _heperFunctions.availavleQualities)(video.metadata.available_qualities),
      message: '- Choose quality:'
    }]); // select videos to be downloaded

    const {
      videos
    } = await _inquirer.default.prompt([{
      name: 'videos',
      type: 'checkbox',
      choices: data.items.map((v, i) => `#${i + 1} - ${v.title}`),
      message: '- Choose videos to be downloaded:\n\n'
    }]);
    const items = data.items.filter((vid, i) => videos.includes(`#${i + 1} - ${vid.title}`));
    term.yellow(`\n  - Start Downloading ${items.length} selected videos..\n`);
    (0, _heperFunctions.downloadList)(data.title, items, quality);
  } catch (err) {
    term.red('  - Internet Connection Error!');
    process.exit();
  }
}