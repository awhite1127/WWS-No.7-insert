"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { shipEntries, groupId } = require("../scripts/sync-christmas-pools.cjs");
const { pools: [pool] } = require("../data/christmas-pools.json");
test("Santa ships are grouped by official drop table rather than ship tier", () => {
  assert.deepEqual(pool.groups.map(g => g.id), ["rare", "high", "low"]);
  assert.deepEqual(pool.groups.map(g => pool.ships.filter(s => s.groupId === g.id).length), [42, 53, 48]);
  assert.equal(pool.ships.length, 143);
  assert.equal(new Set(pool.ships.map(s => s.id)).size, 143);
  assert.equal(pool.ships.find(s => s.englishName === "Theseus").groupId, "low");
  assert.equal(pool.ships.find(s => s.englishName === "Smolensk").groupId, "rare");
  assert.ok(pool.ships.some(s => s.groupId === "rare" && s.tier < 8));
  assert.ok(pool.ships.every(s => pool.groups.some(g => g.id === s.groupId && g.label === s.group)));
});
test("Santa group probabilities match WG's gift, mega and ultra tables", () => {
  assert.deepEqual(pool.groups.map(g => g.probabilities), [{ gift: 0.1, mega: 1, ultra: 3 }, { gift: 0.4, mega: 3, ultra: 9 }, { gift: 2, mega: 12, ultra: 20 }]);
  assert.deepEqual(pool.probabilitySources, { gift: "4016231344", mega: "4015182768", ultra: "4014134192" });
});
test("Santa sync reads the group probability and rejects unknown classifications", () => {
  const reward = { id: "1", type: "ship", probability: 99 };
  const data = { slots: [{ valuableRewards: { rare: { title: "Tier V–X ship", probability: "0.1", rewards: [reward, { type: "credits" }] } } }] };
  assert.deepEqual(shipEntries(data), [{ group: "Tier V–X ship", probability: 0.1, reward }]);
  assert.equal(groupId("Tier V–X ship"), "rare");
  assert.equal(groupId("Tier VIII–IX ship"), "high");
  assert.equal(groupId("Tier V–VIII ship"), "low");
  assert.equal(groupId("Tier V–VII ship"), "low");
  assert.throws(() => groupId("Unknown"), /Unknown official/);
});
