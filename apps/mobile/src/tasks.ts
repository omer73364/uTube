import { parseMediaURL } from '../../../packages/core/media-source.js';
import { AppRegistry, DeviceEventEmitter } from "react-native";
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
DeviceEventEmitter.addListener("utubeCancelPreparation", (id: string) =>
  preparing.get(id)?.abort(),
);
AppRegistry.registerHeadlessTask(
  "uTubeResolve",
  () =>
    async ({ request }: { request: string }) => {
      const job = JSON.parse(request) as DownloadRequest & { id: string };
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
    },
);
