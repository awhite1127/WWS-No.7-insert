"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { shipsFromPort, summarizeSnowflakes } = require("../electron/snowflake.cjs");

test("normalizes and deduplicates the authorized port ship list", () => {
  assert.deepEqual(shipsFromPort([101, "102", 101, null, 0, { ship_id: 103 }]), [
    { ship_id: 101 },
    { ship_id: 102 },
    { ship_id: 103 },
  ]);
  assert.deepEqual(shipsFromPort(null), []);
});

test("summarizes anniversary tokens and supership steel by tier", () => {
  const ships = [{ ship_id: 1 }, { ship_id: 2 }, { ship_id: 3 }, { ship_id: 4 }, { ship_id: 5 }];
  const metadata = {
    1: { tier: 5 },
    2: { tier: 5 },
    3: { tier: 10 },
    4: { tier: 11 },
    5: { tier: 4 },
  };
  const result = summarizeSnowflakes(ships, metadata, { accountId: 42, nickname: "Tester", realm: "asia" });
  assert.equal(result.totalShips, 5);
  assert.equal(result.eligibleShips, 4);
  assert.equal(result.totalTokens, 175);
  assert.equal(result.totalSteel, 200);
  assert.equal(result.tiers.find((row) => row.tier === 5).count, 2);
  assert.ok(result.event.exchangeRewards.some((reward) => reward.id === "kurama" && reward.price === 11000));
});
