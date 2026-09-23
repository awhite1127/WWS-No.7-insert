"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { DAY_MS, makeSnapshot, mergeSnapshot, recentFromSnapshots } = require("../electron/stats-history.cjs");

test("calculates recent random-battle performance from cumulative snapshots", () => {
  const now = Date.UTC(2026, 8, 22);
  const current = { capturedAt: now, battles: 120, wins: 70, damageDealt: 12_000_000, xp: 240_000, frags: 130, survivedBattles: 60 };
  const prior = { capturedAt: now - 7 * DAY_MS, battles: 100, wins: 58, damageDealt: 9_800_000, xp: 196_000, frags: 108, survivedBattles: 49 };
  const result = recentFromSnapshots(current, [prior]);
  const seven = result.periods.find((item) => item.days === 7);
  assert.equal(seven.available, true);
  assert.equal(seven.battles, 20);
  assert.equal(seven.winRate, 60);
  assert.equal(seven.avgDamage, 110000);
  assert.equal(result.periods.find((item) => item.days === 30).available, false);
});

test("creates and compacts local cumulative snapshots", () => {
  const first = makeSnapshot({ cumulative: { battles: 10, wins: 6, damageDealt: 1000, xp: 500, frags: 8, survivedBattles: 4 } }, 1000);
  assert.equal(first.battles, 10);
  const updated = { ...first, capturedAt: 2000, battles: 11 };
  assert.deepEqual(mergeSnapshot([first], updated), [updated]);
});
