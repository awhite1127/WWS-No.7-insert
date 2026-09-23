"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { WgApi } = require("../electron/wg-api.cjs");

test("loads ship names from the official WG Asia localization", async () => {
  const api = new WgApi(() => "test-app-id");
  api.request = async (realm, endpoint, params) => {
    assert.equal(realm, "asia");
    assert.equal(endpoint, "encyclopedia/ships");
    assert.equal(params.language, "zh-tw");
    return { data: { 1: { ship_id: 1, name: "大和", tier: 10, type: "Battleship", nation: "japan" } } };
  };
  const metadata = await api.shipMetadata([1], "asia");
  assert.equal(metadata[1].name, "大和");
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
