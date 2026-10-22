import { AppRegistry, DeviceEventEmitter } from "react-native";
import { downloads } from "./native";
import { createYouTubeService } from "./youtube";
import type { DownloadRequest } from "./native";

export const youtube = createYouTubeService((script) =>
  downloads.evaluate(script),
);
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
        const plan = await youtube.resolve(
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
