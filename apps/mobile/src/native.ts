import { NativeModules } from "react-native";
import {
  playerResult,
  type Job,
  type DownloadPlan,
  type MediaMode,
} from "./domain";
export type DownloadRequest = {
  videoId: string;
  thumbnail?: string;
  title: string;
  mode: MediaMode;
  requestedQuality: string;
  playlistTitle?: string;
  playlistIndex?: number;
  retryId?: string;
};
interface Bridge {
  http(
    id: string,
    url: string,
    method: string,
    headers: Record<string, string>,
    body: string | null,
  ): Promise<{
    status: number;
    body: string;
    url: string;
    headers: Record<string, string>;
  }>;
  cancelHttp(id: string): void;
  sha1(input: string): Promise<string>;
  evaluate(script: string): Promise<string>;
  enqueue(requests: string): Promise<string>;
  prepared(
    id: string,
    plan: string | null,
    error: string | null,
  ): Promise<void>;
  list(): Promise<string>;
  cancel(id: string): Promise<void>;
  cancelAll(): Promise<void>;
  resume(): Promise<void>;
  open(id: string): Promise<void>;
  share(id: string): Promise<void>;
  clearFinished(): Promise<void>;
  remove(id: string): Promise<void>;
  settings(): Promise<{
    language: "en" | "ar";
    theme: "light" | "dark" | "system";
  }>;
  saveSettings(
    language: "en" | "ar",
    theme: "light" | "dark" | "system",
  ): Promise<void>;
  closeShare(): void;
  consumeSharedLink(): Promise<string | null>;
  licenses(): Promise<string>;
}
const bridge = NativeModules.UTubeDownloads as Bridge;
export const downloads = {
  http: (...args: Parameters<Bridge["http"]>) => bridge.http(...args),
  cancelHttp: (id: string) => bridge.cancelHttp(id),
  sha1: (input: string) => bridge.sha1(input),
  evaluate: async (script: string) =>
    playerResult(
      JSON.stringify({
        id: "native",
        value: JSON.parse(await bridge.evaluate(script)),
      }),
    ).value!,
  enqueue: async (requests: DownloadRequest[]): Promise<string[]> =>
    JSON.parse(await bridge.enqueue(JSON.stringify(requests))),
  prepared: (id: string, plan: DownloadPlan | null, error: string | null) =>
    bridge.prepared(id, plan ? JSON.stringify(plan) : null, error),
  list: async (): Promise<Job[]> => JSON.parse(await bridge.list()),
  cancel: (id: string) => bridge.cancel(id),
  cancelAll: () => bridge.cancelAll(),
  resume: () => bridge.resume(),
  open: (id: string) => bridge.open(id),
  share: (id: string) => bridge.share(id),
  clearFinished: () => bridge.clearFinished(),
  remove: (id: string) => bridge.remove(id),
  settings: () => bridge.settings(),
  saveSettings: (language: "en" | "ar", theme: "light" | "dark" | "system") =>
    bridge.saveSettings(language, theme),
  closeShare: () => bridge.closeShare(),
  consumeSharedLink: () => bridge.consumeSharedLink(),
  licenses: () => bridge.licenses(),
};
