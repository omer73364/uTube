import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.join(root, "website/dist");
await fs.mkdir(path.join(output, "assets"), { recursive: true });
for (const file of ["index.html", "style.css", "app.js"])
  await fs.copyFile(path.join(root, "website", file), path.join(output, file));
for (const file of [
  "desktop-light.png",
  "desktop-ar-dark.png",
  "mobile-light.png",
  "mobile-ar-dark.png",
  "cli-download.png",
])
  await fs.copyFile(
    path.join(root, "docs/images", file),
    path.join(output, "assets", file),
  );
await fs.copyFile(
  path.join(root, "apps/desktop/assets/icon.svg"),
  path.join(output, "assets/icon.svg"),
);
await fs.writeFile(path.join(output, ".nojekyll"), "");
console.log(`Static website built: ${output}`);
