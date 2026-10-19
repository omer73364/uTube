export const getVideoData = async (id) => youtube.getInfo(id, { client: "IOS" });
export const getListData = async (id) => {
  let page = await youtube.getPlaylist(id);
  const info = page.info;
  const items = [...page.items];
  while (page.has_continuation) {
    page = await page.getContinuation();
    items.push(...page.items);
  }
  return { info, items: items.filter((item) => item.id) };
};
