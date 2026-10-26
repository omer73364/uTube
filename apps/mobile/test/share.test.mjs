import test from "node:test";
import assert from "node:assert/strict";
import { shareRequests } from "../src/share.ts";
const video = {
  kind: "video",
  id: "jNQXAC9IVRw",
  title: "Video",
  author: "Author",
  qualities: ["360p"],
  audioAvailable: true,
};
test("sharing a video preserves the selected audio mode and quality", () => {
  assert.deepEqual(shareRequests(video, "mp3", "best"), [
    {
      videoId: video.id,
      title: "Video",
      mode: "mp3",
      requestedQuality: "best",
    },
  ]);
});
test("sharing a playlist keeps its order and folder and bounds the queue", () => {
  const playlist = {
    kind: "playlist",
    title: "Playlist",
    id: "PL",
    items: Array.from({ length: 1001 }, (_, i) => ({
      id: video.id,
      title: "Video",
      index: i + 1,
    })),
  };
  const requests = shareRequests(playlist, "video", "720p");
  assert.equal(requests.length, 1000);
  assert.equal(requests[999].playlistIndex, 1000);
  assert.equal(requests[0].playlistTitle, "Playlist");
  assert.equal(requests[0].requestedQuality, "720p");
  assert.throws(
    () => shareRequests({ ...playlist, items: [] }, "video", "best"),
    /EMPTY_PLAYLIST/,
  );
});

test("playlist selection keeps original numbering and supports repeated videos", () => {
  const playlist = {
    kind: "playlist",
    title: "Mix",
    id: "PL",
    items: [1, 2, 3].map((index) => ({
      id: video.id,
      title: `Track ${index}`,
      index,
    })),
  };
  const requests = shareRequests(
    playlist,
    "video",
    "720p",
    new Set([1, 3, 999]),
  );
  assert.deepEqual(
    requests.map((r) => r.playlistIndex),
    [1, 3],
  );
  assert.deepEqual(
    requests.map((r) => r.title),
    ["Track 1", "Track 3"],
  );
  assert.throws(
    () => shareRequests(playlist, "video", "best", new Set()),
    /EMPTY_PLAYLIST/,
  );
  assert.equal(shareRequests(video, "video", "best", new Set()).length, 1);
});
