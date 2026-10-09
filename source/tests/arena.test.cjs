"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");

// arena-parser
{

  const path = require("node:path");
  const { parseArenaData, parseArenaFile } = require("../electron/arena-parser.cjs");

  test("parses the bundled tempArenaInfo fixture", () => {
    const arena = parseArenaFile(path.join(__dirname, "..", "fixtures", "tempArenaInfo.sample.json"));
    assert.equal(arena.players.length, 2);
    assert.equal(arena.players[0].side, "ally");
    assert.equal(arena.players[1].side, "enemy");
    assert.equal(arena.mapName, "模拟海域");
  });

  test("discovers a nested roster and tolerates alternate field names", () => {
    const arena = parseArenaData({ payload: { participants: [{ nickname: "Tester", team: 2, ship_id: 42, accountDBID: 123456 }] } });
    assert.equal(arena.players[0].name, "Tester");
    assert.equal(arena.players[0].shipId, 42);
    assert.equal(arena.players[0].side, "enemy");
    assert.equal(arena.players[0].accountId, 123456);
  });
}

// arena-watcher
{

  const fs = require("node:fs");
  const os = require("node:os");
  const path = require("node:path");
  const { ArenaWatcher, resolveArenaFilePath } = require("../electron/arena-watcher.cjs");

  test("unchanged arena files are not read again on each poll", async (t) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "wws-idle-"));
    const arenaFile = path.join(root, "tempArenaInfo.json");
    fs.writeFileSync(arenaFile, JSON.stringify({ vehicles: [{ name: "Tester" }] }));
    const original = fs.promises.readFile;
    let reads = 0;
    t.mock.method(fs.promises, "readFile", async (...args) => { reads++; return original(...args); });
    const watcher = new ArenaWatcher();
    try {
      await watcher.start(arenaFile);
      for (let i = 0; i < 10; i++) await watcher.poll();
      assert.equal(reads, 1);
    } finally {
      watcher.stop();
      fs.unlinkSync(arenaFile);
      fs.rmdirSync(root);
    }
  });

  test("stopping during an asynchronous read prevents stale battle events", async (t) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "wws-cancel-"));
    const arenaFile = path.join(root, "tempArenaInfo.json");
    fs.writeFileSync(arenaFile, JSON.stringify({ vehicles: [{ name: "Tester" }] }));
    let release;
    let entered;
    const gate = new Promise((resolve) => { release = resolve; });
    const started = new Promise((resolve) => { entered = resolve; });
    const original = fs.promises.readFile;
    let reads = 0;
    t.mock.method(fs.promises, "readFile", async (...args) => {
      reads++;
      entered();
      await gate;
      return original(...args);
    });
    const watcher = new ArenaWatcher();
    let events = 0;
    watcher.on("arena", () => events++);
    try {
      const start = watcher.start(arenaFile);
      await started;
      const overlappingPoll = watcher.poll();
      watcher.stop();
      release();
      await Promise.all([start, overlappingPoll]);
      assert.equal(events, 0);
      assert.equal(reads, 1);
      assert.equal(watcher.timer, null);
    } finally {
      release();
      watcher.stop();
      fs.unlinkSync(arenaFile);
      fs.rmdirSync(root);
    }
  });

  test("finds the live arena file under the selected game directory", async () => {
    const gameDirectory = path.join(path.parse(process.cwd()).root, "Games", "World_of_Warships");
    assert.equal(
      await resolveArenaFilePath(gameDirectory),
      path.join(gameDirectory, "replays", "tempArenaInfo.json"),
    );

    const watcher = new ArenaWatcher();
    try {
      assert.equal(await watcher.start(gameDirectory), path.join(gameDirectory, "replays", "tempArenaInfo.json"));
    } finally {
      watcher.stop();
    }
  });

  test("finds an existing arena file when the launcher parent or replays directory is selected", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "wws-arena-"));
    const game = path.join(root, "Games", "World_of_Warships");
    const replays = path.join(game, "replays");
    const arenaFile = path.join(replays, "tempArenaInfo.json");
    fs.mkdirSync(replays, { recursive: true });
    fs.writeFileSync(arenaFile, "{}", "utf8");
    try {
      assert.equal(await resolveArenaFilePath(root), arenaFile);
      assert.equal(await resolveArenaFilePath(replays), arenaFile);
      assert.equal(await resolveArenaFilePath(arenaFile), arenaFile);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test("selects the newest arena file inside versioned replay folders", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "wws-nested-"));
    const game = path.join(root, "World_of_Warships");
    const replays = path.join(game, "replays");
    const older = path.join(replays, "tempArenaInfo.json");
    const newer = path.join(replays, "replay-15.8.0.0", "tempArenaInfo.json");
    fs.mkdirSync(path.dirname(newer), { recursive: true });
    fs.writeFileSync(older, "{}");
    fs.writeFileSync(newer, "{}");
    fs.utimesSync(older, new Date(1000), new Date(1000));
    fs.utimesSync(newer, new Date(2000), new Date(2000));
    try {
      assert.equal(await resolveArenaFilePath(game), newer);
      assert.equal(await resolveArenaFilePath(replays), newer);
      assert.equal(await resolveArenaFilePath(root), newer);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test("finds a versioned replay directory beside the game executable", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "wws-versioned-"));
    const versioned = path.join(root, "replay-15.8.0.0");
    const arenaFile = path.join(versioned, "tempArenaInfo.json");
    fs.mkdirSync(versioned);
    fs.writeFileSync(arenaFile, "{}");
    try {
      assert.equal(await resolveArenaFilePath(root), arenaFile);
      assert.equal(await resolveArenaFilePath(versioned), arenaFile);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test("retries the same file version when parsing initially fails", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "wws-retry-"));
    const replays = path.join(root, "replays");
    const arenaFile = path.join(replays, "tempArenaInfo.json");
    fs.mkdirSync(replays, { recursive: true });
    const watcher = new ArenaWatcher();
    let arenas = 0;
    watcher.on("arena", () => { arenas += 1; });
    try {
      await watcher.start(root);
      assert.equal(watcher.fileExists, false);
      fs.writeFileSync(arenaFile, "{", "utf8");
      await watcher.poll();
      assert.equal(watcher.lastContent, null);
      fs.writeFileSync(arenaFile, JSON.stringify({ vehicles: [{ name: "Tester", relation: 1 }] }), "utf8");
      await watcher.poll();
      assert.equal(arenas, 1);
    } finally {
      watcher.stop();
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test("loads an existing battle immediately and reloads it only when content changes", async () => {
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
      await watcher.start(root);
      assert.equal(arenas, 1);
      assert.equal(watcher.fileExists, true);
      assert.equal(statuses.at(-1).arenaFileFound, true);
      fs.writeFileSync(arenaFile, oldContent, "utf8");
      await watcher.poll();
      assert.equal(arenas, 1);
      const originalTime = fs.statSync(arenaFile).mtime;
      fs.writeFileSync(arenaFile, JSON.stringify({ vehicles: [{ name: "NewBattle", relation: 1 }] }), "utf8");
      fs.utimesSync(arenaFile, originalTime, originalTime);
      await watcher.poll();
      assert.equal(arenas, 2);
    } finally {
      watcher.stop();
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test("loads a file discovered later under the selected folder", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "wws-discovery-"));
    const watcher = new ArenaWatcher();
    const arenaFile = path.join(root, "Games", "World_of_Warships", "replays", "tempArenaInfo.json");
    let arenas = 0;
    watcher.on("arena", () => { arenas += 1; });
    try {
      await watcher.start(root);
      fs.mkdirSync(path.dirname(arenaFile), { recursive: true });
      fs.writeFileSync(arenaFile, JSON.stringify({ vehicles: [{ name: "OldBattle", relation: 1 }] }));
      watcher.lastDiscoveryAt = 0;
      await watcher.poll();
      assert.equal(watcher.filePath, arenaFile);
      assert.equal(watcher.fileExists, true);
      assert.equal(watcher.watchedDirectory, path.dirname(arenaFile));
      assert.equal(arenas, 1);
      fs.writeFileSync(arenaFile, JSON.stringify({ vehicles: [{ name: "NewBattle", relation: 1 }] }));
      await watcher.poll();
      assert.equal(arenas, 2);
    } finally {
      watcher.stop();
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test("switches to a newer file while the previous replay file still exists", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "wws-switch-"));
    const replays = path.join(root, "replays");
    const older = path.join(replays, "tempArenaInfo.json");
    const newer = path.join(replays, "replay-15.8.0.0", "tempArenaInfo.json");
    fs.mkdirSync(path.dirname(newer), { recursive: true });
    fs.writeFileSync(older, JSON.stringify({ vehicles: [{ name: "OldBattle", relation: 1 }] }));
    const watcher = new ArenaWatcher();
    const names = [];
    watcher.on("arena", (arena) => names.push(arena.players[0].name));
    try {
      await watcher.start(root);
      assert.deepEqual(names, ["OldBattle"]);
      fs.writeFileSync(newer, JSON.stringify({ vehicles: [{ name: "NewBattle", relation: 1 }] }));
      fs.utimesSync(older, new Date(1000), new Date(1000));
      fs.utimesSync(newer, new Date(2000), new Date(2000));
      watcher.lastDiscoveryAt = 0;
      await watcher.poll();
      assert.equal(watcher.filePath, newer);
      assert.deepEqual(names, ["OldBattle", "NewBattle"]);
    } finally {
      watcher.stop();
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test("waits through a brief disappearance, then clears an ended battle and reloads the next one", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "wws-battle-lifecycle-"));
    const replays = path.join(root, "replays");
    const arenaFile = path.join(replays, "tempArenaInfo.json");
    const content = JSON.stringify({ vehicles: [{ name: "Tester", relation: 1 }] });
    fs.mkdirSync(replays);
    const watcher = new ArenaWatcher();
    const names = [];
    let ended = 0;
    watcher.on("arena", (arena) => names.push(arena.players[0].name));
    watcher.on("arena-ended", () => { ended += 1; });
    try {
      await watcher.start(root);
      assert.equal(watcher.fileExists, false);
      fs.writeFileSync(arenaFile, content);
      await watcher.poll();
      assert.deepEqual(names, ["Tester"]);

      fs.unlinkSync(arenaFile);
      await watcher.poll();
      assert.equal(ended, 0);
      fs.writeFileSync(arenaFile, content);
      await watcher.poll();
      assert.equal(ended, 0);
      assert.deepEqual(names, ["Tester"]);

      fs.unlinkSync(arenaFile);
      await watcher.poll();
      await watcher.poll();
      assert.equal(ended, 1);
      assert.equal(watcher.fileExists, false);
      assert.equal(watcher.lastContent, null);
      await watcher.poll();
      assert.equal(ended, 1);

      fs.writeFileSync(arenaFile, content);
      await watcher.poll();
      assert.deepEqual(names, ["Tester", "Tester"]);
      assert.equal(watcher.fileExists, true);
    } finally {
      watcher.stop();
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test("discovers and clears a battle file in the game's versioned replay folder", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "wws-version-lifecycle-"));
    const arenaFile = path.join(root, "replays", "15.8.0.0", "tempArenaInfo.json");
    fs.mkdirSync(path.dirname(arenaFile), { recursive: true });
    const watcher = new ArenaWatcher();
    const names = [];
    let ended = 0;
    watcher.on("arena", (arena) => names.push(arena.players[0].name));
    watcher.on("arena-ended", () => { ended += 1; });
    try {
      await watcher.start(root);
      fs.writeFileSync(arenaFile, JSON.stringify({ vehicles: [{ name: "First", relation: 1 }] }));
      watcher.lastDiscoveryAt = 0;
      await watcher.poll();
      assert.equal(watcher.filePath, arenaFile);
      assert.equal(watcher.watchedDirectory, path.join(root, "replays"));
      assert.deepEqual(names, ["First"]);

      fs.unlinkSync(arenaFile);
      watcher.lastDiscoveryAt = 0;
      await watcher.poll();
      await watcher.poll();
      assert.equal(ended, 1);

      fs.writeFileSync(arenaFile, JSON.stringify({ vehicles: [{ name: "Second", relation: 1 }] }));
      watcher.lastDiscoveryAt = 0;
      await watcher.poll();
      assert.equal(watcher.filePath, arenaFile);
      assert.deepEqual(names, ["First", "Second"]);
    } finally {
      watcher.stop();
      fs.rmSync(root, { recursive: true, force: true });
    }
  });


  test("stable live arena avoids repeated recursive discovery but reacts to a directory change", async (t) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "wws-discovery-rate-"));
    const replays = path.join(root, "replays");
    const arenaFile = path.join(replays, "tempArenaInfo.json");
    fs.mkdirSync(replays);
    fs.writeFileSync(arenaFile, JSON.stringify({ vehicles: [{ name: "Tester" }] }));
    const watcher = new ArenaWatcher();
    try {
      await watcher.start(root);
      watcher.directoryWatcher?.close();
      watcher.directoryWatcher = null;
      watcher.discoveryDirty = false;
      watcher.lastDiscoveryAt = Date.now() - 5000;
      const original = fs.promises.readdir;
      let scans = 0;
      t.mock.method(fs.promises, "readdir", async (...args) => { scans++; return original(...args); });
      await watcher.poll();
      assert.equal(scans, 0);
      watcher.discoveryDirty = true;
      await watcher.poll();
      assert.ok(scans > 0);
    } finally {
      watcher.stop();
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
}

// battle-summary
{

  const { summarizeBattleTeams } = require("../src/battle-summary.ts");

  test("team win-rate comparison averages only public account records", () => {
    const summary = summarizeBattleTeams([
      { side: "ally", status: "ok", overall: { battles: 100, winRate: 48 } },
      { side: "ally", status: "ok", overall: { battles: 1000, winRate: 60 } },
      { side: "ally", status: "hidden", overall: null },
      { side: "enemy", status: "ok", overall: { battles: 200, winRate: 45 } },
      { side: "enemy", status: "loading", overall: null },
    ]);
    assert.deepEqual(summary.ally, { value: 54, available: 2, total: 3 });
    assert.deepEqual(summary.enemy, { value: 45, available: 1, total: 2 });
    assert.equal(summarizeBattleTeams([{ side: "ally", status: "loading", overall: null }]).ally.value, null);
  });
}
