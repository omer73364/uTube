// Keep the SDK in the initial Metro bundle. Dynamic imports trigger a second
// development-server request when a foreground/headless download starts.
import { Innertube, Platform, Player } from "youtubei.js/react-native";
import { nativeFetch, bounded } from "./requests";
import { playbackFetch } from "./playback";
import { inspectVideo, resolveVideo } from "./inspect";
import { downloads } from "./native";
import { getVideoOrListID } from "../../../packages/core/url-parser.js";
import { collectPlaylist } from "./playlist";
import type { MediaMode, Preview, PlaylistPreview } from "./domain";

export function createYouTubeService(
  evaluate: (script: string) => Promise<Record<string, string>>,
) {
  let player: Player | undefined;
  const transport = playbackFetch(
    nativeFetch(
      (...args) => downloads.http(...args),
      (id) => downloads.cancelHttp(id),
    ),
  );
  async function client(signal?: AbortSignal) {
    if (signal?.aborted) throw new Error("CANCELLED");
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
      return collectPlaylist(
        parsed.id,
        await yt.getPlaylist(parsed.id),
        signal,
      );
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
