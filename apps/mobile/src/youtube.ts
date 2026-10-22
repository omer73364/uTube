import { nativeFetch, bounded } from "./requests";
import { inspectVideo, resolveVideo } from "./inspect";
import { downloads } from "./native";
import { getVideoOrListID } from "../../../packages/core/url-parser.js";
import { normalizePlaylistItem } from "../../../packages/core/playlist.js";
import type { MediaMode, Preview, PlaylistPreview } from "./domain";

export function createYouTubeService(
  evaluate: (script: string) => Promise<Record<string, string>>,
) {
  let player: import("youtubei.js").Player | undefined;
  const transport = nativeFetch(
    (...args) => downloads.http(...args),
    (id) => downloads.cancelHttp(id),
  );
  async function client(signal?: AbortSignal) {
    if (signal?.aborted) throw new Error("CANCELLED");
    const { Innertube, Platform } = await import("youtubei.js/react-native");
    Platform.shim.eval = (data) => evaluate(data.output);
    Platform.shim.sha1Hash = (input) => downloads.sha1(input);
    Platform.shim.uuidv4 = () => {
      const bytes = new Uint8Array(16);
      (
        globalThis as unknown as {
          crypto: { getRandomValues(bytes: Uint8Array): Uint8Array };
        }
      ).crypto.getRandomValues(bytes);
      bytes[6] = (bytes[6] & 15) | 64;
      bytes[8] = (bytes[8] & 63) | 128;
      const hex = Array.from(bytes, (value) =>
        value.toString(16).padStart(2, "0"),
      ).join("");
      return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    };
    return Innertube.create({
      retrieve_player: false,
      generate_session_locally: true,
      retrieve_innertube_config: false,
      lang: "en",
      location: "US",
      fetch: (input, init) => {
        if (signal?.aborted) return Promise.reject(new Error("CANCELLED"));
        return transport(input, { ...init, signal });
      },
    });
  }
  return {
    async inspect(
      url: string,
      signal?: AbortSignal,
    ): Promise<Preview | PlaylistPreview> {
      const parsed = getVideoOrListID(url.trim());
      const yt = await client(signal);
      if (parsed.type === "video") return inspectVideo(parsed.id, yt);
      let page = await yt.getPlaylist(parsed.id);
      const title = String(page.info.title || parsed.id).slice(0, 180);
      const items: PlaylistPreview["items"] = [];
      const seen = new Set<string>();
      for (let pages = 0; ; pages++) {
        if (signal?.aborted) throw new Error("CANCELLED");
        for (const raw of page.items) {
          const item = normalizePlaylistItem(raw);
          if (
            item &&
            /^[A-Za-z0-9_-]{11}$/.test(item.id) &&
            !seen.has(item.id)
          ) {
            seen.add(item.id);
            items.push({ ...item, index: items.length + 1 });
          }
        }
        if (!page.has_continuation) break;
        if (pages >= 199 || items.length > 20000)
          throw new Error("PLAYLIST_TOO_LARGE");
        page = await page.getContinuation();
      }
      if (!items.length) throw new Error("EMPTY_PLAYLIST");
      return { kind: "playlist", id: parsed.id, title, items };
    },
    async resolve(
      id: string,
      quality: string,
      mode: MediaMode,
      signal?: AbortSignal,
    ) {
      const yt = await client(signal);
      return resolveVideo(id, yt, quality, mode, async () => {
        if (!player) {
          const { Player } = await import("youtubei.js/react-native");
          player = await bounded(
            Player.create(undefined, yt.session.http.fetch_function),
            60000,
          );
        }
        yt.session.player = player;
      });
    },
  };
}
