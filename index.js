#! /usr/bin/env node
import inquirer from "inquirer";
import { initializeInternetVariables } from "./functions/intialize.js";
import { readArgs, home, askForURL } from "./functions/readInput.js";
import { download } from "./functions/download.js";
import { failure, info, promptOptions } from "./functions/ui.js";

(async () => {
  try {
    let args = await readArgs();
    if (!args) return;
    do {
      try {
        if (!global.youtube) await initializeInternetVariables();
        await download(args);
      } catch (error) {
        failure(error.message || error);
        if (!args.session) { process.exitCode = 1; return; }
      }
      if (!args.session) return;
      const { again } = await inquirer.prompt([{
        ...promptOptions, name: "again", type: "confirm", message: "Back to the main menu?", default: true,
      }]);
      if (!again) break;
      const action = await home();
      if (action === "exit") break;
      args = { url: await askForURL(), audio: action === "audio", session: true };
    } while (true);
    info("See you next time.");
  } catch (err) {
    failure(err.message || err);
    process.exitCode = 1;
  }
})();
