import fs from "node:fs";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";

export const saveStream = async (stream, filename, onProgress = () => {}) => {
  let loaded = 0;
  const progress = new Transform({ transform(chunk, encoding, callback) {
    loaded += chunk.length;
    onProgress(loaded);
    callback(null, chunk);
  } });
  try {
    await pipeline(Readable.fromWeb(stream), progress, fs.createWriteStream(filename));
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

export const downloadFormat = async (info, format) => {
  const type = format.has_video ? (format.has_audio ? "video+audio" : "video") : "audio";
  const total = Number(format.content_length);
  if (!Number.isSafeInteger(total) || total <= 0) return info.download({ itag: format.itag, type });
  // Buffer each small range before publishing it so a failed range can be retried
  // without duplicating bytes already written to disk.
  async function* chunks() {
    const chunkSize = 256 * 1024;
    for (let start = 0; start < total; start += chunkSize) {
      const end = Math.min(start + chunkSize, total) - 1;
      for (let attempt = 0; ; attempt++) {
        try {
          const stream = await info.download({ itag: format.itag, type, range: { start, end } });
          const parts = [];
          let received = 0;
          for await (const part of stream) {
            received += part.length;
            if (received > end - start + 1) throw new Error("Server ignored the requested byte range.");
            parts.push(part);
          }
          if (received !== end - start + 1) {
            const error = new Error("Incomplete download range.");
            error.code = "ECONNRESET";
            throw error;
          }
          yield Buffer.concat(parts);
          break;
        } catch (error) {
          if (attempt >= 1 || !retryableStreamError(error)) throw error;
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }
    }
  }
  return Readable.toWeb(Readable.from(chunks()));
};

