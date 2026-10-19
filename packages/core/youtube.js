import { runInNewContext } from 'node:vm';

export async function createYouTubeClient() {
  const { Innertube, Platform } = await import('youtubei.js');
  Platform.shim.eval = async (data) => runInNewContext(data.output, {}, { timeout: 5000 });
  return Innertube.create();
}
