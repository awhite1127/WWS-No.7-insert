"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), vm = require("node:vm");
const { parseArenaData } = require("../electron/arena-parser.cjs");
const catalog = require("../data/operations.json");
const overviewExports = {};
vm.runInNewContext(require('typescript').transpileModule(fs.readFileSync(path.join(__dirname, '../src/lib/operation-overview.ts'), 'utf8'), {
  compilerOptions: { module: require('typescript').ModuleKind.CommonJS }
}).outputText, { exports: overviewExports });
const { buildOverview } = overviewExports;
const players = [{ name: "Tester", relation: 1 }];
test("operation identifiers survive localized display names and resource paths", () => {
  const arena = parseArenaData({ mapDisplayName: "巽他群岛", mapName: "spaces/s07_Advance", vehicles: players });
  assert.equal(arena.mapName, "巽他群岛"); assert.equal(arena.mapId, "spaces/s07_Advance");
  assert.equal(arena.isOperation, true); assert.equal(arena.operationId, "narai");
});
test("Mountain Range does not open Aegis for ordinary or cooperative battles", () => {
  for (const raw of [{ gameLogic: "Domination" }, { matchGroup: "coop" }]) {
    const arena = parseArenaData({ mapName: "37_Ridge", vehicles: players, ...raw });
    assert.equal(arena.isOperation, false); assert.equal(arena.operationId, "");
  }
  for (const raw of [{ gameLogic: "Scenario" }, { matchGroup: "pve_premade" }]) {
    assert.equal(parseArenaData({ mapName: "37_Ridge", vehicles: players, ...raw }).operationId, "aegis");
  }
});
test("unknown operations remain unknown instead of using another guide", () => {
  const arena = parseArenaData({ gameLogic: "Scenario", mapName: "s99_New_Operation", vehicles: players });
  assert.equal(arena.isOperation, true); assert.equal(arena.operationId, "");
});
test("every guide has bundled maps and point sets, including Raptor exit branches", () => {
  for (const op of catalog.operations) {
    assert.ok(fs.existsSync(path.join(__dirname, "../public", op.image)));
    assert.ok(op.pointSets.length);
    for (const set of op.pointSets) {
      assert.ok(set.points.length);
      for (const p of set.points) assert.ok(p.cell ? /^[A-K](?:[0-9]|10)$/.test(p.cell) : Number.isFinite(p.x) && Number.isFinite(p.y));
    }
  }
  const raptor = catalog.operations.find(op => op.id === "raptor");
  assert.equal(raptor.pointSets.length, 16);
  assert.ok(raptor.pointSets.some(set => set.points.some(p => p.cell === "K7")));
  assert.ok(raptor.pointSets.some(set => set.points.some(p => p.cell === "G0")));
});
test("every route has stage coverage and preserves common points without inventing exclusive spawns", () => {
  for (const op of catalog.operations) {
    assert.ok(op.stages.length > 1, op.id);
    for (const route of op.routes) for (const stage of op.stages) {
      assert.ok(op.pointSets.some(s => s.stage === stage && (s.route === "*" || s.route === route.id)), `${op.id}: ${route.id} / ${stage}`);
    }
    for (const set of op.pointSets) {
      assert.ok(set.route === "*" || op.routes.some(r => r.id === set.route));
      for (const p of set.points) {
        if (p.towards) assert.ok(Number.isFinite(p.towards.x) && Number.isFinite(p.towards.y));
      }
    }
  }
  const hermes = catalog.operations.find(op => op.id === "hermes");
  for (const [route, exit, reinforcement] of [["north", "A4", "A10"], ["west", "D1", "J1"]]) {
    assert.equal(hermes.routes.find(r => r.id === route).exitCell, exit);
    assert.equal(hermes.pointSets.find(s => s.stage === "维修点增援" && s.route === route).points[0].cell, reinforcement);
  }
  const frontier = catalog.operations.find(op => op.id === "ultimate-frontier");
  assert.ok(frontier.pointSets.filter(s => s.stage.startsWith("机场防守")).every(s => s.points.every(p => !["F5", "F7"].includes(p.cell))));
  assert.equal(frontier.pointSets.filter(s => s.stage === "维修基地驱逐舰").length, 2);
});
test("recognized and manually selected operations stop player stats requests", async () => {
  const source = fs.readFileSync(path.join(__dirname, "../electron/main.cjs"), "utf8");
  for (const [isOperation, mode] of [[true, "random"], [false, "operations"]]) {
    let calls = 0;
    const context = vm.createContext({ rosterRequestId: 0, rosterController: null, currentArena: null, currentRoster: [],
      AbortController, loadConfig: () => ({ realm: "asia", overlayBattleMode: mode }), createOverlayWindow: () => {}, sendAll: () => {},
      wg: { rosterStats: () => { calls++; } }
    });
    vm.runInContext(source.slice(source.indexOf("async function handleArena("), source.indexOf('watcher.on("arena",')), context);
    await context.handleArena({ isOperation, players });
    assert.equal(calls, 0); assert.equal(context.currentRoster.length, 0);
  }
});

test('overview includes all recorded spawn candidates for every actual route', () => {
  assert.deepEqual(catalog.operations.filter(o => o.overview.routeSelection).map(o => o.id), ['killer-whale', 'raptor', 'hermes']);
  assert.equal(catalog.operations.reduce((n,o) => n + (o.overview.routeSelection ? o.routes.length : 1), 0), 13);
  for (const op of catalog.operations) for (const route of op.routes) {
    const overview = buildOverview(op, route.id);
    assert.ok(overview.groups.every(g => g.entries.length), op.id);
    const sets = op.pointSets.filter(s => !op.overview.routeSelection || s.route === '*' || s.route === route.id);
    for (const set of sets) for (const p of set.points.filter(p => p.kind !== 'movement')) {
      const group = overview.groups.find(g => g.stages.includes(set.stage));
      assert.ok(group, `${op.id}: unnumbered stage ${set.stage}`);
      assert.ok(group.entries.some(e => e.label === p.label && e.cell === p.cell && e.x === p.x && e.y === p.y), `${op.id}: missing ${p.label}`);
    }
    assert.equal(overview.markers.flatMap(m => m.entries).length, overview.groups.flatMap(g => g.entries).length);
  }
});
test('random waves share range numbers and direction choices are removed', () => {
  for (const [id, range, count] of [['newport', '1–3', 3], ['ultimate-frontier', '4–6', 3]]) {
    const op = catalog.operations.find(o => o.id === id);
    assert.equal(op.overview.routeSelection, false);
    const overview = buildOverview(op, op.routes[0].id);
    assert.equal(overview.groups.find(g => g.number === range).entries.length, count);
    assert.equal(overview.markers.filter(m => m.numbers.includes(range)).length, count);
  }
  const frontier = buildOverview(catalog.operations.find(o => o.id === 'ultimate-frontier'), 'east');
  assert.deepEqual(Array.from(frontier.groups.find(g => g.number === '5').entries, p => p.cell), ['F5', 'F7']);
  assert.ok(frontier.groups.find(g => g.number === '1').entries.some(p => p.cell === 'G2'));
});
test('Narai displays all objectives together, Hermes swaps its whole route overview', () => {
  const narai = catalog.operations.find(o => o.id === 'narai');
  assert.equal(narai.overview.routeSelection, false);
  const entries = buildOverview(narai, 'convoy').groups.flatMap(g => g.entries);
  for (const cell of ['D7', 'G6']) assert.ok(entries.some(e => e.cell === cell));
  assert.ok(entries.every(e => e.kind !== 'movement'));
  const hermes = catalog.operations.find(o => o.id === 'hermes');
  for (const [route, include, exclude] of [['north', 'A10', 'J1'], ['west', 'J1', 'A10']]) {
    const overview = buildOverview(hermes, route);
    assert.equal(overview.groups.length, 6);
    assert.ok(overview.markers.some(p => p.cell === include));
    assert.ok(!overview.markers.some(p => p.cell === exclude));
  }
  assert.notEqual(buildOverview(hermes, 'north').groups[0].entries[0].x, buildOverview(hermes, 'west').groups[0].entries[0].x);
});
test('reused positions combine numbers without hiding later spawns', () => {
  const killer = catalog.operations.find(o => o.id === 'killer-whale');
  const west = buildOverview(killer, 'west'), north = buildOverview(killer, 'north');
  assert.deepEqual(west, north);
  assert.deepEqual(Array.from(west.markers.find(p => p.cell === 'A1').numbers), ['2', '4']);
  const narai = buildOverview(catalog.operations.find(o => o.id === 'narai'), 'convoy');
  const final = narai.groups.find(g => g.number === '5');
  assert.equal(narai.markers.filter(m => m.numbers.includes('5')).length, 1);
  assert.ok(final.entries.length >= 3);
});

test('every route has a distinct clean base and only spawn positions are shown', () => {
  for(const op of catalog.operations) {
    const variants = op.overview.routeSelection ? op.routes : [{image:op.image}];
    const contents = variants.map(r => fs.readFileSync(path.join(__dirname,'../public',r.image),'utf8'));
    assert.equal(new Set(contents).size, variants.length, op.id);
    for(const svg of contents) {
      assert.ok(svg.includes('data:image/png;base64,'));
      assert.ok(!/<(?:polyline|marker)\b/.test(svg));
    }
    for(const route of op.routes) assert.ok(buildOverview(op,route.id).groups.flatMap(g => g.entries).every(p => p.kind !== 'movement'));
  }
});
