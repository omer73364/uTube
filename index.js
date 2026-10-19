#! /usr/bin/env node
import {
  initializeInternetVariables,
  initializeLocalVariables,
} from "./functions/intialize.js";
import { welcome } from "./functions/welcome.js";
import { readArgs } from "./functions/readInput.js";
import { download } from "./functions/download.js";

(async () => {
  try {
    await initializeLocalVariables();
    const args = await readArgs();
    if (!args) return;
    const { url, quality } = args;
    await initializeInternetVariables();
    welcome();
    await download({ url, quality });
  } catch (err) {
    console.error(`  - [ERROR] ${err.message || err}`);
    process.exitCode = 1;
  }
})();
