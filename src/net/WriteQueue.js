/** Cooperative per-tab pacing, not server-side protection against hostile clients. */
export class WriteQueue {
  constructor({ intervalMs = 250, maxPending = 32, now = () => performance.now(), sleep = ms => new Promise(resolve => setTimeout(resolve, ms)) } = {}) {
    this.intervalMs = intervalMs;
    this.maxPending = maxPending;
    this.now = now;
    this.sleep = sleep;
    this.pending = 0;
    this.nextStart = -Infinity;
    this.tail = Promise.resolve();
  }

  run(task) {
    if (this.pending >= this.maxPending) {
      const error = new Error('Too many writes are waiting. Your progress is kept on this device; try saving again shortly.');
      error.status = 429;
      return Promise.reject(error);
    }
    this.pending++;
    const result = this.tail.then(async () => {
      const delay = Math.max(0, this.nextStart - this.now());
      if (delay) await this.sleep(delay);
      this.nextStart = this.now() + this.intervalMs;
      return task();
    });
    this.tail = result.catch(() => {}).finally(() => { this.pending--; });
    return result;
  }
}

// A shared queue also covers multiple transports in one tab, including retries.
export const clientWrites = new WriteQueue();
