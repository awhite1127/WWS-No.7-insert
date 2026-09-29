"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { WgApi } = require("../electron/wg-api.cjs");
const christmasPools = require("../data/christmas-pools.json");

test("bundles only the latest official Santa ship pool with unique ship IDs", () => {
  assert.equal(christmasPools.pools.length, 1);
  const [pool] = christmasPools.pools;
  assert.equal(pool.year, 2025);
  assert.equal(pool.ships.length, 143);
  assert.equal(new Set(pool.ships.map((ship) => ship.id)).size, pool.ships.length);
  assert.ok(pool.ships.every((ship) => ship.name && ship.englishName && ship.tier));
});

test("reads current owned ship IDs from the authorized port", async () => {
  const api = new WgApi(() => "test-app-id");
  api.request = async (realm, endpoint, params) => {
    assert.equal(realm, "asia");
    assert.equal(endpoint, "account/info");
    assert.equal(params.access_token, "token");
    return { data: { 123: { private: { port: [3436099280, { ship_id: 3544102864 }, 3436099280] } } } };
  };
  assert.deepEqual(await api.portShipIds(123, "token", "asia"), [3436099280, 3544102864]);
});

test("prefers WG international simplified Chinese ship names over other translations", async () => {
  const api = new WgApi(() => "test-app-id");
  api.request = async (realm, endpoint, params) => {
    assert.equal(realm, "asia");
    assert.equal(endpoint, "encyclopedia/ships");
    assert.equal(params.language, "en");
    return { data: { 3436099280: { ship_id: 3436099280, name: "BA Takahashi", tier: 9, type: "Cruiser", nation: "japan" } } };
  };
  const metadata = await api.shipMetadata([3436099280], "asia");
  assert.equal(metadata[3436099280].name, "BA高梁");
  assert.equal(metadata[3436099280].englishName, "BA Takahashi");
});

test("matches the current battle ship by name when the arena ship id is stale", async () => {
  const api = new WgApi(() => "test-app-id");
  api.request = async () => ({ data: {} });
  api.playerDetails = async () => ({
    accountId: 1,
    hiddenProfile: false,
    clan: null,
    overall: { battles: 100, winRate: 55, avgXp: 1800 },
    ships: [{ shipId: 999, name: "Yamato", battles: 40, winRate: 60, avgXp: 2100 }],
  });
  const [player] = await api.rosterStats([{ key: "p1", name: "Tester", accountId: 1, shipId: 123, shipName: "yamato" }], "asia");
  assert.equal(player.currentShip.shipId, 999);
  assert.equal(player.currentShip.avgXp, 2100);
});

test("keeps WG simplified Chinese ship names when ship metadata is temporarily unavailable", async () => {
  const api = new WgApi(() => "test-app-id");
  api.request = async () => ({ data: {} });
  api.shipMetadata = async () => { throw new Error("offline"); };
  api.playerDetails = async () => ({
    accountId: 1,
    hiddenProfile: false,
    clan: null,
    overall: { battles: 100, winRate: 55 },
    ships: [{ shipId: 4276041424, name: "Yamato", battles: 40, winRate: 60 }],
  });
  const [player] = await api.rosterStats([{ key: "p1", name: "Tester", accountId: 1, shipId: 4276041424, shipName: "Yamato" }], "asia");
  assert.equal(player.shipName, "大和");
  assert.equal(player.currentShip.name, "大和");
});

test("resolves missing arena account IDs with one exact-name lookup", async () => {
  const api = new WgApi(() => "test-app-id");
  api.shipMetadata = async () => ({});
  const lookups = [];
  api.request = async (_realm, endpoint, params) => {
    if (endpoint !== "account/list") return { data: {} };
    lookups.push(params);
    return { data: [{ nickname: "Alpha", account_id: 101 }, { nickname: "Beta", account_id: 202 }] };
  };
  api.playerDetails = async (accountId) => ({
    accountId, hiddenProfile: false, clan: null,
    overall: { battles: 10, winRate: 50 }, ships: [],
  });
  const roster = await api.rosterStats([
    { key: "a", name: "Alpha", accountId: null, shipId: 1 },
    { key: "b", name: "Beta", accountId: null, shipId: 2 },
  ], "asia");
  assert.deepEqual(lookups, [{ search: "Alpha,Beta", type: "exact", limit: "100" }]);
  assert.deepEqual(roster.map((player) => [player.status, player.accountId]), [["ok", 101], ["ok", 202]]);
});

test("optional WG endpoints do not make a public roster player unavailable", async () => {
  const api = new WgApi(() => "test-app-id");
  api.shipMetadata = async () => ({});
  api.request = async (_realm, endpoint) => {
    if (endpoint === "account/info") return {
      data: { 101: { nickname: "Alpha", statistics: { pvp: { battles: 10, wins: 6 } } } },
    };
    throw new Error(`${endpoint} temporarily unavailable`);
  };
  const [player] = await api.rosterStats([
    { key: "a", name: "Alpha", accountId: 101, shipId: 1 },
  ], "asia");
  assert.equal(player.status, "ok");
  assert.equal(player.overall.winRate, 60);
  assert.equal(player.currentShip, null);
});
