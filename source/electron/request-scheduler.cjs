"use strict";

// Limit request starts without blocking the queue on slow responses.
class RequestScheduler {
  constructor(getNext, setNext, intervalMs = 140) {
    this.getNext = getNext;
    this.setNext = setNext;
    this.intervalMs = intervalMs;
    this.jobs = [];
    this.timer = null;
  }
  take(priority = 0, signal) {
    signal?.throwIfAborted();
    return new Promise((resolve, reject) => {
      const job = { priority, signal, resolve, reject };
      job.abort = () => {
        this.jobs = this.jobs.filter(item => item !== job);
        reject(signal.reason);
        this.pump();
      };
      signal?.addEventListener("abort", job.abort, { once: true });
      this.jobs.push(job);
      this.pump();
    });
  }
  pump() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    if (!this.jobs.length) return;
    const wait = Math.max(0, this.getNext() - Date.now());
    if (wait) {
      this.timer = setTimeout(() => { this.timer = null; this.pump(); }, wait);
      return;
    }
    this.jobs.sort((a, b) => a.priority - b.priority);
    const job = this.jobs.shift();
    job.signal?.removeEventListener("abort", job.abort);
    this.setNext(Date.now() + this.intervalMs);
    job.resolve();
    this.pump();
  }
}
module.exports = { RequestScheduler };
