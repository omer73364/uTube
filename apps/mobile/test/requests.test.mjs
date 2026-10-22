import test from "node:test";
import assert from "node:assert/strict";
import { bounded, nativeFetch } from "../src/requests.ts";

test("metadata deadlines reject even when a transport ignores cancellation", async () => {
  let cancelled = 0;
  await assert.rejects(
    bounded(new Promise(() => {}), 15, () => cancelled++),
    /REQUEST_TIMEOUT/,
  );
  assert.equal(cancelled, 1);
});
test("successful metadata calls clear their deadline and preserve request bodies", async () => {
  let cancelled = 0;
  const request = nativeFetch(
    async (id, url, method, headers, body) => {
      assert.equal(url, "https://www.youtube.com/youtubei/v1/player");
      assert.equal(method, "POST");
      assert.equal(body, '{"videoId":"test"}');
      assert.equal(headers["content-type"], "application/json");
      return {
        url,
        status: 200,
        body: '{"ok":true}',
        headers: { "content-type": "application/json" },
      };
    },
    () => cancelled++,
  );
  const response = await request(
    new Request("https://www.youtube.com/youtubei/v1/player", {
      method: "POST",
    }),
    {
      body: '{"videoId":"test"}',
      headers: { "content-type": "application/json" },
    },
  );
  assert.deepEqual(await response.json(), { ok: true });
  assert.equal(response.url, "https://www.youtube.com/youtubei/v1/player");
  assert.equal(cancelled, 0);
});

test("aborting lookup rejects promptly and cancels its native request", async () => {
  const controller = new AbortController();
  let started;
  const ready = new Promise((resolve) => {
    started = resolve;
  });
  const cancelled = [];
  const request = nativeFetch(
    async () => {
      started();
      return new Promise(() => {});
    },
    (id) => cancelled.push(id),
  );
  const result = request("https://www.youtube.com/iframe_api", {
    signal: controller.signal,
  });
  await ready;
  controller.abort();
  await assert.rejects(result, /CANCELLED/);
  assert.equal(cancelled.length, 1);
});
