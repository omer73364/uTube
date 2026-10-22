import { normalizePlaylistItem } from "../../../packages/core/playlist.js";
import type { PlaylistPreview } from "./domain.ts";

type Page = {
  info: { title?: unknown };
  items: unknown[];
  has_continuation: boolean;
  getContinuation(): Promise<Page>;
};

export async function collectPlaylist(
  id: string,
  first: Page,
  signal?: AbortSignal,
): Promise<PlaylistPreview> {
  const title = String(first.info.title || id).slice(0, 180);
  const items: PlaylistPreview["items"] = [];
  const seen = new Set<string>();
  let page = first;
  for (let pages = 0; ; pages++) {
    if (signal?.aborted) throw new Error("CANCELLED");
    for (const raw of page.items) {
      const item = normalizePlaylistItem(raw);
      if (item && /^[A-Za-z0-9_-]{11}$/.test(item.id) && !seen.has(item.id)) {
        seen.add(item.id);
        items.push({
          ...item,
          title: item.title.slice(0, 180),
          index: items.length + 1,
        });
        if (items.length > 20000) throw new Error("PLAYLIST_TOO_LARGE");
      }
    }
    if (!page.has_continuation) break;
    if (pages >= 199) throw new Error("PLAYLIST_TOO_LARGE");
    page = await page.getContinuation();
  }
  if (!items.length) throw new Error("EMPTY_PLAYLIST");
  return { kind: "playlist", id, title, items };
}
