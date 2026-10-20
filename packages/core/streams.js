import { checkAbort, withAbort, abortError } from "./cancellation.js";
import { setTimeout as delay } from "node:timers/promises";
import fs from "node:fs";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";

export const saveStream = async (stream, filename, onProgress = () => {}, signal) => {
  checkAbort(signal);
  let loaded = 0;
  const progress = new Transform({ transform(chunk, encoding, callback) {
    loaded += chunk.length;
    onProgress(loaded);
    callback(null, chunk);
  } });
  try {
    await pipeline(Readable.fromWeb(stream), progress, fs.createWriteStream(filename), { signal });
  } catch (error) {
    await fs.promises.rm(filename, { force: true });
    throw error;
  }
};

export const streamStatus = (error) => error?.info?.response?.status;
export const retryableStreamError = (error) => {
  const status = streamStatus(error);
  return [403, 408, 410, 429].includes(status) || status >= 500 ||
    ["ECONNRESET", "ETIMEDOUT", "UND_ERR_SOCKET", "UND_ERR_CONNECT_TIMEOUT"].includes(error?.cause?.code || error?.code) ||
    error?.message === "terminated";
};

export const downloadFormat = async (info, format, signal) => {
  checkAbort(signal);
  const type = format.has_video ? (format.has_audio ? "video+audio" : "video") : "audio";
  const total = Number(format.content_length);
  if (!Number.isSafeInteger(total) || total <= 0) return withAbort(info.download({ itag: format.itag, type }), signal);
  // Buffer each small range before publishing it so a failed range can be retried
  // without duplicating bytes already written to disk.
  async function* chunks() {
    let chunkSize = 256 * 1024;
    for (let start = 0; start < total; start += chunkSize) {
      checkAbort(signal);
      let end = Math.min(start + chunkSize, total) - 1;
      for (let attempt = 0; ; attempt++) {
        try {
          const stream = await withAbort(info.download({ itag: format.itag, type, range: { start, end } }), signal);
          const readable = Readable.fromWeb(stream);
          const cancel = () => readable.destroy(abortError());
          signal?.addEventListener("abort", cancel, { once: true });
          if (signal?.aborted) cancel();
          const parts = [];
          let received = 0;
          try { for await (const part of readable) {
            received += part.length;
            if (received > end - start + 1) throw new Error("Server ignored the requested byte range.");
            parts.push(part);
          } } finally { signal?.removeEventListener("abort", cancel); }
          if (received !== end - start + 1) {
            const error = new Error("Incomplete download range.");
            error.code = "ECONNRESET";
            throw error;
          }
          yield Buffer.concat(parts);
          break;
        } catch (error) {
          checkAbort(signal);
          // Some adaptive streams reject larger ranges even though smaller
          // requests at the same offset work. Keep the chosen HD format and
          // retry that unpublished range before changing clients.
          if (streamStatus(error) === 403 && end - start + 1 > 64 * 1024) {
            chunkSize /= 2;
            end = Math.min(start + chunkSize, total) - 1;
            attempt = -1;
            continue;
          }
          if (attempt >= 1 || !retryableStreamError(error)) throw error;
          await delay(500, undefined, { signal });
        }
      }
    }
  }
  return Readable.toWeb(Readable.from(chunks()));
};

