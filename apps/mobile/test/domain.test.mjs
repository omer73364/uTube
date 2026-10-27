import test from "node:test";
import assert from "node:assert/strict";
import { videoId, mediaURL, progress, playerResult } from "../src/domain.ts";
test("single-video input shares core URL validation and rejects playlists and unrelated hosts", () => {
  assert.equal(videoId("https://youtu.be/jNQXAC9IVRw"), "jNQXAC9IVRw");
  assert.equal(
    videoId("https://youtube.com/watch?v=jNQXAC9IVRw&list=PL123"),
    "jNQXAC9IVRw",
  );
  assert.throws(
    () => videoId("https://youtube.com/playlist?list=PL123"),
    /PLAYLIST_NOT_YET/,
  );
  assert.throws(() =>
    videoId("https://youtube.com.evil.test/watch?v=jNQXAC9IVRw"),
  );
});
test("the YouTube resolver accepts only HTTPS Google video hosts", () => {
  assert.equal(
    mediaURL("https://rr1.googlevideo.com/videoplayback?sig=abc"),
    "https://rr1.googlevideo.com/videoplayback?sig=abc",
  );
  for (const input of [
    "http://rr1.googlevideo.com/videoplayback",
    "https://googlevideo.com.evil.test/video",
    "file:///tmp/media.mp4",
    "https://user:password@rr1.googlevideo.com/video",
  ])
    assert.throws(() => mediaURL(input));
});
test("progress handles unknown totals, impossible values, and completed byte counts", () => {
  assert.equal(progress({ loaded: 5, total: 10 }), 0.5);
  assert.equal(progress({ loaded: 20, total: 10 }), 1);
  assert.equal(progress({ loaded: 5, total: -1 }), undefined);
  assert.equal(progress({ loaded: NaN, total: 10 }), undefined);
});
test("isolated player replies accept only signature strings and reject forged native commands", () => {
  assert.deepEqual(playerResult('{"id":"1","value":{"n":"abc","sig":"xyz"}}'), {
    id: "1",
    value: { n: "abc", sig: "xyz" },
  });
  for (const data of [
    '{"id":"1","value":{"openFile":"/secret"}}',
    '{"id":"1","value":{"n":{}}}',
    '{"value":{}}',
    "[]",
    "x".repeat(32769),
  ])
    assert.throws(() => playerResult(data));
});
