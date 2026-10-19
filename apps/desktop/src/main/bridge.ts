import { app, utilityProcess, type UtilityProcess } from 'electron';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

export class WorkerBridge {
  private worker?: UtilityProcess;
  private pending = new Map<string, { resolve: (value: any) => void; reject: (error: Error) => void; onEvent?: (event: any) => void; cleanup: () => void }>();
  private ensureWorker() {
    if (this.worker) return this.worker;
    const worker = utilityProcess.fork(path.join(__dirname, 'worker.cjs'), [], { serviceName: 'uTube downloads', env: {
      ...process.env,
      UTUBE_TEST_MEDIA: app.isPackaged ? '' : process.env.UTUBE_TEST_MEDIA || '',
      UTUBE_TEST_DELAY: app.isPackaged ? '' : process.env.UTUBE_TEST_DELAY || '',
      UTUBE_TEST_FAIL_ONCE: app.isPackaged ? '' : process.env.UTUBE_TEST_FAIL_ONCE || '',
    } });
    this.worker = worker;
    worker.on('message', (message) => {
      const request = this.pending.get(message.id);
      if (!request) return;
      if (message.event) { request.onEvent?.(message.event); return; }
      this.pending.delete(message.id); request.cleanup();
      if (message.error) request.reject(Object.assign(new Error(message.error.message), { name: message.error.name }));
      else request.resolve(message.result);
    });
    worker.on('exit', () => {
      if (this.worker === worker) this.worker = undefined;
      for (const request of this.pending.values()) { request.cleanup(); request.reject(new Error('The download worker stopped. Try again.')); }
      this.pending.clear();
    });
    return worker;
  }
  call(type: 'inspect' | 'download', data: object, options: { signal?: AbortSignal; onEvent?: (event: any) => void } = {}): Promise<any> {
    return new Promise((resolve, reject) => {
      if (options.signal?.aborted) { reject(new DOMException('Cancelled', 'AbortError')); return; }
      const worker = this.ensureWorker();
      const id = randomUUID();
      const cancel = () => {
        worker.postMessage({ type: 'cancel', id });
        if (type === 'inspect') {
          this.pending.delete(id);
          options.signal?.removeEventListener('abort', cancel);
          reject(new Error('Loading details took too long. Please try again.'));
        }
      };
      this.pending.set(id, { resolve, reject, onEvent: options.onEvent, cleanup: () => options.signal?.removeEventListener('abort', cancel) });
      options.signal?.addEventListener('abort', cancel, { once: true });
      try { worker.postMessage({ type, id, ...data }); }
      catch (error) { this.pending.delete(id); options.signal?.removeEventListener('abort', cancel); reject(error); }
    });
  }
  dispose() { this.worker?.kill(); }
}
