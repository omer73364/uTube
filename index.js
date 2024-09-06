#! /usr/bin/env node
import { initialize } from "./functions/intialize.js";
import { welcome } from "./functions/welcome.js";
import { readArgs } from "./functions/readInput.js";
import { download } from "./functions/download.js";

(async () => {
  try {
    initialize();
    const { url, quality } = await readArgs();
    await initialize(true);
    welcome();
    await download({ url, quality });
  } catch (err) {
    console.log(err.toString());
  }
})();
