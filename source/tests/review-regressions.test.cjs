"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { WgApi } = require("../electron/wg-api.cjs");
const { StatsHistoryStore } = require("../electron/stats-history-store.cjs");
const { RequestScheduler } = require("../electron/request-scheduler.cjs");
const { RosterBroadcaster } = require("../electron/roster-broadcaster.cjs");
const { recentFromSnapshots, DAY_MS } = require("../electron/stats-history.cjs");
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const tick = () => new Promise(resolve => setImmediate(resolve));

test("body stream failures retry, malformed JSON does not retry", async t => {
  let calls = 0;
  t.mock.method(globalThis, "fetch", async () => ({ ok: true, json: async () => {
    if (++calls === 1) throw new TypeError("terminated");
    return { status: "ok", data: { recovered: true } };
  } }));
  const api = new WgApi(() => "test");
  assert.equal((await api.request("asia", "account/info")).data.recovered, true);
  assert.equal(calls, 2);
  calls = 0;
  globalThis.fetch = async () => { calls++; return { ok: true, json: async () => { throw new SyntaxError("bad JSON"); } }; };
  await assert.rejects(api.request("asia", "account/info"), SyntaxError);
  assert.equal(calls, 1);
});

test("partial metadata retains cached ships when every missing batch fails", async () => {
  const api = new WgApi(() => "test");
  api.shipCache.set("asia:123", { value: { name: "Cached", tier: 9 }, expiresAt: Date.now() + 60000 });
  api.request = async () => { throw new Error("offline"); };
  assert.equal((await api.shipMetadata([123, 456], "asia"))[123].name, "Cached");
  await assert.rejects(api.shipMetadata([456], "asia"), /offline/);
});

test("a sparse 100-day baseline cannot masquerade as recent 1/7/30-day data", () => {
  const prior = { capturedAt: 100 * DAY_MS, battles: 100, wins: 50, damageDealt: 1000, xp: 1000, frags: 10, survivedBattles: 20 };
  const current = { ...prior, capturedAt: 200 * DAY_MS, battles: 110, wins: 55 };
  const result = recentFromSnapshots(current, [prior]);
  for (const period of result.periods.filter(item => item.days <= 30)) assert.equal(period.available, false);
  assert.equal(result.periods.find(item => item.days === 90).available, true);
});

test("optional clan and encyclopedia stalls do not prevent core roster publication", async () => {
  const api = new WgApi(() => "test"), clan = deferred(), metadata = deferred();
  api.shipMetadata = () => metadata.promise;
  api.request = async (_r, endpoint) => {
    if (endpoint === "account/info") return { data: { 1: { nickname: "P", statistics: { pvp: { battles: 100, wins: 60 } } } } };
    if (endpoint === "clans/accountinfo") return clan.promise;
    if (endpoint === "ships/stats") return { data: { 1: [{ ship_id: 123, pvp: { battles: 10, wins: 6 } }] } };
    if (endpoint === "clans/info") return { data: { 7: { clan_id: 7, tag: "TAG", name: "Clan" } } };
    return { data: {} };
  };
  const updates = [];
  const pending = api.rosterStats([{ name: "P", accountId: 1, shipId: 123 }], "asia", () => true,
    entry => updates.push({ status: entry.status, clan: entry.clan, winRate: entry.currentShip?.winRate }));
  await tick();
  try {
    assert.equal(updates[0].status, "ok");
    assert.equal(updates[0].winRate, 60);
    assert.equal(updates[0].clan, null);
  } finally {
    clan.resolve({ data: { 1: { clan_id: 7 } } });
    metadata.resolve({ 123: { name: "Example", tier: 9, type: "Cruiser" } });
  }
  const [result] = await pending;
  assert.equal(result.clan.tag, "TAG");
  assert.equal(result.shipTier, 9);
  assert.equal(result.currentShip.tier, 9);
  assert.equal(result.currentShip.name, "Example");
});

test("queued core requests overtake optional jobs, canceled jobs do not consume a slot", async () => {
  let next = Date.now() + 10000;
  const scheduler = new RequestScheduler(() => next, value => { next = value; }, 0);
  const order = [], controller = new AbortController();
  const optional = scheduler.take(20).then(() => order.push("optional"));
  const canceled = scheduler.take(0, controller.signal);
  const rejection = assert.rejects(canceled, { name: "AbortError" });
  const core = scheduler.take(0).then(() => order.push("core"));
  controller.abort(); await rejection;
  next = 0; scheduler.pump();
  await Promise.all([core, optional]);
  assert.deepEqual(order, ["core", "optional"]);
});

test("canceled battle jobs never fetch; a new generation can query the same URL", async t => {
  const api = new WgApi(() => "test"), old = new AbortController();
  let calls = 0;
  t.mock.method(globalThis, "fetch", async () => { calls++; return { ok: true, json: async () => ({ status: "ok", data: {} }) }; });
  api.nextRequestAt = Date.now() + 10000;
  const oldJob = api.request("asia", "account/info", { account_id: "1" }, 60, { signal: old.signal });
  const rejection = assert.rejects(oldJob, { name: "AbortError" });
  old.abort(); await rejection;
  assert.equal(calls, 0); assert.equal(api.inFlight.size, 0);
  api.nextRequestAt = 0;
  await api.request("asia", "account/info", { account_id: "1" }, 60, { signal: new AbortController().signal });
  assert.equal(calls, 1);
});

test("canceling an active battle fetch does not cancel an unrelated caller", async t => {
  const api = new WgApi(() => "test"), old = new AbortController();
  let calls = 0;
  t.mock.method(globalThis, "fetch", (_url, { signal }) => {
    calls++;
    if (calls === 1) return new Promise((_resolve, reject) => signal.addEventListener("abort", () => reject(signal.reason), { once: true }));
    return Promise.resolve({ ok: true, json: async () => ({ status: "ok", data: { good: true } }) });
  });
  const job = api.request("asia", "account/info", {}, 0, { signal: old.signal });
  const rejection = assert.rejects(job, { name: "AbortError" });
  await tick(); old.abort(); await rejection;
  assert.equal((await api.request("asia", "account/info")).data.good, true);
  assert.equal(calls, 2);
});

function player(battles = 100) {
  return { realm: "asia", accountId: 1, nickname: "P", hiddenProfile: false, shipsStatus: "ok",
    cumulative: { battles, wins: battles / 2, damageDealt: battles * 100000, xp: battles * 1000, frags: battles, survivedBattles: battles / 2 },
    ships: [{ shipId: 4276041424, name: "大和", type: "Battleship", tier: 10, battles, wins: battles / 2, avgDamage: 100000, avgXp: 1000, avgFrags: 1 }], ranked: [] };
}
async function directory(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "wws-review-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  return root;
}

test("ship endpoint failure is explicit and never destroys same-day complete PR", async t => {
  const root = await directory(t); let now = new Date(2026, 9, 1, 12).getTime();
  const store = new StatsHistoryStore(() => root, { now: () => now });
  const first = await store.attach(player());
  assert.ok(first.history[0].pr);
  const api = new WgApi(() => "test");
  api.request = async (_r, endpoint) => {
    if (endpoint === "ships/stats") throw new Error("offline");
    if (endpoint === "account/info") return { data: { 1: { nickname: "P", statistics: { pvp: { battles: 102, wins: 51 } } } } };
    return { data: {} };
  };
  const partial = await api.playerDetails(1);
  assert.equal(partial.shipsStatus, "unavailable");
  now += 1000;
  const second = await store.attach(partial);
  assert.deepEqual(second.history, first.history);
  const onDisk = JSON.parse(await fs.readFile(path.join(root, "asia-1.json"), "utf8"));
  assert.deepEqual(onDisk.snapshots, first.history);
  now += 1000;
  const recovered = await store.attach(player(102));
  assert.equal(recovered.history[0].capturedAt, now);
  assert.equal(recovered.history[0].battles, 102);
});

test("history cache reduces reads; per-account atomic writes serialize concurrent updates", async t => {
  const root = await directory(t); let now = new Date(2026, 9, 1, 12).getTime();
  let reads = 0, active = 0, maximum = 0;
  const io = { ...fs, readFile: async (...args) => { reads++; return fs.readFile(...args); },
    writeFile: async (...args) => { active++; maximum = Math.max(maximum, active); await tick(); await fs.writeFile(...args); active--; } };
  const store = new StatsHistoryStore(() => root, { io, now: () => ++now, cacheLimit: 2 });
  await Promise.all([store.attach(player()), store.attach(player(102)), store.attach(player(104))]);
  await store.flush();
  assert.equal(maximum, 1); assert.equal(reads, 1);
  const stored = JSON.parse(await fs.readFile(path.join(root, "asia-1.json"), "utf8"));
  assert.equal(stored.snapshots.at(-1).battles, 104);
  assert.equal(store.pending.size, 0);
  assert.equal((await fs.readdir(root)).some(name => name.endsWith(".tmp")), false);
  await store.attach({ ...player(), accountId: 2 });
  await store.attach({ ...player(), accountId: 3 });
  assert.equal(store.cache.size, 2);
});

test("failed atomic replacement preserves the original history and cleans its temporary file", async t => {
  const root = await directory(t), file = path.join(root, "asia-1.json");
  await new StatsHistoryStore(() => root).attach(player());
  const original = await fs.readFile(file, "utf8");
  const io = { ...fs, rename: async () => { throw new Error("locked"); } };
  const result = await new StatsHistoryStore(() => root, { io }).attach(player(102));
  assert.match(result.recent.storageError, /locked/);
  assert.equal(await fs.readFile(file, "utf8"), original);
  assert.deepEqual(await fs.readdir(root), ["asia-1.json"]);
});

test("damaged history is reported and never overwritten", async t => {
  const root = await directory(t), file = path.join(root, "asia-1.json");
  await fs.writeFile(file, "{broken");
  const result = await new StatsHistoryStore(() => root).attach(player());
  assert.ok(result.recent.storageError);
  assert.equal(await fs.readFile(file, "utf8"), "{broken");
});

test("roster broadcasts are coalesced; hidden windows receive latest state only on reveal", () => {
  const received = [];
  let visible = false;
  const window = { isDestroyed: () => false, isVisible: () => visible, isMinimized: () => false,
    webContents: { send: (channel, value) => received.push([channel, value]) } };
  const broadcaster = new RosterBroadcaster(() => [window]);
  for (let index = 0; index < 100; index++) broadcaster.update([index]);
  broadcaster.flush(); assert.equal(received.length, 0);
  visible = true; broadcaster.send(window);
  assert.deepEqual(received, [["roster:stats", [99]]]);
  for (let index = 100; index < 200; index++) broadcaster.update([index]);
  broadcaster.flush(); assert.equal(received.length, 2);
  assert.deepEqual(received.at(-1)[1], [199]);
});

test("partial encyclopedia results explicitly warn that snowflake rewards are incomplete", async () => {
  const api = new WgApi(() => "test");
  api.portShipIds = async () => [1, 2];
  api.shipMetadata = async () => ({ 1: { tier: 10 } });
  const result = await api.snowflakeSummary(1, "P", "token");
  assert.match(result.warning, /1 艘/);
  assert.equal(result.totalTokens, 125);
});
