import type { Innertube } from "youtubei.js";
import { videoFormats, audioFormats } from "../../../packages/core/formats.js";
import {
  mediaURL,
  type Preview,
  type MediaMode,
  type DownloadPlan,
  type Stream,
} from "./domain.ts";

type Client = Pick<Innertube, "getBasicInfo" | "session">;
type VideoInfo = Awaited<ReturnType<Client["getBasicInfo"]>>;
type RawFormat = NonNullable<VideoInfo["streaming_data"]>["formats"][number];
const clients = ["IOS", "VISIONOS", "ANDROID_VR", "ANDROID"] as const;
export function qualityChoices(info: unknown): string[] {
  return [
    ...new Set<string>(
      videoFormats(info)
        .map((format: RawFormat) => format.quality_label)
        .filter((label): label is string => !!label),
    ),
  ].sort((a, b) => parseInt(b) - parseInt(a) || b.localeCompare(a));
}
export async function inspectVideo(id: string, yt: Client): Promise<Preview> {
  let error: unknown;
  for (const client of clients) {
    try {
      const info = await yt.getBasicInfo(id, { client });
      const qualities = qualityChoices(info);
      const audioAvailable = audioFormats(info).length > 0;
      if (qualities.length || audioAvailable)
        return {
          kind: "video",
          id,
          title: String(info.basic_info.title || id),
          author: String(info.basic_info.author || ""),
          qualities,
          audioAvailable,
        };
      error = new Error(info.playability_status?.reason || "NO_FORMATS");
    } catch (e) {
      error = e;
    }
  }
  throw error || new Error("NO_FORMATS");
}
export async function resolveVideo(
  id: string,
  yt: Client,
  quality: string,
  mode: MediaMode,
  ensurePlayer: () => Promise<void>,
): Promise<DownloadPlan> {
  // Transfer requests include the current player's signature timestamp.
  await ensurePlayer();
  const results = await Promise.allSettled(
    clients.map((client) => yt.getBasicInfo(id, { client })),
  );
  const sources = results.flatMap((result) =>
    result.status === "fulfilled" ? [result.value] : [],
  );
  if (!sources.length)
    throw (
      (
        results.find(
          (result) => result.status === "rejected",
        ) as PromiseRejectedResult
      )?.reason || new Error("NO_FORMATS")
    );
  const entries: { video?: RawFormat; audio?: RawFormat; quality: string }[] =
    sources.flatMap<{ video?: RawFormat; audio?: RawFormat; quality: string }>(
      (info) => {
        const audios: RawFormat[] = audioFormats(info)
          .filter((f: RawFormat) => !f.has_video)
          .sort(
            (a: RawFormat, b: RawFormat) =>
              Number(!!b.is_original) - Number(!!a.is_original) ||
              (b.bitrate || 0) - (a.bitrate || 0),
          );
        if (mode === "mp3")
          return (audios.length ? audios : audioFormats(info)).map(
            (audio: RawFormat) => ({ audio, quality: "MP3" }),
          );
        const audio = audios.find((f) => f.mime_type?.startsWith("audio/mp4"));
        return videoFormats(info)
          .filter((video: RawFormat) => video.has_audio || audio)
          .map((video: RawFormat) => ({
            video,
            audio: video.has_audio ? undefined : audio,
            quality: video.quality_label || `${video.height}p`,
          }));
      },
    );
  const requested = parseInt(quality);
  const exact = entries
    .filter((entry) => parseInt(entry.quality) === requested)
    .sort(
      (a, b) => Number(b.quality === quality) - Number(a.quality === quality),
    );
  const lower = entries
    .filter((entry) => parseInt(entry.quality) < requested)
    .sort((a, b) => parseInt(b.quality) - parseInt(a.quality));
  const ordered =
    mode === "mp3"
      ? entries
      : quality === "best"
        ? [...entries].sort((a, b) => parseInt(b.quality) - parseInt(a.quality))
        : [...exact, ...lower];
  const candidates: DownloadPlan["candidates"] = [];
  const seen = new Set<string>();
  const decipher = async (format: RawFormat): Promise<Stream> => ({
    url: mediaURL(await format.decipher(yt.session.player)),
    size: Number(format.content_length) || 0,
    itag: format.itag,
  });
  for (const entry of ordered) {
    if (candidates.length >= 24) break;
    try {
      const video = entry.video ? await decipher(entry.video) : undefined;
      const audio = entry.audio ? await decipher(entry.audio) : undefined;
      const key = `${video?.url}|${audio?.url}`;
      if (seen.has(key)) continue;
      seen.add(key);
      candidates.push({
        quality: entry.quality,
        ...(video && { video }),
        ...(audio && { audio }),
      });
    } catch {
      /* A broken encoding must not hide another at the requested quality. */
    }
  }
  if (!candidates.length) throw new Error("NO_FORMATS");
  return {
    videoId: id,
    title: String(sources[0].basic_info.title || id).slice(0, 180),
    mode,
    requestedQuality: mode === "mp3" ? "MP3" : quality,
    candidates,
  };
}
