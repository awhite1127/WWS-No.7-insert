"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { EventEmitter } = require("node:events");
const { parseArenaData } = require("./arena-parser.cjs");

const ARENA_FILE_NAME = "tempArenaInfo.json";
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
    this.lastContent = null;
    this.lastDiscoveryAt = 0;
    this.fileExists = false;
    this.lastReportedPath = "";
  }

  start(gameDirectory) {
    this.stop();
    this.gameDirectory = path.resolve(gameDirectory);
    this.filePath = resolveArenaFilePath(gameDirectory);
    // An existing file may belong to the previous battle. Wait for a new write.
    try {
      this.lastContent = fs.readFileSync(this.filePath, "utf8").replace(/^\uFEFF/, "");
    } catch (error) {
      if (error?.code !== "ENOENT") this.emit("warning", error.message);
    }
    this.timer = setInterval(() => this.poll(), 1200);
    this.poll();
    return this.filePath;
  }

  reportFileStatus(found) {
    if (this.fileExists === found && this.lastReportedPath === this.filePath) return;
    this.fileExists = found;
    this.lastReportedPath = this.filePath;
    this.emit("file-status", { watchedPath: this.filePath, arenaFileFound: found });
  }

  poll() {
    try {
      if (!fs.existsSync(this.filePath) && Date.now() - this.lastDiscoveryAt > 4000) {
        this.lastDiscoveryAt = Date.now();
        const discovered = resolveArenaFilePath(this.gameDirectory);
        if (discovered !== this.filePath) {
          this.filePath = discovered;
          // A newly discovered path may still contain an older battle.
          // Baseline its content before waiting for the next change.
          try {
            this.lastContent = fs.readFileSync(discovered, "utf8").replace(/^\uFEFF/, "");
          } catch {
            this.lastContent = null;
          }
          this.emit("path", discovered);
        }
      }
      const content = fs.readFileSync(this.filePath, "utf8").replace(/^\uFEFF/, "");
      this.reportFileStatus(true);
      if (content === this.lastContent) return;
      const arena = parseArenaData(JSON.parse(content));
      // Only mark content as consumed after parsing succeeds. The game may
      // expose the file while it is still being written.
      this.lastContent = content;
      this.emit("arena", arena);
    } catch (error) {
      if (error?.code === "ENOENT") this.reportFileStatus(false);
      else this.emit("warning", error.message);
    }
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.lastContent = null;
    this.lastDiscoveryAt = 0;
    this.fileExists = false;
    this.lastReportedPath = "";
    this.filePath = "";
    this.gameDirectory = "";
  }
}

module.exports = { ArenaWatcher, findArenaFile, resolveArenaFilePath };
