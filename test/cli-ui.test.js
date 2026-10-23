import test from "node:test";
import assert from "node:assert/strict";
import { duration, videoCard } from "../apps/cli/functions/ui.js";

test("video information includes duration and views while stripping terminal controls", () => {
  assert.equal(duration(3671), "1:01:11");
  assert.equal(duration(62), "01:02");
  assert.equal(duration(NaN), "—");
  const lines = [];
  const original = console.log;
  try {
    console.log = (value) => lines.push(value);
    videoCard({
      title: "\x1b[31mExample\nvideo",
      channel: "A channel",
      seconds: 62,
      views: 12345,
      audio: false,
      quality: "1080p",
      folder: "/Downloads",
      id: "jNQXAC9IVRw",
    });
  } finally {
    console.log = original;
  }
  const output = lines.join("\n");
  assert.match(output, /Example video/);
  assert.match(output, /01:02/);
  assert.match(output, /12,345/);
  assert.match(output, /MP4 · 1080p/);
  assert.match(output, /https:\/\/youtu.be\/jNQXAC9IVRw/);
  assert.doesNotMatch(output, /\x1b/);
});
