"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { WgApi } = require("../electron/wg-api.cjs");

test("prefers WG international simplified Chinese ship names over other translations", async () => {
  const api = new WgApi(() => "test-app-id");
  api.request = async (realm, endpoint, params) => {
    assert.equal(realm, "asia");
    assert.equal(endpoint, "encyclopedia/ships");
    assert.equal(params.language, "zh-tw");
    return { data: { 3436099280: { ship_id: 3436099280, name: "BA 狒", tier: 9, type: "Cruiser", nation: "japan" } } };
  };
  const metadata = await api.shipMetadata([3436099280], "asia");
  assert.equal(metadata[3436099280].name, "BA高梁");
});

test("matches the current battle ship by name when the arena ship id is stale", async () => {
  const api = new WgApi(() => "test-app-id");
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
