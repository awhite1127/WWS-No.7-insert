"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { EventEmitter } = require("node:events");
const { parseArenaFile } = require("./arena-parser.cjs");

const ARENA_FILE_NAME = "tempArenaInfo.json";
const MAX_INITIAL_FILE_AGE_MS = 3 * 60 * 60 * 1000;
const SKIP_DIRECTORIES = new Set(["bin", "res", "res_packages", "updates", "screenshots", "profile", "node_modules"]);

function existingArenaFile(root) {
  const direct = path.join(root, "replays", ARENA_FILE_NAME);
  if (fs.existsSync(direct)) return direct;
  if (path.basename(root).toLowerCase() === "replays") {
    const inside = path.join(root, ARENA_FILE_NAME);
    if (fs.existsSync(inside)) return inside;
  }
  return "";
}

function findArenaFile(root, maxDepth = 5, maxEntries = 1200) {
  const queue = [{ directory: root, depth: 0 }];
  let visited = 0;
  while (queue.length > 0 && visited < maxEntries) {
    const { directory, depth } = queue.shift();
    visited += 1;
    const found = existingArenaFile(directory);
    if (found) return found;
    if (depth >= maxDepth) continue;
    let entries = [];
    try {
      entries = fs.readdirSync(directory, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith(".") || SKIP_DIRECTORIES.has(entry.name.toLowerCase())) continue;
      queue.push({ directory: path.join(directory, entry.name), depth: depth + 1 });
    }
  }
  return "";
}

function resolveArenaFilePath(gameDirectory) {
  const selected = path.resolve(gameDirectory);
  if (path.basename(selected).toLowerCase() === ARENA_FILE_NAME.toLowerCase()) return selected;

  let cursor = selected;
  for (let depth = 0; depth < 5; depth += 1) {
    const found = existingArenaFile(cursor);
    if (found) return found;
    const parent = path.dirname(cursor);
    if (parent === cursor) break;
    cursor = parent;
  }

  const nested = fs.existsSync(selected) ? findArenaFile(selected) : "";
  if (nested) return nested;
  return path.basename(selected).toLowerCase() === "replays"
    ? path.join(selected, ARENA_FILE_NAME)
    : path.join(selected, "replays", ARENA_FILE_NAME);
}

class ArenaWatcher extends EventEmitter {
  constructor() {
    super();
    this.filePath = "";
    this.gameDirectory = "";
    this.timer = null;
    this.lastSignature = "";
    this.lastDiscoveryAt = 0;
  }

  start(gameDirectory) {
    this.stop();
    this.gameDirectory = path.resolve(gameDirectory);
    this.filePath = resolveArenaFilePath(gameDirectory);
    this.timer = setInterval(() => this.poll(), 1200);
    this.poll();
    return this.filePath;
  }

  poll() {
    try {
      if (!fs.existsSync(this.filePath) && Date.now() - this.lastDiscoveryAt > 4000) {
        this.lastDiscoveryAt = Date.now();
        const discovered = resolveArenaFilePath(this.gameDirectory);
        if (discovered !== this.filePath) {
          this.filePath = discovered;
          this.lastSignature = "";
          this.emit("path", discovered);
        }
      }
      const stat = fs.statSync(this.filePath);
      if (!this.lastSignature && stat.mtimeMs < Date.now() - MAX_INITIAL_FILE_AGE_MS) return;
      const signature = `${stat.mtimeMs}:${stat.size}`;
      if (signature === this.lastSignature) return;
      const arena = parseArenaFile(this.filePath);
      // Only mark a version as consumed after parsing succeeds. The game may
      // expose the file while it is still being written.
      this.lastSignature = signature;
      this.emit("arena", arena);
    } catch (error) {
      if (error?.code !== "ENOENT") this.emit("warning", error.message);
    }
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.lastSignature = "";
    this.lastDiscoveryAt = 0;
  }
}

module.exports = { ArenaWatcher, findArenaFile, resolveArenaFilePath };
