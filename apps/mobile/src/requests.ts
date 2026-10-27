export async function bounded<T>(
  operation: Promise<T>,
  milliseconds = 30000,
  cancel = () => {},
): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          cancel();
          reject(new Error("REQUEST_TIMEOUT"));
        }, milliseconds);
      }),
    ]);
  } finally {
    clearTimeout(timer!);
  }
}

type NativeResponse = {
  status: number;
  body: string;
  url: string;
  headers: Record<string, string>;
};
// Foreground X lookups and headless YouTube preparation share the native bridge.
// Separate transports must never reuse an in-flight cancellation ID.
let sequence = 0;
export function nativeFetch(
  http: (
    id: string,
    url: string,
    method: string,
    headers: Record<string, string>,
    body: string | null,
  ) => Promise<NativeResponse>,
  cancel: (id: string) => void,
): typeof fetch {
  return (async (input, init) => {
    const id = `metadata-${++sequence}`;
    const signal =
      init?.signal || (input instanceof Request ? input.signal : undefined);
    if (signal?.aborted) throw new Error("CANCELLED");
    let rejectAbort: (error: Error) => void;
    const aborted = new Promise<never>((_, reject) => {
      rejectAbort = reject;
    });
    const abort = () => {
      cancel(id);
      rejectAbort(new Error("CANCELLED"));
    };
    signal?.addEventListener("abort", abort, { once: true });
    const operation = (async () => {
      const request = new Request(input, init);
      const headers: Record<string, string> = {};
      request.headers.forEach((value, key) => {
        headers[key] = value;
      });
      const body = ["GET", "HEAD"].includes(request.method)
        ? null
        : await request.text();
      if (signal?.aborted) throw new Error("CANCELLED");
      const result = await http(id, request.url, request.method, headers, body);
      const response = new Response(result.body, {
        status: result.status,
        headers: result.headers,
      });
      Object.defineProperty(response, "url", { value: result.url });
      return response;
    })();
    try {
      return await bounded(Promise.race([operation, aborted]), 30000, () =>
        cancel(id),
      );
    } finally {
      signal?.removeEventListener("abort", abort);
    }
  }) as typeof fetch;
}
