import { downloads } from "./native";
import { mediaURL, videoId, type Preview } from "./domain";
import type { PlayerEvaluator } from "./PlayerSandbox";

export function createInspector(evaluate: PlayerEvaluator["evaluate"]) {
  let clientPromise: Promise<import("youtubei.js").Innertube> | undefined;
  async function client() {
    if (!clientPromise)
      clientPromise = (async () => {
        const { Innertube, Platform } =
          await import("youtubei.js/react-native");
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
          generate_session_locally: true,
          retrieve_innertube_config: false,
          lang: "en",
          location: "US",
          fetch: (async (input, init) => {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 20000);
            try {
              return await fetch(input, { ...init, signal: controller.signal });
            } finally {
              clearTimeout(timeout);
            }
          }) as typeof fetch,
        });
      })().catch((error) => {
        clientPromise = undefined;
        throw error;
      });
    return clientPromise;
  }
  return async (url: string): Promise<Preview> => {
    const id = videoId(url);
    const yt = await client();
    let lastError: unknown;
    for (const clientType of ["IOS", "ANDROID_VR", "ANDROID"] as const) {
      try {
        const info = await yt.getBasicInfo(id, { client: clientType });
        const candidates = (info.streaming_data?.formats || []).filter(
          (format) =>
            format.has_video &&
            format.has_audio &&
            format.mime_type?.startsWith("video/mp4"),
        );
        const formats = [];
        for (const format of candidates) {
          try {
            formats.push({
              id: format.itag,
              quality: format.quality_label || `${format.height}p`,
              url: mediaURL(await format.decipher(yt.session.player)),
            });
          } catch (error) {
            lastError = error;
          }
        }
        if (formats.length)
          return {
            id,
            title: info.basic_info.title || id,
            author: info.basic_info.author || "",
            formats,
          };
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError || new Error("NO_COMBINED_MP4");
  };
}
