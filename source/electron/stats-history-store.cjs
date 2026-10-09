"use strict";

const fs = require("node:fs/promises");
const path = require("node:path");
const { makeSnapshot, mergeSnapshot, recentFromSnapshots } = require("./stats-history.cjs");
const { aggregateRating, ratingValue, shipClassStats } = require("./personal-rating.cjs");

class StatsHistoryStore {
  constructor(getDirectory, { io = fs, now = Date.now, cacheLimit = 32 } = {}) {
    this.getDirectory = getDirectory;
    this.io = io;
    this.now = now;
    this.cacheLimit = cacheLimit;
    this.cache = new Map();
    this.pending = new Map();
  }
  attach(player) {
    const key = `${player.realm}-${player.accountId}`;
    const previous = this.pending.get(key) ?? Promise.resolve();
    const operation = previous.catch(() => {}).then(() => this.record(player, key));
    this.pending.set(key, operation);
    return operation.finally(() => { if (this.pending.get(key) === operation) this.pending.delete(key); });
  }
  async record(player, key) {
    player = { ...player, shipClasses: player.hiddenProfile ? [] : shipClassStats(player.ships),
      ships: player.ships.map(ship => ({ ...ship, pr: ratingValue(aggregateRating([ship])) })) };
    const current = makeSnapshot(player, this.now());
    if (!current) return { ...player, recent: null, history: [] };
    current.pr = aggregateRating(player.ships);
    if (player.shipsStatus === "unavailable") current.prUnavailable = true;
    const file = path.join(this.getDirectory(), key + ".json");
    let snapshots = [], readError;
    const cached = this.cache.get(key);
    if (cached && this.now() - cached.at < 30000) {
      snapshots = cached.snapshots;
    } else {
      try {
        const stored = JSON.parse(await this.io.readFile(file, "utf8"));
        if (!Array.isArray(stored?.snapshots)) throw new Error("历史记录格式无效，原文件已保留");
        snapshots = stored.snapshots;
      } catch (error) { if (error.code !== "ENOENT") readError = error; }
    }
    const recent = recentFromSnapshots(current, snapshots);
    const next = mergeSnapshot(snapshots, current);
    const temporary = file + ".tmp";
    try {
      // Do not replace a damaged or temporarily inaccessible history with an empty one.
      if (readError) throw readError;
      await this.io.mkdir(path.dirname(file), { recursive: true });
      await this.io.writeFile(temporary, JSON.stringify({ version: 1, accountId: player.accountId, realm: player.realm, snapshots: next }), "utf8");
      await this.io.rename(temporary, file);
      this.cache.delete(key);
      this.cache.set(key, { snapshots: next, at: this.now() });
      while (this.cache.size > this.cacheLimit) this.cache.delete(this.cache.keys().next().value);
    } catch (error) {
      recent.storageError = error instanceof Error ? error.message : String(error);
      this.cache.delete(key);
      await this.io.rm(temporary, { force: true }).catch(() => {});
    }
    return { ...player, recent, history: readError ? [] : next };
  }
  async flush() { await Promise.allSettled([...this.pending.values()]); }
}
module.exports = { StatsHistoryStore };
