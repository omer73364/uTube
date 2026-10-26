import { createDownloadEngine, createYouTubeClient } from '../../../../packages/core/index.js';
import fs from 'node:fs/promises';

type Port = { on(name: string, handler: (event: { data: any }) => void): void; postMessage(value: unknown): void };
const port = (process as unknown as { parentPort: Port }).parentPort;
const controllers = new Map<string, AbortController>();
let enginePromise: Promise<any> | undefined;
async function getEngine(ffmpegPath?: string) {
  if (!enginePromise) enginePromise = (async () => {
    let client;
    if (process.env.UTUBE_TEST_MEDIA) {
      const media = await fs.readFile(process.env.UTUBE_TEST_MEDIA);
      const attempts = new Map<string, number>();
      client = {
        getPlaylist: async () => ({ info: { title: 'Weekend collection' }, items: [
          { id: 'jNQXAC9IVRw', title: 'A small moment, worth keeping' },
          { id: 'BaW_jenozKc', title: 'The second chapter' },
        ], has_continuation: false }),
        getInfo: async (id: string) => {
          const count = attempts.get(id) || 0;
          attempts.set(id, count + 1);
          if (process.env.UTUBE_TEST_FAIL_ONCE === '1' && id === 'BaW_jenozKc' && count === 0) throw new Error('This video is temporarily unavailable.');
          return ({ basic_info: { title: 'A small moment, worth keeping', author: 'uTube Studio' }, streaming_data: {
          formats: [{ itag: 18, url: 'https://example.test/media', has_video: true, has_audio: true, quality_label: '360p', mime_type: 'video/mp4', content_length: media.length }],
        }, download: async ({ range }: { range?: { start: number; end: number } }) => {
          await new Promise((resolve) => setTimeout(resolve, Number(process.env.UTUBE_TEST_DELAY || 0)));
          return new ReadableStream({ start(controller) { controller.enqueue(range ? media.subarray(range.start, range.end + 1) : media); controller.close(); } });
        } });
        },
      };
    } else client = await createYouTubeClient();
    return client;
  })().catch((error) => { enginePromise = undefined; throw error; });
  return createDownloadEngine({ client: await enginePromise, ffmpegPath: ffmpegPath || process.env.UTUBE_FFMPEG || 'ffmpeg' });
}
port.on('message', async ({ data: message }) => {
  if (message.type === 'cancel') { controllers.get(message.id)?.abort(); return; }
  const controller = new AbortController();
  controllers.set(message.id, controller);
  try {
    const engine = await getEngine(message.ffmpegPath);
    const result = message.type === 'inspect'
      ? await engine.inspect(message.url, { signal: controller.signal })
      : await engine.download({
        item: { id: message.job.videoId, title: message.job.title },
        playlistTitle: message.job.playlistTitle, folder: message.job.folder,
        quality: message.job.quality, audio: message.job.audio, signal: controller.signal,
        onEvent: (event: unknown) => port.postMessage({ id: message.id, event }),
      });
    port.postMessage({ id: message.id, result });
  } catch (error: any) {
    port.postMessage({ id: message.id, error: { name: error.name, message: error.message } });
  } finally { controllers.delete(message.id); }
});
