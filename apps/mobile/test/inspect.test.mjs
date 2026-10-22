import test from "node:test";
import assert from "node:assert/strict";
import { inspectVideo } from "../src/inspect.ts";

const format = (client, extra = {}) => ({
  itag: 18,
  quality_label: "360p",
  mime_type: "video/mp4",
  has_video: true,
  has_audio: true,
  decipher: async () => `https://rr1.googlevideo.com/video?client=${client}`,
  ...extra,
});
test("rejected media links fall through to another client before a format is shown", async () => {
  const clients = [];
  const yt = {
    session: { player: {} },
    async getBasicInfo(id, { client }) {
      clients.push(client);
      return {
        basic_info: { title: "Test video", author: "Author" },
        streaming_data: { formats: client === "IOS" ? [] : [format(client)] },
      };
    },
  };
  const result = await inspectVideo(
    "jNQXAC9IVRw",
    yt,
    async (url) => new URL(url).searchParams.get("client") === "ANDROID",
  );
  assert.deepEqual(clients, ["IOS", "ANDROID_VR", "ANDROID"]);
  assert.equal(result.title, "Test video");
  assert.equal(
    new URL(result.formats[0].url).searchParams.get("client"),
    "ANDROID",
  );
});
test("unusable and video-only streams never become download choices", async () => {
  let probes = 0;
  const yt = {
    session: { player: {} },
    async getBasicInfo() {
      return {
        basic_info: {},
        streaming_data: {
          formats: [format("bad"), format("silent", { has_audio: false })],
        },
      };
    },
  };
  await assert.rejects(
    inspectVideo("jNQXAC9IVRw", yt, async () => {
      probes++;
      return false;
    }),
    /NO_COMBINED_MP4/,
  );
  assert.equal(probes, 3);
});
