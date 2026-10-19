// YouTube mixes legacy playlist renderers, lockups, and Shorts in the same feed.
export const normalizePlaylistItem = (item) => {
  if (item.is_playable === false) return null;
  if (item.content_type && item.content_type !== "VIDEO") return null;
  const id = item.id || item.content_id || item.on_tap_endpoint?.payload?.videoId;
  if (!id) return null;
  const title = item.title || item.metadata?.title || item.overlay_metadata?.primary_text;
  return { id, title: String(title || id) };
};
export const getPlaylist = async (client, id) => {
  let page = await client.getPlaylist(id);
  const info = page.info;
  const items = [...page.items];
  while (page.has_continuation) {
    page = await page.getContinuation();
    items.push(...page.items);
  }
  return { info, items: items.map(normalizePlaylistItem).filter(Boolean) };
};
