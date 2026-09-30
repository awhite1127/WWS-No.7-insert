const test = require("node:test");
const assert = require("node:assert/strict");

let saved = JSON.stringify([{ realm: "asia", accountId: 123, nickname: "Legacy", favorite: true, monkey: true }]);
global.localStorage = { getItem: () => saved, setItem: (_key, value) => { saved = value; } };
global.window = { addEventListener: () => {} };
const { automaticPlayerMark, playerMark, togglePlayerMark } = require("../src/player-marks.ts");

test("account win-rate thresholds apply only to available rates", () => {
  assert.equal(automaticPlayerMark(47.99), "monkey");
  assert.equal(automaticPlayerMark(48), null);
  assert.equal(automaticPlayerMark(61.99), null);
  assert.equal(automaticPlayerMark(62), "favorite");
  assert.equal(automaticPlayerMark(undefined), null);
  assert.equal(automaticPlayerMark(Number.NaN), null);
});

test("manual marks are exclusive and old double marks are normalized", () => {
  assert.deepEqual({ favorite: playerMark("asia", 123, "Legacy").favorite, monkey: playerMark("asia", 123, "Legacy").monkey }, { favorite: true, monkey: false });
  togglePlayerMark("asia", 456, "Manual", "monkey");
  assert.equal(playerMark("asia", 456, "Manual").monkey, true);
  togglePlayerMark("asia", 456, "Manual", "favorite");
  assert.deepEqual({ favorite: playerMark("asia", 456, "Manual").favorite, monkey: playerMark("asia", 456, "Manual").monkey }, { favorite: true, monkey: false });
  togglePlayerMark("asia", 456, "Manual", "favorite");
  assert.equal(playerMark("asia", 456, "Manual").favorite, false);
});

test("automatic mark wins over an opposite manual mark", () => {
  togglePlayerMark("asia", 789, "Override", "favorite");
  assert.deepEqual(playerMark("asia", 789, "Override", 47), { favorite: false, monkey: true });
  togglePlayerMark("asia", 789, "Override", "monkey");
  assert.deepEqual(playerMark("asia", 789, "Override", 62), { favorite: true, monkey: false });
});
