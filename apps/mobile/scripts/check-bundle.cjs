const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const app = path.resolve(__dirname, "..");
const file =
  process.argv[2] ||
  path.join(
    app,
    "android/app/build/intermediates/sourcemaps/react/prototype/index.android.bundle.packager.map",
  );
const roots = new Set();
function inspect(map) {
  for (const source of map.sources || []) {
    const normalized = source.replaceAll("\\", "/");
    const marker = "/node_modules/react/";
    const index = normalized.lastIndexOf(marker);
    if (index >= 0) roots.add(normalized.slice(0, index + marker.length - 1));
  }
  for (const section of map.sections || []) inspect(section.map);
}
inspect(JSON.parse(fs.readFileSync(file, "utf8")));
const expected = path
  .dirname(require.resolve("react/package.json", { paths: [app] }))
  .replaceAll("\\", "/");
assert.deepEqual(
  [...roots],
  [expected],
  "The Android bundle must contain only the mobile app's React instance",
);
console.log("Android bundle uses one React instance: " + expected);
