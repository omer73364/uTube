import { createDownloadEngine, createYouTubeClient } from '../../../../packages/core/index.js';
import fs from 'node:fs/promises';
import { createXClient } from '../../../../packages/core/x.js';

type Port = { on(name: string, handler: (event: { data: any }) => void): void; postMessage(value: unknown): void };
const port = (process as unknown as { parentPort: Port }).parentPort;
const controllers = new Map<string, AbortController>();
let enginePromise: Promise<any> | undefined;
let xClient: ReturnType<typeof createXClient> | undefined;
async function getEngine(ffmpegPath?: string) {
  if (!enginePromise) enginePromise = (async () => {
    let client;
    if (process.env.UTUBE_TEST_MEDIA) {
      const media = await fs.readFile(process.env.UTUBE_TEST_MEDIA);
      xClient = createXClient({ fetch: async (input, options) => {
        const url = new URL(String(input));
        if (url.hostname === 'cdn.syndication.twimg.com') return new Response(JSON.stringify({
          id_str: url.searchParams.get('id'), text: 'A moment from X', user: { name: 'uTube Studio' },
          mediaDetails: [1, 2].map(() => ({ type: 'video', media_url_https: 'https://pbs.twimg.com/media/utube-test.jpg', video_info: {
            duration_millis: 1000, variants: [360, 720].map(height => ({ content_type: 'video/mp4', bitrate: height * 1000,
              url: `https://video.twimg.com/ext_tw_video/test/vid/${height * 16 / 9}x${height}/fixture.mp4`,
            })),
          } })),
        }));
        const { setTimeout: delay } = await import('node:timers/promises');
        await delay(Number(process.env.UTUBE_TEST_DELAY || 0), undefined, { signal: options?.signal || undefined });
        return new Response(media, { headers: { 'Content-Type': 'video/mp4', 'Content-Length': String(media.length) } });
      } });
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
    } else {
      // X previews and downloads must not depend on a YouTube connection.
      let youtube: ReturnType<typeof createYouTubeClient> | undefined;
      const getYouTube = () => youtube ||= createYouTubeClient().catch(error => { youtube = undefined; throw error; });
      client = {
        getInfo: async (id: string, options: any) => (await getYouTube()).getInfo(id, options),
        getPlaylist: async (id: string) => (await getYouTube()).getPlaylist(id),
      };
    }
    return client;
  })().catch((error) => { enginePromise = undefined; throw error; });
  const client = await enginePromise;
  return createDownloadEngine({ client, xClient, ffmpegPath: ffmpegPath || process.env.UTUBE_FFMPEG || 'ffmpeg' });
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
