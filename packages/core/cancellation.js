export const abortError = () => new DOMException('Download cancelled.', 'AbortError');
export function checkAbort(signal) { if (signal?.aborted) throw abortError(); }

// Some upstream metadata calls do not accept a signal. Stop waiting immediately,
// and close a late-arriving stream instead of leaving a request running unused.
export function withAbort(promise, signal) {
  if (!signal) return promise;
  return new Promise((resolve, reject) => {
    const cancel = () => reject(abortError());
    signal.addEventListener('abort', cancel, { once: true });
    if (signal.aborted) cancel();
    Promise.resolve(promise).then((value) => {
      signal.removeEventListener('abort', cancel);
      if (signal.aborted) {
        if (typeof value?.cancel === 'function') Promise.resolve(value.cancel()).catch(() => {});
        reject(abortError());
      } else resolve(value);
    }, (error) => { signal.removeEventListener('abort', cancel); reject(signal.aborted ? abortError() : error); });
  });
}
