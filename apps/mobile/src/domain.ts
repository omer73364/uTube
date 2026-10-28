import type { SizeEstimates } from '../../../packages/core/file-size.js';
import { parseMediaURL } from "../../../packages/core/media-source.js";
export type MediaMode = "video" | "mp3";
export type Stream = { url: string; size: number; itag: number };
export type Candidate = { quality: string; video?: Stream; audio?: Stream };
export type DownloadPlan = {
  videoId: string;
  title: string;
  mode: MediaMode;
  requestedQuality: string;
  candidates: Candidate[];
  playlistTitle?: string;
  playlistIndex?: number;
};
export type Format = { id: number; quality: string; url: string };
export type Preview = {
  sizeEstimates?: SizeEstimates;
  kind: "video";
  provider?: 'youtube' | 'x' | 'instagram' | 'facebook';
  thumbnail?: string;
  id: string;
  title: string;
  author: string;
  qualities: string[];
  audioAvailable: boolean;
};
export type PlaylistItem = { sizeEstimates?: SizeEstimates; id: string; title: string; index: number; thumbnail?: string };
export type PlaylistPreview = {
  kind: "playlist";
  provider?: 'youtube' | 'x' | 'instagram' | 'facebook';
  thumbnail?: string;
  qualities?: string[];
  id: string;
  title: string;
  items: PlaylistItem[];
};
export type Job = {
  id: string;
  videoId: string;
  thumbnail?: string;
  title: string;
  mode: MediaMode;
  quality: string;
  requestedQuality: string;
  playlistTitle?: string;
  playlistIndex?: number;
  createdAt: number;
  status:
    | "queued"
    | "preparing"
    | "running"
    | "merging"
    | "converting"
    | "publishing"
    | "interrupted"
    | "saved"
    | "failed"
    | "cancelled"
    | "missing";
  loaded?: number;
  total?: number;
  fraction?: number;
  error?: string;
  downgraded?: boolean;
};
export function videoId(input: string): string {
  const parsed = parseMediaURL(input.trim());
  if (parsed.type !== "video") throw new Error("PLAYLIST_NOT_YET");
  return parsed.id;
}
export function mediaURL(input: string): string {
  const url = new URL(input);
  if (
    url.protocol !== "https:" ||
    !url.hostname.endsWith(".googlevideo.com") ||
    url.username ||
    url.password ||
    (url.port !== "" && url.port !== "443")
  )
    throw new Error("INVALID_MEDIA_URL");
  return url.href;
}
export function progress(job: Job): number | undefined {
  if (Number.isFinite(job.fraction))
    return Math.max(0, Math.min(1, job.fraction!));
  if (
    !Number.isFinite(job.total) ||
    !job.total ||
    job.total < 1 ||
    !Number.isFinite(job.loaded)
  )
    return undefined;
  return Math.max(0, Math.min(1, (job.loaded || 0) / job.total));
}
export function playerResult(input: string): {
  id: string;
  value?: Record<string, string>;
  error?: string;
} {
  if (input.length > 32768) throw new Error("INVALID_PLAYER_RESULT");
  const data: unknown = JSON.parse(input);
  if (!data || typeof data !== "object" || Array.isArray(data))
    throw new Error("INVALID_PLAYER_RESULT");
  const message = data as Record<string, unknown>;
  if (typeof message.id !== "string") throw new Error("INVALID_PLAYER_RESULT");
  if (typeof message.error === "string")
    return { id: message.id, error: "PLAYER_SCRIPT_FAILED" };
  if (
    !message.value ||
    typeof message.value !== "object" ||
    Array.isArray(message.value)
  )
    throw new Error("INVALID_PLAYER_RESULT");
  const value = message.value as Record<string, unknown>;
  for (const [key, text] of Object.entries(value))
    if (
      !["sig", "n"].includes(key) ||
      typeof text !== "string" ||
      text.length > 8192
    )
      throw new Error("INVALID_PLAYER_RESULT");
  return { id: message.id, value: value as Record<string, string> };
}
