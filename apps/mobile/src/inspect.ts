import type { Innertube } from "youtubei.js";
import { mediaURL, type Preview } from "./domain.ts";

export async function inspectVideo(
  id: string,
  yt: Pick<Innertube, "getBasicInfo" | "session">,
  probe: (url: string) => Promise<boolean>,
): Promise<Preview> {
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
          const streamURL = mediaURL(await format.decipher(yt.session.player));
          if (!(await probe(streamURL))) continue;
          formats.push({
            id: format.itag,
            quality: format.quality_label || `${format.height}p`,
            url: streamURL,
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
}
