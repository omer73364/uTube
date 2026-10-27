import type { MediaMode, Preview, PlaylistPreview } from "./domain";
import type { DownloadRequest } from "./native";

export function shareRequests(
  preview: Preview | PlaylistPreview,
  mode: MediaMode,
  quality: string,
  selected?: ReadonlySet<number>,
): DownloadRequest[] {
  const items =
    preview.kind === "video"
      ? [{ id: preview.id, title: preview.title, index: 1, thumbnail: preview.thumbnail }]
      : preview.items
          .slice(0, 1000)
          .filter((item) => !selected || selected.has(item.index));
  if (!items.length) throw new Error("EMPTY_PLAYLIST");
  return items.map((item) => ({
    videoId: item.id,
    ...(item.thumbnail ? { thumbnail: item.thumbnail } : {}),
    title: item.title.slice(0, 180),
    mode,
    requestedQuality: mode === "mp3" ? "MP3" : quality,
    ...(preview.kind === "playlist"
      ? {
          playlistTitle: preview.title.slice(0, 180),
          playlistIndex: item.index,
        }
      : {}),
  }));
}
