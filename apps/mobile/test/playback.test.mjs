import test from "node:test";
import assert from "node:assert/strict";
import { playbackFetch } from "../src/playback.ts";
test("iOS player requests use playback parameters without dropping context or cancellation", async () => {
  const controller = new AbortController();
  let calls = 0;
  const fetch = playbackFetch(async (url, init) => {
    calls++;
    assert.equal(init.signal, controller.signal);
    const b = JSON.parse(init.body);
    assert.equal(b.params, "2AMB");
    assert.equal(b.videoId, "jNQXAC9IVRw");
    assert.equal(b.context.client.clientName, "iOS");
    return new Response("{}");
  });
  await fetch("https://www.youtube.com/youtubei/v1/player", {
    method: "POST",
    signal: controller.signal,
    body: JSON.stringify({
      context: { client: { clientName: "iOS" } },
      videoId: "jNQXAC9IVRw",
    }),
  });
  assert.equal(calls, 1);
});
test("playlist, other client and foreign-host requests keep their original bodies", async () => {
  const input = JSON.stringify({
    context: { client: { clientName: "ANDROID" } },
    params: "original",
  });
  const fetch = playbackFetch(async (url, init) => {
    assert.equal(init.body, input);
    return new Response("{}");
  });
  await fetch("https://www.youtube.com/youtubei/v1/player", {
    method: "POST",
    body: input,
  });
  await fetch("https://www.youtube.com/youtubei/v1/browse", {
    method: "POST",
    body: input,
  });
  const ios = JSON.stringify({ context: { client: { clientName: "IOS" } } });
  await playbackFetch(async (url, init) => {
    assert.equal(init.body, ios);
    return new Response("{}");
  })("https://unrelated.example/youtubei/v1/player", {
    method: "POST",
    body: ios,
  });
});

test("SDK Request objects carry the method while init carries the JSON body", async () => {
  const input = new Request("https://www.youtube.com/youtubei/v1/player", {
    method: "POST",
  });
  let calls = 0;
  const fetch = playbackFetch(async (request, init) => {
    calls++;
    assert.equal(request, input);
    assert.equal(JSON.parse(init.body).params, "2AMB");
    return new Response("{}");
  });
  await fetch(input, {
    body: JSON.stringify({ context: { client: { clientName: "iOS" } } }),
  });
  assert.equal(calls, 1);
});
