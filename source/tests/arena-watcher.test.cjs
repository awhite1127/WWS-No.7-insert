"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { ArenaWatcher, resolveArenaFilePath } = require("../electron/arena-watcher.cjs");

test("finds the live arena file under the selected game directory", () => {
  const gameDirectory = path.join(path.parse(process.cwd()).root, "Games", "World_of_Warships");
  assert.equal(
    resolveArenaFilePath(gameDirectory),
    path.join(gameDirectory, "replays", "tempArenaInfo.json"),
  );

  const watcher = new ArenaWatcher();
  try {
    assert.equal(watcher.start(gameDirectory), path.join(gameDirectory, "replays", "tempArenaInfo.json"));
  } finally {
    watcher.stop();
  }
});

test("finds an existing arena file when the launcher parent or replays directory is selected", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "wws-arena-"));
  const game = path.join(root, "Games", "World_of_Warships");
  const replays = path.join(game, "replays");
  const arenaFile = path.join(replays, "tempArenaInfo.json");
  fs.mkdirSync(replays, { recursive: true });
  fs.writeFileSync(arenaFile, "{}", "utf8");
  try {
    assert.equal(resolveArenaFilePath(root), arenaFile);
    assert.equal(resolveArenaFilePath(replays), arenaFile);
    assert.equal(resolveArenaFilePath(arenaFile), arenaFile);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("retries the same file version when parsing initially fails", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "wws-retry-"));
  const replays = path.join(root, "replays");
  const arenaFile = path.join(replays, "tempArenaInfo.json");
  fs.mkdirSync(replays, { recursive: true });
  const watcher = new ArenaWatcher();
  let arenas = 0;
  watcher.on("arena", () => { arenas += 1; });
  try {
    watcher.start(root);
    assert.equal(watcher.fileExists, false);
    fs.writeFileSync(arenaFile, "{", "utf8");
    watcher.poll();
    assert.equal(watcher.lastContent, null);
    fs.writeFileSync(arenaFile, JSON.stringify({ vehicles: [{ name: "Tester", relation: 1 }] }), "utf8");
    watcher.poll();
    assert.equal(arenas, 1);
  } finally {
    watcher.stop();
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("finds an existing file but waits for its content to change", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "wws-stale-"));
  const replays = path.join(root, "replays");
  const arenaFile = path.join(replays, "tempArenaInfo.json");
  fs.mkdirSync(replays, { recursive: true });
  const oldContent = JSON.stringify({ vehicles: [{ name: "OldBattle", relation: 1 }] });
  fs.writeFileSync(arenaFile, oldContent, "utf8");
  const watcher = new ArenaWatcher();
  let arenas = 0;
  const statuses = [];
  watcher.on("arena", () => { arenas += 1; });
  watcher.on("file-status", (status) => statuses.push(status));
  try {
    watcher.start(root);
    assert.equal(arenas, 0);
    assert.equal(watcher.fileExists, true);
    assert.equal(statuses.at(-1).arenaFileFound, true);
    fs.writeFileSync(arenaFile, oldContent, "utf8");
    watcher.poll();
    assert.equal(arenas, 0);
    const originalTime = fs.statSync(arenaFile).mtime;
    fs.writeFileSync(arenaFile, JSON.stringify({ vehicles: [{ name: "NewBattle", relation: 1 }] }), "utf8");
    fs.utimesSync(arenaFile, originalTime, originalTime);
    watcher.poll();
    assert.equal(arenas, 1);
  } finally {
    watcher.stop();
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("baselines an older file discovered later under the selected folder", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "wws-discovery-"));
  const watcher = new ArenaWatcher();
  const arenaFile = path.join(root, "Games", "World_of_Warships", "replays", "tempArenaInfo.json");
  let arenas = 0;
  watcher.on("arena", () => { arenas += 1; });
  try {
    watcher.start(root);
    fs.mkdirSync(path.dirname(arenaFile), { recursive: true });
    fs.writeFileSync(arenaFile, JSON.stringify({ vehicles: [{ name: "OldBattle", relation: 1 }] }));
    watcher.lastDiscoveryAt = 0;
    watcher.poll();
    assert.equal(watcher.filePath, arenaFile);
    assert.equal(watcher.fileExists, true);
    assert.equal(arenas, 0);
    fs.writeFileSync(arenaFile, JSON.stringify({ vehicles: [{ name: "NewBattle", relation: 1 }] }));
    watcher.poll();
    assert.equal(arenas, 1);
  } finally {
    watcher.stop();
    fs.rmSync(root, { recursive: true, force: true });
  }
});
