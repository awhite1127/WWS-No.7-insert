const test = require("node:test");
const assert = require("node:assert/strict");
const { WgApi } = require("../electron/wg-api.cjs");

test("clan details aggregate public random battles and retry omitted members", async () => {
  const api = new WgApi(() => "test");
  const calls = [];
  api.request = async (_realm, endpoint, params) => {
    calls.push({ endpoint, params });
    if (endpoint === "clans/info") return { data: { 42: {
      clan_id: 42, tag: "TEST", name: "Test Fleet", members_count: 3,
      members: [
        { account_id: 1, account_name: "Alpha", role: "commander" },
        { account_id: 2, account_name: "Bravo", role: "private" },
        { account_id: 3, account_name: "Charlie", role: "private" },
      ],
    } } };
    if (endpoint === "account/info" && params.account_id === "1,2,3") return { data: {
      1: { statistics: { pvp: { battles: 10, wins: 6, damage_dealt: 1000, xp: 200 } } },
      3: { hidden_profile: true },
    } };
    if (endpoint === "account/info" && params.account_id === "2") return { data: {
      2: { statistics: { pvp: { battles: 30, wins: 15, damage_dealt: 9000, xp: 900 } } },
    } };
    throw new Error("unexpected request");
  };
  const clan = await api.clanDetails(42);
  assert.equal(clan.overall.publicMembers, 2);
  assert.equal(clan.overall.battles, 40);
  assert.equal(clan.overall.winRate, 52.5);
  assert.equal(clan.overall.avgDamage, 250);
  assert.equal(clan.overall.avgXp, 27.5);
  assert.equal(clan.overall.totalXp, 1100);
  assert.deepEqual(clan.members.map((member) => member.statsStatus), ["ok", "ok", "hidden"]);
  assert.equal(clan.members[1].overall.avgDamage, 300);
  assert.equal(clan.members[2].overall, null);
  assert.deepEqual(calls.filter((call) => call.endpoint === "account/info").map((call) => call.params.account_id), ["1,2,3", "2"]);
});

test("clan without public battle stats leaves aggregate unavailable", async () => {
  const api = new WgApi(() => "test");
  api.request = async (_realm, endpoint) => endpoint === "clans/info"
    ? { data: { 42: { clan_id: 42, tag: "TEST", name: "Test", members: [{ account_id: 1, account_name: "Hidden" }] } } }
    : { data: { 1: { hidden_profile: true } } };
  const clan = await api.clanDetails(42);
  assert.equal(clan.overall, null);
  assert.equal(clan.members[0].statsStatus, "hidden");
});
