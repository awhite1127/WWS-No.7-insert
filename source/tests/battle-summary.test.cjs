const test = require("node:test");
const assert = require("node:assert/strict");

const { summarizeBattleTeams } = require("../src/battle-summary.ts");

test("team win-rate comparison averages only public account records", () => {
  const summary = summarizeBattleTeams([
    { side: "ally", status: "ok", overall: { battles: 100, winRate: 48 } },
    { side: "ally", status: "ok", overall: { battles: 1000, winRate: 60 } },
    { side: "ally", status: "hidden", overall: null },
    { side: "enemy", status: "ok", overall: { battles: 200, winRate: 45 } },
    { side: "enemy", status: "loading", overall: null },
  ]);
  assert.deepEqual(summary.ally, { value: 54, available: 2, total: 3 });
  assert.deepEqual(summary.enemy, { value: 45, available: 1, total: 2 });
  assert.equal(summarizeBattleTeams([{ side: "ally", status: "loading", overall: null }]).ally.value, null);
});
