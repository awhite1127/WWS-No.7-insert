"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { KarmaService, enrichRosterKarma } = require("../electron/karma-service.cjs");
const response = profile => ({ ok: true, json: async () => profile });
test("reads In-Game karma, including zero, from each region's production host", async () => {
  const urls = [];
  const service = new KarmaService({ fetchImpl: async url => {
    urls.push(url);
    return response({ id: 101, gameKarma: url.includes("api.na.") ? 0 : 4, siteKarma: 999 });
  } });
  assert.equal(await service.get(101, "asia"), 4);
  assert.equal(await service.get(101, "eu"), 4);
  assert.equal(await service.get(101, "na"), 0);
  assert.deepEqual(urls, ["https://api.asia.wows-karma.com/api/player/101?includeClanInfo=false", "https://api.wows-karma.com/api/player/101?includeClanInfo=false", "https://api.na.wows-karma.com/api/player/101?includeClanInfo=false"]);
});
test("never substitutes site karma, malformed fields, or another player's score", async () => {
  for (const profile of [{ id: 101, siteKarma: 99 }, { id: 101, gameKarma: null }, { id: 101, gameKarma: "4" }, { id: 101, gameKarma: -1 }, { id: 102, gameKarma: 4 }]) {
    assert.equal(await new KarmaService({ fetchImpl: async () => response(profile) }).get(101), null);
  }
});
test("deduplicates requests and caches successes and failures with separate expiry", async () => {
  let time = 0, calls = 0;
  const service = new KarmaService({ now: () => time, fetchImpl: async () => { calls++; return response({ id: 101, gameKarma: 4 }); } });
  assert.deepEqual(await Promise.all([service.get(101), service.get(101)]), [4, 4]);
  assert.equal(calls, 1);
  time = 119999; assert.equal(await service.get(101), 4); assert.equal(calls, 1);
  time = 120001; await service.get(101); assert.equal(calls, 2);
  service.fetchImpl = async () => { calls++; throw new Error("offline"); };
  time = 240002; assert.equal(await service.get(101), null); assert.equal(calls, 3);
  time += 29999; await service.get(101); assert.equal(calls, 3);
  time += 2; await service.get(101); assert.equal(calls, 4);
});
test("limits concurrency and continues past an aborted or failed request", async () => {
  let active = 0, maximum = 0;
  const service = new KarmaService({ concurrency: 2, timeoutMs: 10, fetchImpl: async (url, { signal }) => {
    active++; maximum = Math.max(maximum, active);
    await new Promise((resolve, reject) => signal.addEventListener("abort", () => { active--; reject(new Error("timeout")); }, { once: true }));
  } });
  assert.deepEqual(await Promise.all([1, 2, 3, 4, 5].map(id => service.get(id))), [null, null, null, null, null]);
  assert.equal(maximum, 2);
  assert.equal(await new KarmaService({ fetchImpl: async () => ({ ok: false }) }).get(1), null);
});
test("publishes stats immediately and guards against a late response to an old battle", async () => {
  let resolve, current = true, calls = 0;
  const service = { get: () => new Promise(r => { resolve = r; }) };
  const entry = { accountId: 101, overall: { winRate: 55 } };
  const pending = enrichRosterKarma(service, entry, "asia", () => current, () => calls++);
  assert.equal(calls, 1); assert.equal(entry.karmaStatus, "loading"); assert.equal(entry.overall.winRate, 55);
  current = false; resolve(4); await pending;
  assert.equal(calls, 1); assert.equal(entry.gameKarma, null);
  current = true;
  await enrichRosterKarma({ get: async () => 0 }, entry, "asia", () => current, () => calls++);
  assert.equal(entry.karmaStatus, "ok"); assert.equal(entry.gameKarma, 0);
  await enrichRosterKarma({ get: async () => null }, entry, "asia", () => current, () => calls++);
  assert.equal(entry.karmaStatus, "unavailable"); assert.equal(entry.gameKarma, null);
  await enrichRosterKarma({ get: () => { throw new Error("must not request"); } }, { accountId: null }, "asia", () => true, () => {});
});
