import test from "node:test";
import assert from "node:assert/strict";
import { inspectVideo, resolveVideo } from "../src/inspect.ts";

const id = "jNQXAC9IVRw";
const format = (quality, extra = {}) => ({
  itag: 18,
  quality_label: quality,
  height: parseInt(quality),
  url: `https://rr1.googlevideo.com/video?q=${quality}`,
  mime_type: "video/mp4",
  has_video: true,
  has_audio: true,
  async decipher() {
    return this.url;
  },
  ...extra,
});
const info = (formats, adaptive_formats = []) => ({
  basic_info: { title: "Test video", author: "Author" },
  streaming_data: { formats, adaptive_formats },
});
const client = (getBasicInfo) => ({ session: { player: {} }, getBasicInfo });

test("lookup exposes adaptive HD choices without deciphering media", async () => {
  const hd = format("1080p", {
    has_audio: false,
    decipher() {
      throw Error("lookup must not decipher");
    },
  });
  const preview = await inspectVideo(
    id,
    client(async () => info([format("360p")], [hd])),
  );
  assert.deepEqual(preview.qualities, ["1080p", "360p"]);
  assert.equal(preview.title, "Test video");
});
test("lookup tries another client after unavailable metadata", async () => {
  const calls = [];
  const preview = await inspectVideo(
    id,
    client(async (_, { client }) => {
      calls.push(client);
      if (client === "IOS") throw Error("unavailable");
      return info([format("720p")]);
    }),
  );
  assert.deepEqual(calls, ["IOS", "VISIONOS"]);
  assert.deepEqual(preview.qualities, ["720p"]);
});
test("HD resolution pairs separate audio and exhausts exact quality before downgrading", async () => {
  let ready = false;
  const audio = format(undefined, {
    url: "https://rr1.googlevideo.com/audio",
    has_video: false,
    has_audio: true,
    mime_type: "audio/mp4",
    bitrate: 128000,
  });
  const yt = client(async (_, { client }) => {
    assert.equal(ready, true);
    return info(
      [format("360p", { url: `https://rr1.googlevideo.com/low?c=${client}` })],
      [
        format("1080p", {
          has_audio: false,
          url: `https://rr1.googlevideo.com/hd?c=${client}`,
        }),
        audio,
      ],
    );
  });
  const plan = await resolveVideo(id, yt, "1080p", "video", async () => {
    ready = true;
  });
  assert.deepEqual(
    plan.candidates.map((c) => c.quality),
    ["1080p", "1080p", "1080p", "1080p", "360p", "360p", "360p", "360p"],
  );
  assert.ok(plan.candidates[0].video);
  assert.ok(plan.candidates[0].audio);
  assert.equal(plan.candidates[4].audio, undefined);
});
test("best chooses highest resolution and ignores unsafe stream URLs", async () => {
  const yt = client(async () =>
    info([
      format("360p"),
      format("720p"),
      format("1080p", { url: "https://evil.example/video" }),
    ]),
  );
  const plan = await resolveVideo(id, yt, "best", "video", async () => {});
  assert.deepEqual(
    plan.candidates.map((c) => c.quality),
    ["720p", "360p"],
  );
});
test("MP3 resolves audio-only tracks without requiring video", async () => {
  const audio = format(undefined, {
    has_video: false,
    mime_type: "audio/mp4",
    url: "https://rr1.googlevideo.com/audio",
  });
  const plan = await resolveVideo(
    id,
    client(async () => info([], [audio])),
    "best",
    "mp3",
    async () => {},
  );
  assert.equal(plan.requestedQuality, "MP3");
  assert.equal(plan.candidates.length, 1);
  assert.ok(plan.candidates[0].audio);
  assert.equal(plan.candidates[0].video, undefined);
});
