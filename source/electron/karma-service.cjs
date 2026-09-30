"use strict";

// Production hosts published by WOWS Karma's frontend. gameKarma is In-Game;
// siteKarma and the bulk karmas endpoints are the separate community rating.
const HOSTS = { asia: "https://api.asia.wows-karma.com", eu: "https://api.wows-karma.com", na: "https://api.na.wows-karma.com" };
class KarmaService {
  constructor({ fetchImpl = fetch, now = Date.now, timeoutMs = 3000, concurrency = 4 } = {}) {
    this.fetchImpl = fetchImpl;
    this.now = now;
    this.timeoutMs = timeoutMs;
    this.concurrency = concurrency;
    this.cache = new Map();
    this.pending = new Map();
    this.queue = [];
    this.active = 0;
  }
  get(accountId, realm = "asia") {
    if (!HOSTS[realm] || !Number.isSafeInteger(accountId) || accountId <= 0) return Promise.resolve(null);
    const key = realm + ":" + accountId;
    const cached = this.cache.get(key);
    if (cached && cached.expiresAt > this.now()) return Promise.resolve(cached.value);
    if (this.pending.has(key)) return this.pending.get(key);
    const request = new Promise(resolve => { this.queue.push({ accountId, realm, key, resolve }); });
    this.pending.set(key, request);
    this.drain();
    return request;
  }
  drain() {
    while (this.active < this.concurrency && this.queue.length) {
      const job = this.queue.shift();
      this.active++;
      this.read(job).then(value => {
        this.cache.delete(job.key);
        this.cache.set(job.key, { value, expiresAt: this.now() + (value === null ? 30000 : 120000) });
        while (this.cache.size > 512) this.cache.delete(this.cache.keys().next().value);
        this.pending.delete(job.key);
        job.resolve(value);
      }).finally(() => { this.active--; this.drain(); });
    }
  }
  async read({ accountId, realm }) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl(HOSTS[realm] + "/api/player/" + accountId + "?includeClanInfo=false", {
        signal: controller.signal, headers: { Accept: "application/json" },
      });
      if (!response.ok) return null;
      const profile = await response.json();
      // Reject missing fields, strings, and responses for a different player.
      return profile?.id === accountId && Number.isSafeInteger(profile.gameKarma) && profile.gameKarma >= 0
        ? profile.gameKarma : null;
    } catch { return null; }
    finally { clearTimeout(timer); }
  }
}

// Publish the normal statistics first, then enrich the same entry asynchronously.
// The request guard prevents a late response changing a later battle or realm.
function enrichRosterKarma(service, entry, realm, isCurrent, publish) {
  entry.gameKarma = null;
  const valid = Number.isSafeInteger(entry.accountId) && entry.accountId > 0;
  entry.karmaStatus = valid ? "loading" : "unavailable";
  publish();
  if (!valid) return Promise.resolve();
  return service.get(entry.accountId, realm).then(value => {
    if (!isCurrent()) return;
    entry.gameKarma = value;
    entry.karmaStatus = value === null ? "unavailable" : "ok";
    publish();
  });
}
module.exports = { KarmaService, enrichRosterKarma, HOSTS };
