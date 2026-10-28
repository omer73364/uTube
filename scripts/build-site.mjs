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
  "desktop-ar-light.png",
  "mobile-device.jpg",
  "mobile-device-ar.jpg",
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
// Preserve the signed app-update feed across ordinary website deployments.
try {
  await fs.access(path.join(root, "website/updates/manifest.json"));
  await fs.mkdir(path.join(output, "updates"), { recursive: true });
  await fs.copyFile(path.join(root, "website/updates/manifest.json"), path.join(output, "updates/manifest.json"));
} catch (error) { if (error.code !== 'ENOENT') throw error; }
await fs.writeFile(path.join(output, ".nojekyll"), "");
console.log(`Static website built: ${output}`);
