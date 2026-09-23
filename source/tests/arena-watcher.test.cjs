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
  fs.writeFileSync(arenaFile, "{", "utf8");
  const watcher = new ArenaWatcher();
  let arenas = 0;
  watcher.on("arena", () => { arenas += 1; });
  try {
    watcher.start(root);
    assert.equal(watcher.lastSignature, "");
    fs.writeFileSync(arenaFile, JSON.stringify({ vehicles: [{ name: "Tester", relation: 1 }] }), "utf8");
    watcher.poll();
    assert.equal(arenas, 1);
  } finally {
    watcher.stop();
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("does not load a stale arena snapshot from a previous session", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "wws-stale-"));
  const replays = path.join(root, "replays");
  const arenaFile = path.join(replays, "tempArenaInfo.json");
  fs.mkdirSync(replays, { recursive: true });
  fs.writeFileSync(arenaFile, JSON.stringify({ vehicles: [{ name: "OldBattle", relation: 1 }] }), "utf8");
  const old = new Date(Date.now() - 4 * 60 * 60 * 1000);
  fs.utimesSync(arenaFile, old, old);
  const watcher = new ArenaWatcher();
  let arenas = 0;
  watcher.on("arena", () => { arenas += 1; });
  try {
    watcher.start(root);
    assert.equal(arenas, 0);
  } finally {
    watcher.stop();
    fs.rmSync(root, { recursive: true, force: true });
  }
});
