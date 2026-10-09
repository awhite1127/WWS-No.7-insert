"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { WgApi } = require("../electron/wg-api.cjs");
const { containerDetails } = require("../electron/containers.cjs");

test("simultaneous equivalent requests share one fetch and failures can be retried", async (t) => {
  const api = new WgApi(() => "test");
  let calls = 0;
  t.mock.method(globalThis, "fetch", async () => {
    calls++;
    if (calls <= 3) throw new Error("offline");
    return { ok: true, json: async () => ({ status: "ok", data: { answer: 42 } }) };
  });
  const failed = await Promise.allSettled(Array.from({ length: 12 }, (_, index) => api.request("asia", "account/info",
    index % 2 ? { account_id: "1", fields: "nickname" } : { fields: "nickname", account_id: "1" }, 60)));
  assert.ok(failed.every((result) => result.status === "rejected"));
  assert.equal(calls, 3);
  assert.equal(api.inFlight.size, 0);
  api.nextRequestAt = 0;
  const result = await api.request("asia", "account/info", { account_id: "1", fields: "nickname" }, 60);
  assert.equal(result.data.answer, 42);
  await api.request("asia", "account/info", { account_id: "1", fields: "nickname" }, 60);
  assert.equal(calls, 4);
});

test("request cache stays bounded across a long session and removes expired responses", async (t) => {
  const api = new WgApi(() => "test");
  t.mock.method(globalThis, "fetch", async () => ({ ok: true, json: async () => ({ status: "ok", data: {} }) }));
  for (let id = 0; id < 300; id++) {
    api.nextRequestAt = 0; // No wall-clock rate-limit delay in this cache test.
    await api.request("asia", "account/info", { account_id: String(id) }, 60);
  }
  assert.equal(api.cache.size, 256);
  for (const entry of api.cache.values()) entry.expiresAt = 0;
  api.nextRequestAt = 0;
  await api.request("asia", "account/info", { account_id: "301" }, 60);
  assert.equal(api.cache.size, 1);
});

test("ship metadata is reused across different fleet combinations and isolated by realm", async () => {
  const api = new WgApi(() => "test");
  const queries = [];
  api.request = async (realm, _endpoint, params) => {
    queries.push([realm, params.ship_id]);
    return { data: Object.fromEntries(params.ship_id.split(",").map((id) => [id, { ship_id: Number(id), name: `Ship ${id}` }])) };
  };
  await api.shipMetadata([1, 2], "asia");
  const combined = await api.shipMetadata([2, 3], "asia");
  assert.equal(combined[2].name, "Ship 2");
  await api.shipMetadata([1, 2, 3], "asia");
  await api.shipMetadata([2], "eu");
  assert.deepEqual(queries, [["asia", "1,2"], ["asia", "3"], ["eu", "2"]]);
});

function rosterFixture() {
  const api = new WgApi(() => "test");
  const players = Array.from({ length: 24 }, (_, index) => ({ key: String(index), name: `Player${index + 1}`, accountId: null, shipId: 9000 }));
  const calls = [];
  api.request = async (_realm, endpoint, params) => {
    calls.push({ endpoint, params });
    if (endpoint === "account/list") return { data: players.map((player, index) => ({ nickname: player.name, account_id: index + 1 })) };
    if (endpoint === "encyclopedia/ships") return { data: { 9000: { name: "Ship", tier: 10, type: "Battleship" } } };
    if (endpoint === "account/info") return { data: Object.fromEntries(params.account_id.split(",").map((id) => [id, {
      nickname: `Player${id}`, statistics: { pvp: { battles: 10, wins: 6 } },
    }])) };
    if (endpoint === "clans/accountinfo") return { data: Object.fromEntries(params.account_id.split(",").map((id) => [id, { clan_id: Number(id) + 100 }])) };
    if (endpoint === "clans/info") return { data: Object.fromEntries(params.clan_id.split(",").map((id) => [id, { clan_id: Number(id), tag: `C${id}`, name: `Clan ${id}` }])) };
    if (endpoint === "ships/stats") return { data: { [params.account_id]: [{ ship_id: 9000, pvp: { battles: 5, wins: 4 } }] } };
    throw new Error(`Unexpected endpoint: ${endpoint}`);
  };
  return { api, players, calls };
}

test("24-player cold roster uses 29 requests and preserves account, ship and clan data", async () => {
  const { api, players, calls } = rosterFixture();
  const roster = await api.rosterStats(players);
  assert.equal(roster.length, 24);
  assert.equal(calls.length, 29);
  const shipCalls = calls.filter((call) => call.endpoint === "ships/stats");
  assert.equal(shipCalls.length, 24);
  assert.ok(shipCalls.every((call) => call.params.ship_id === "9000"));
  for (const endpoint of ["account/info", "clans/accountinfo", "clans/info"]) {
    assert.equal(calls.filter((call) => call.endpoint === endpoint).length, 1);
  }
  for (const [index, player] of roster.entries()) {
    assert.equal(player.status, "ok");
    assert.equal(player.overall.winRate, 60);
    assert.equal(player.currentShip.winRate, 80);
    assert.equal(player.clan.tag, `C${index + 101}`);
  }
});

test("batch failure falls back to individual accounts without dropping valid players", async () => {
  const { api, players } = rosterFixture();
  const original = api.request;
  api.request = async (realm, endpoint, params) => {
    if (endpoint === "account/info" && params.account_id.includes(",")) throw new Error("batch unavailable");
    return original(realm, endpoint, params);
  };
  const roster = await api.rosterStats(players);
  assert.equal(roster.filter((player) => player.status === "ok").length, 24);
});

test("partial 24-player account batch retries only its 12 missing accounts", async () => {
  const { api, players, calls } = rosterFixture();
  const original = api.request;
  api.request = async (realm, endpoint, params) => {
    const body = await original(realm, endpoint, params);
    if (endpoint === "account/info" && params.account_id.includes(",")) {
      for (let id = 13; id <= 24; id++) delete body.data[id];
    }
    return body;
  };
  const roster = await api.rosterStats(players);
  assert.equal(roster.length, 24);
  assert.equal(roster.filter((player) => player.status === "ok").length, 24);
  assert.equal(calls.filter((call) => call.endpoint === "account/info" && !call.params.account_id.includes(",")).length, 12);
});

test("temporary WG quota and HTTP failures are retried without retaining errors", async (t) => {
  const api = new WgApi(() => "test");
  let calls = 0;
  t.mock.method(globalThis, "fetch", async () => {
    calls++;
    if (calls === 1) return { ok: true, json: async () => ({ status: "error", error: { code: 407, message: "REQUEST_LIMIT_EXCEEDED" } }) };
    if (calls === 2) return { ok: false, status: 503 };
    return { ok: true, json: async () => ({ status: "ok", data: { answer: 42 } }) };
  });
  assert.equal((await api.request("asia", "account/info", { account_id: "1" }, 60)).data.answer, 42);
  assert.equal(calls, 3);
  await api.request("asia", "account/info", { account_id: "1" }, 60);
  assert.equal(calls, 3);
});

test("permanent WG errors are not retried", async (t) => {
  const api = new WgApi(() => "test");
  let calls = 0;
  t.mock.method(globalThis, "fetch", async () => {
    calls++;
    return { ok: true, json: async () => ({ status: "error", error: { code: "INVALID_APPLICATION_ID", message: "invalid ID" } }) };
  });
  await assert.rejects(api.request("asia", "account/info", { account_id: "1" }), /invalid ID/);
  assert.equal(calls, 1);
});

test("superseded battles stop scheduling remaining players", async () => {
  const { api, players, calls } = rosterFixture();
  const original = api.request;
  let current = true;
  api.request = async (realm, endpoint, params) => {
    if (endpoint === "ships/stats") current = false;
    return original(realm, endpoint, params);
  };
  await api.rosterStats(players, "asia", () => current);
  const shipRequests = calls.filter((call) => call.endpoint === "ships/stats").length;
  assert.ok(shipRequests > 0 && shipRequests <= 4);
});

test("known hidden profiles skip ship requests while preserving public players", async () => {
  const { api, players, calls } = rosterFixture();
  const original = api.request;
  api.request = async (...args) => {
    const body = await original(...args);
    if (args[1] === "account/info") body.data[1] = { nickname: "Player1", hidden_profile: true };
    return body;
  };
  const roster = await api.rosterStats(players.slice(0, 2));
  assert.deepEqual(roster.map((player) => player.status), ["hidden", "ok"]);
  assert.equal(calls.filter((call) => call.endpoint === "ships/stats").length, 1);
});

test("reopening a container shares pending and cached data, but different realms remain separate", async (t) => {
  let calls = 0;
  t.mock.method(globalThis, "fetch", async () => {
    calls++;
    return { ok: true, json: async () => ({ status: "ok", data: { id: "998877", title: "Test", slots: [] } }) };
  });
  await Promise.all(Array.from({ length: 6 }, () => containerDetails("998877", "asia")));
  await containerDetails("998877", "asia");
  assert.equal(calls, 1);
  await containerDetails("998877", "eu");
  assert.equal(calls, 2);
});

test("invalid container responses are not retained in cache", async (t) => {
  let calls = 0;
  t.mock.method(globalThis, "fetch", async () => {
    calls++;
    return { ok: true, json: async () => calls === 1 ? { status: "error" }
      : { status: "ok", data: { id: "998878", title: "Recovered", slots: [] } } };
  });
  await assert.rejects(containerDetails("998878"));
  assert.equal((await containerDetails("998878")).title, "Recovered");
  assert.equal(calls, 2);
});


test("completed roster entries arrive before the slowest player finishes", async () => {
  const { api, players } = rosterFixture();
  const original = api.request;
  let releaseSlow;
  const slow = new Promise((resolve) => { releaseSlow = resolve; });
  let firstReady;
  const first = new Promise((resolve) => { firstReady = resolve; });
  api.request = async (realm, endpoint, params) => {
    if (endpoint === "ships/stats" && params.account_id === "2") await slow;
    return original(realm, endpoint, params);
  };
  const updates = [];
  const pending = api.rosterStats(players.slice(0, 2), "asia", () => true, (entry, index) => {
    updates.push([index, entry.status]);
    if (index === 0) firstReady();
  });
  try {
    await first;
    assert.deepEqual(updates, [[0, "ok"]]);
  } finally { releaseSlow(); }
  const result = await pending;
  // A later publication may enrich a finished row with optional clan data.
  assert.deepEqual(updates.slice(0, 2), [[0, "ok"], [1, "ok"]]);
  assert.ok(updates.every(([, status]) => status === "ok"));
  assert.deepEqual(result.map((entry) => entry.status), ["ok", "ok"]);
});

test("ship metadata survives a restart without another encyclopedia request", async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "wws-ship-cache-"));
  const file = path.join(directory, "ships.json");
  try {
    const first = new WgApi(() => "test");
    first.setShipCacheFile(file);
    first.request = async () => ({ data: { 123: { ship_id: 123, name: "Cached Ship", tier: 9, type: "Cruiser" } } });
    assert.equal((await first.shipMetadata([123], "asia"))[123].name, "Cached Ship");
    await first.flushShipCache();
    const second = new WgApi(() => "test");
    second.setShipCacheFile(file);
    second.request = async () => { throw new Error("offline"); };
    assert.equal((await second.shipMetadata([123], "asia"))[123].name, "Cached Ship");
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});

test("several cold metadata groups start without waiting for the first response", async () => {
  const api = new WgApi(() => "test");
  const requests = [];
  const releases = [];
  api.request = (_realm, endpoint, params) => {
    requests.push({ endpoint, ids: params.ship_id });
    return new Promise((resolve) => releases.push(() => resolve({ data: {} })));
  };
  const pending = api.shipMetadata(Array.from({ length: 161 }, (_, index) => index + 1), "asia");
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(requests.length, 3);
  releases.forEach((release) => release());
  await pending;
});

test("ship metadata keeps successful groups when another group fails", async () => {
  const api = new WgApi(() => "test");
  api.request = async (_realm, _endpoint, params) => {
    if (params.ship_id.startsWith("81,")) throw new Error("temporary failure");
    return { data: Object.fromEntries(params.ship_id.split(",").map((id) => [id, { ship_id: Number(id), name: `Ship ${id}` }])) };
  };
  const metadata = await api.shipMetadata(Array.from({ length: 100 }, (_, index) => index + 1), "asia");
  assert.equal(Object.keys(metadata).length, 80);
  assert.equal(metadata[1].name, "Ship 1");
  assert.equal(metadata[81], undefined);
});
