import inquirer from "inquirer";
import { paintPrompt } from "./ui.js";

// Keep Inquirer's keyboard handling and validation; theme its rendered text in
// our own prompt module rather than changing the dependency or global colors.
const prompt = inquirer.createPromptModule();
for (const name of ["list", "input", "checkbox", "confirm"]) {
  const Base = prompt.prompts[name];
  prompt.registerPrompt(name, class extends Base {
    constructor(...args) {
      super(...args);
      const render = this.screen.render.bind(this.screen);
      this.screen.render = (message, bottom) => render(paintPrompt(message), paintPrompt(bottom));
    }
  });
}
export default { ...inquirer, prompt };
