"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
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
