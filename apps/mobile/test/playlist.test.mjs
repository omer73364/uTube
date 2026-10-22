import test from "node:test";
import assert from "node:assert/strict";
import { collectPlaylist } from "../src/playlist.ts";
const page = (items, next) => ({
  info: { title: "Playlist" },
  items,
  has_continuation: !!next,
  getContinuation: async () => next,
});
test("playlist pagination normalizes mixed renderers and omits inaccessible duplicates", async () => {
  const last = page([
    {
      content_id: "XIdA1AZ4zYI",
      content_type: "VIDEO",
      metadata: { title: "HD" },
    },
    { id: "jNQXAC9IVRw", title: "duplicate" },
    { id: "aaaaaaaaaaa", is_playable: false },
  ]);
  const result = await collectPlaylist(
    "PLtest",
    page([{ id: "jNQXAC9IVRw", title: "First" }, { id: "invalid" }], last),
  );
  assert.deepEqual(result.items, [
    { id: "jNQXAC9IVRw", title: "First", index: 1 },
    { id: "XIdA1AZ4zYI", title: "HD", index: 2 },
  ]);
});
test("empty or cancelled playlist lookups never return a partial queue", async () => {
  await assert.rejects(collectPlaylist("PLtest", page([])), /EMPTY_PLAYLIST/);
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    collectPlaylist("PLtest", page([{ id: "jNQXAC9IVRw" }]), controller.signal),
    /CANCELLED/,
  );
});
test("unbounded continuation feeds fail explicitly", async () => {
  const endless = page([]);
  endless.has_continuation = true;
  endless.getContinuation = async () => endless;
  await assert.rejects(
    collectPlaylist("PLtest", endless),
    /PLAYLIST_TOO_LARGE/,
  );
});
