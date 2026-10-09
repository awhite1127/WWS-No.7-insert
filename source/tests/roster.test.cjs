"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");

// roster-lifecycle
{
  const fs = require("node:fs");
  const path = require("node:path");
  const vm = require("node:vm");
  const { enrichRosterKarma } = require("../electron/karma-service.cjs");

  test("realm/battle replacement cancels the previous generation and rejects its late publication", async () => {
    const source = fs.readFileSync(path.join(__dirname, "../electron/main.cjs"), "utf8");
    const operations = [], events = [], config = { realm: "asia", overlayBattleMode: "random" };
    const context = vm.createContext({ rosterRequestId: 0, rosterController: null, currentArena: null, currentRoster: [],
      AbortController, loadConfig: () => config, createOverlayWindow: () => {}, enrichRosterKarma,
      karmaService: { get: async () => 0 },
      sendAll: (channel, payload) => events.push([channel, payload]),
      wg: { rosterStats: (_players, realm, current, progress, _mode, options) => new Promise(resolve => operations.push({ realm, current, progress, options, resolve })) },
    });
    vm.runInContext(source.slice(source.indexOf("async function handleArena("), source.indexOf('watcher.on("arena",')), context);
    const arena = { battleId: "old", players: [{ key: "1", name: "P" }] };
    const old = context.handleArena(arena);
    config.realm = "eu";
    const next = context.handleArena({ ...arena, battleId: "next" });
    assert.equal(operations[0].options.signal.aborted, true);
    assert.equal(operations[0].current(), false);
    assert.equal(context.currentArena.realm, "eu");
    const entry = { key: "1", name: "New", realm: "eu", status: "ok", accountId: 1 };
    operations[1].progress(entry, 0);
    operations[1].resolve([entry]); await next;
    operations[0].progress({ name: "Old", status: "ok" }, 0);
    operations[0].resolve([{ name: "Old", status: "ok" }]); await old;
    assert.equal(context.currentRoster[0].name, "New");
    assert.equal(context.currentRoster[0].gameKarma, 0);
  });

  test("optional row enrichment does not restart karma loading or discard completed karma", async () => {
    const source = fs.readFileSync(path.join(__dirname, "../electron/main.cjs"), "utf8");
    let progress, finish, calls = 0;
    const context = vm.createContext({ rosterRequestId: 0, rosterController: null, currentArena: null, currentRoster: [],
      AbortController, loadConfig: () => ({ realm: "asia", overlayBattleMode: "random" }), createOverlayWindow: () => {}, sendAll: () => {},
      enrichRosterKarma, karmaService: { get: async () => { calls++; return 7; } },
      wg: { rosterStats: (_p, _r, _c, callback) => { progress = callback; return new Promise(resolve => { finish = resolve; }); } },
    });
    vm.runInContext(source.slice(source.indexOf("async function handleArena("), source.indexOf('watcher.on("arena",')), context);
    const pending = context.handleArena({ players: [{ key: "1", name: "P" }] });
    const entry = { key: "1", name: "P", accountId: 1, status: "ok" };
    progress(entry, 0); await new Promise(resolve => setImmediate(resolve));
    entry.clan = { tag: "TAG" }; progress(entry, 0); finish([entry]); await pending;
    assert.equal(calls, 1); assert.equal(entry.gameKarma, 7); assert.equal(entry.karmaStatus, "ok");
  });
}

// roster-mode
{
  const { WgApi } = require("../electron/wg-api.cjs");
  const account = { nickname: "Tester", hidden_profile: false, statistics: {
    pvp: { battles: 1000, wins: 700, xp: 2000000, damage_dealt: 100000000 },
    rank_solo: { battles: 10, wins: 6, xp: 20000, damage_dealt: 500000, frags: 10, survived_battles: 3 },
    rank_div2: { battles: 5, wins: 2, xp: 12000, damage_dealt: 400000, frags: 6, survived_battles: 2 },
    rank_div3: { battles: 5, wins: 4, xp: 18000, damage_dealt: 300000, frags: 9, survived_battles: 3 },
  } };
  const ship = { ship_id: 99,
    pvp: { battles: 200, wins: 180, damage_dealt: 40000000, xp: 400000 },
    rank_solo: { battles: 4, wins: 3, damage_dealt: 400000, xp: 8000, frags: 5 },
    rank_div2: { battles: 2, wins: 0, damage_dealt: 100000, xp: 3000, frags: 1 },
    rank_div3: { battles: 0, wins: 0, damage_dealt: 0, xp: 0, frags: 0 },
  };
  const players = [{ key: "a", name: "Tester", accountId: 1, shipId: 99, shipName: "Example", side: "ally" }];
  function apiFor(accountRecord = account, shipRecord = ship) {
    const api = new WgApi(() => "test");
    const calls = [];
    api.shipMetadata = async () => ({ 99: { name: "Example", type: "Destroyer", tier: 8 } });
    api.request = async (_realm, endpoint, params) => {
      calls.push({ endpoint, params });
      if (endpoint === "account/info") return { data: { 1: accountRecord } };
      if (endpoint === "ships/stats") return { data: { 1: [shipRecord] } };
      return { data: {} };
    };
    return { api, calls };
  }
  test("roster defaults to random account and ship stats without requesting ranked extras", async () => {
    const { api, calls } = apiFor();
    const [p] = await api.rosterStats(players);
    assert.equal(p.battleMode, "random"); assert.equal(p.overall.battles, 1000);
    assert.equal(p.currentShip.battles, 200); assert.equal(p.currentShip.winRate, 90);
    assert.ok(calls.every(c => !c.params.extra));
  });
  test("ranked mode sums solo and division totals and divides after aggregation for both columns", async () => {
    const { api, calls } = apiFor();
    const progress = [];
    const [p] = await api.rosterStats(players, "asia", () => true, entry => progress.push(entry), "ranked");
    assert.equal(p.battleMode, "ranked"); assert.equal(p.status, "ok");
    assert.deepEqual(p.overall, { battles: 20, wins: 12, winRate: 60, avgDamage: 60000, avgXp: 2500, avgFrags: 1.25, survivalRate: 40 });
    assert.equal(p.currentShip.battles, 6); assert.equal(p.currentShip.winRate, 50);
    assert.equal(p.currentShip.avgDamage, 500000 / 6); assert.equal(p.currentShip.avgXp, 11000 / 6);
    assert.equal(progress[0].battleMode, "ranked");
    assert.equal(calls.find(c => c.endpoint === "account/info").params.extra, "statistics.rank_solo,statistics.rank_div2,statistics.rank_div3");
    const shipCall = calls.find(c => c.endpoint === "ships/stats");
    assert.equal(shipCall.params.extra, "rank_solo,rank_div2,rank_div3");
    assert.ok(shipCall.params.fields.includes("rank_div3.xp"));
    assert.ok(!shipCall.params.fields.includes("pvp."));
    assert.ok(calls.every(c => c.endpoint !== "seasons/accountinfo"));
  });
  test("missing or zero ranked data remains unavailable rather than substituting random stats", async () => {
    for (const ranked of [undefined, { battles: 0, wins: 0 }]) {
      const { api } = apiFor({ ...account, statistics: { pvp: account.statistics.pvp, rank_solo: ranked } }, { ship_id: 99, pvp: ship.pvp, rank_solo: ranked });
      const [p] = await api.rosterStats(players, "asia", () => true, null, "ranked");
      assert.equal(p.status, "ok"); assert.equal(p.overall, null); assert.equal(p.currentShip, null);
    }
  });
  test("ranked individual fallback still requests ranked account extras after a batch failure", async () => {
    const { api } = apiFor(); const request = api.request; let fallback = false;
    api.request = async (realm, endpoint, params) => {
      if (endpoint === "account/info" && params.fields) throw new Error("batch unavailable");
      if (endpoint === "account/info") { fallback = true; assert.equal(params.extra, "statistics.rank_solo,statistics.rank_div2,statistics.rank_div3"); }
      return request(realm, endpoint, params);
    };
    const [p] = await api.rosterStats(players, "asia", () => true, null, "ranked");
    assert.equal(fallback, true); assert.equal(p.overall.battles, 20); assert.equal(p.currentShip.battles, 6);
  });
  test("ranked selection preserves private profiles and ordinary player details remain random", async () => {
    const { api } = apiFor({ ...account, hidden_profile: true });
    const [hidden] = await api.rosterStats(players, "asia", () => true, null, "ranked");
    assert.equal(hidden.status, "hidden"); assert.equal(hidden.currentShip, null);
    const normal = apiFor().api;
    const details = await normal.playerDetails(1);
    assert.equal(details.overall.battles, 1000); assert.equal(details.ships[0].battles, 200);
  });
}
