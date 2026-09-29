"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { EventEmitter } = require("node:events");
const { parseArenaData } = require("./arena-parser.cjs");

const ARENA_FILE_NAME = "tempArenaInfo.json";
const SKIP_DIRECTORIES = new Set(["bin", "res", "res_packages", "updates", "screenshots", "profile", "node_modules"]);

function isReplayDirectory(name) {
  return /^replays?(?:[-_]\d+(?:\.\d+)*)?$/i.test(name);
}

async function newestReplayFile(replaysDirectory, isCurrent) {
  const pending = [replaysDirectory];
  let newest = "";
  let newestWriteTime = -1;
  while (pending.length > 0 && isCurrent()) {
    const directory = pending.pop();
    let entries;
    try {
      entries = await fs.promises.readdir(directory, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        pending.push(entryPath);
      } else if (entry.isFile() && entry.name.toLowerCase() === ARENA_FILE_NAME.toLowerCase()) {
        try {
          const writeTime = (await fs.promises.stat(entryPath)).mtimeMs;
          if (writeTime > newestWriteTime || (writeTime === newestWriteTime && entryPath < newest)) {
            newest = entryPath;
            newestWriteTime = writeTime;
          }
        } catch {}
      }
    }
  }
  return { filePath: newest, writeTime: newestWriteTime };
}

async function findArenaFile(root, maxDepth = 5, maxEntries = 1200, isCurrent = () => true) {
  const queue = [{ directory: root, depth: 0 }];
  let visited = 0;
  let latest = { filePath: "", writeTime: -1 };
  while (visited < queue.length && visited < maxEntries && isCurrent()) {
    const { directory, depth } = queue[visited];
    visited += 1;
    if (isReplayDirectory(path.basename(directory))) {
      const found = await newestReplayFile(directory, isCurrent);
      if (found.writeTime > latest.writeTime) latest = found;
      continue;
    }
    if (depth > maxDepth) continue;
    let entries = [];
    try {
      entries = await fs.promises.readdir(directory, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith(".") || SKIP_DIRECTORIES.has(entry.name.toLowerCase())) continue;
      const child = path.join(directory, entry.name);
      if (isReplayDirectory(entry.name)) {
        const found = await newestReplayFile(child, isCurrent);
        if (found.writeTime > latest.writeTime) latest = found;
      } else {
        queue.push({ directory: child, depth: depth + 1 });
      }
    }
  }
  return latest.filePath;
}

async function resolveArenaFilePath(gameDirectory, isCurrent = () => true) {
  const selected = path.resolve(gameDirectory);
  if (path.basename(selected).toLowerCase() === ARENA_FILE_NAME.toLowerCase()) return selected;
  const nested = await findArenaFile(selected, 5, 1200, isCurrent);
  if (nested) return nested;
  return isReplayDirectory(path.basename(selected))
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
    this.missingPolls = 0;
    this.arenaActive = false;
    this.lastSignature = null;
    this.pollPromise = null;
    this.generation = 0;
  }

  async start(gameDirectory) {
    this.stop();
    const generation = this.generation;
    this.gameDirectory = path.resolve(gameDirectory);
    const discovered = await resolveArenaFilePath(gameDirectory, () => generation === this.generation);
    if (generation !== this.generation) return "";
    this.filePath = discovered;
    this.lastDiscoveryAt = Date.now();
    this.timer = setInterval(() => this.poll(), 1200);
    await this.poll();
    return generation === this.generation ? this.filePath : "";
  }

  reportFileStatus(found) {
    if (this.fileExists === found && this.lastReportedPath === this.filePath) return;
    this.fileExists = found;
    this.lastReportedPath = this.filePath;
    this.emit("file-status", { watchedPath: this.filePath, arenaFileFound: found });
  }

  async poll() {
    if (this.pollPromise) return this.pollPromise;
    const operation = this.readPoll(this.generation);
    this.pollPromise = operation;
    try { await operation; }
    finally { if (this.pollPromise === operation) this.pollPromise = null; }
  }

  async readPoll(generation) {
    if (!this.gameDirectory) return;
    try {
      if (Date.now() - this.lastDiscoveryAt > 4000) {
        this.lastDiscoveryAt = Date.now();
        const discovered = await resolveArenaFilePath(this.gameDirectory, () => generation === this.generation);
        if (generation !== this.generation) return;
        this.lastDiscoveryAt = Date.now();
        if (discovered !== this.filePath) {
          this.filePath = discovered;
          this.lastContent = null;
          this.lastSignature = null;
          this.emit("path", discovered);
        }
      }
      const stat = await fs.promises.stat(this.filePath, { bigint: true });
      if (generation !== this.generation) return;
      this.missingPolls = 0;
      this.reportFileStatus(true);
      const signature = `${stat.mtimeNs}:${stat.ctimeNs}:${stat.size}:${stat.ino}`;
      if (signature === this.lastSignature) return;
      const content = (await fs.promises.readFile(this.filePath, "utf8")).replace(/^\uFEFF/, "");
      if (generation !== this.generation) return;
      if (content === this.lastContent) {
        this.lastSignature = signature;
        return;
      }
      const arena = parseArenaData(JSON.parse(content));
      // Only mark content as consumed after parsing succeeds. The game may
      // expose the file while it is still being written.
      this.lastContent = content;
      this.lastSignature = signature;
      this.arenaActive = true;
      this.emit("arena", arena);
    } catch (error) {
      if (generation !== this.generation) return;
      if (error?.code === "ENOENT") {
        this.lastSignature = null;
        this.reportFileStatus(false);
        // A brief disappearance can occur while the game replaces the file.
        if (++this.missingPolls >= 2 && this.arenaActive) {
          this.arenaActive = false;
          this.lastContent = null;
          this.emit("arena-ended");
        }
      } else this.emit("warning", error.message);
    }
  }

  stop() {
    this.generation++;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.lastContent = null;
    this.lastDiscoveryAt = 0;
    this.fileExists = false;
    this.lastReportedPath = "";
    this.missingPolls = 0;
    this.arenaActive = false;
    this.filePath = "";
    this.gameDirectory = "";
    this.lastSignature = null;
    this.pollPromise = null;
  }
}

module.exports = { ArenaWatcher, findArenaFile, resolveArenaFilePath };
