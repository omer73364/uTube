import { parseMediaURL } from '../../../packages/core/media-source.js';
import { AppRegistry, AppState, DeviceEventEmitter, NativeEventEmitter, NativeModules, Platform } from "react-native";
import { downloads } from "./native";
import { createYouTubeService } from "./youtube";
import { createFacebookService } from './facebook';
import { createInstagramService } from './instagram';
import { createXService } from './x';
import { createMediaService } from './media';
import { nativeFetch } from './requests';
import type { DownloadRequest } from "./native";

const transport = nativeFetch((...args) => downloads.http(...args), id => downloads.cancelHttp(id));
const services = createMediaService(
  createYouTubeService(script => downloads.evaluate(script)),
  createXService((url, signal) => transport(url, { signal, headers: { 'User-Agent': 'Googlebot', Accept: 'application/json' } })),
  createInstagramService((url, options) => transport(url, options)),
  createFacebookService((url, options) => transport(url, options)),
);
export const media = {
  ...services,
  async inspect(url: string, signal?: AbortSignal) {
    await downloads.assertService(parseMediaURL(url).id);
    return services.inspect(url, signal);
  },
};
const preparing = new Map<string, AbortController>();
const events = Platform.OS === "ios" ? new NativeEventEmitter<{
  utubeCancelPreparation: [string];
  utubePrepare: [{ request: string }];
}>(NativeModules.UTubeDownloads) : null;
const cancelPreparation = (id: string) => preparing.get(id)?.abort();
if (events) events.addListener("utubeCancelPreparation", cancelPreparation);
else DeviceEventEmitter.addListener("utubeCancelPreparation", cancelPreparation);
const resolveRequest = async ({ request }: { request: string }) => {
  const job = JSON.parse(request) as DownloadRequest & { id: string };
  if (preparing.has(job.id)) return;
  const controller = new AbortController();
  preparing.set(job.id, controller);
  try {
    const plan = await media.resolve(
      job.videoId,
      job.requestedQuality,
      job.mode,
      controller.signal,
    );
    await downloads.prepared(job.id, plan, null);
  } catch (error) {
    await downloads
      .prepared(
        job.id,
        null,
        error instanceof Error
          ? error.message.slice(0, 180)
          : "PREPARATION_FAILED",
      )
      .catch(() => {});
  } finally {
    preparing.delete(job.id);
  }
};
if (events) {
  events.addListener("utubePrepare", (payload: { request: string }) => { void resolveRequest(payload); });
  AppState.addEventListener("change", state => {
    if (state === "active") void downloads.resume().catch(() => {});
  });
  void downloads.resume().catch(() => {});
} else {
  AppRegistry.registerHeadlessTask("uTubeResolve", () => resolveRequest);
}
