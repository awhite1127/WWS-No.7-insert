"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const vue = require("vue");
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
function setup(api = {}) {
  const source = fs.readFileSync(path.join(__dirname, "../src/App.vue"), "utf8").split('<script setup lang="ts">')[1].split('</script>')[0].replace(/^import .*;$/gm, '');
  const storage = new Map(), mounts = [], unmounts = [], subscriptions = {};
  const state = { realm: "asia", theme: "dark", gamePath: "", overlayEnabled: true, overlayHotkeyEnabled: true, overlayHotkey: "Tab", overlayBattleMode: "random" };
  const wws = {
    getConfig: async () => ({ ...state }), getArenaState: async () => ({ arena: null, roster: [], visible: true }),
    getWgAuthStatus: async () => ({ authorized: false }),
    getShipDataStatus: async () => ({state:"idle",version:"",revision:0,shipCount:0,checkedAt:null,updated:false,error:""}),
    saveConfig: async next => Object.assign(state, next),
    ...Object.fromEntries(["onShipDataStatus", "onConfigChanged", "onWindowActivity", "onArenaUpdate", "onRosterStats", "onOverlayStatus", "onUpdateProgress"].map(name => [name, callback => { subscriptions[name] = callback; return () => { delete subscriptions[name]; }; }])),
    ...api,
  };
  const context = vm.createContext({ defineAsyncComponent: vue.defineAsyncComponent, ref: vue.ref, computed: vue.computed, watch: vue.watch,
    onMounted: fn => mounts.push(fn), onUnmounted: fn => unmounts.push(fn),
    localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) },
    document: { documentElement: { dataset: {} } }, window: { wws }, Error, setTimeout, clearTimeout });
  const expose = `globalThis.h = { config, mode, activeView, query, player, clan, error, searching, suggestions, clanSuggestions, arena, roster, runSearch, loadPlayer, loadClan, selectMode, showQueryHistory, changeRealm, openHistory };`;
  vm.runInContext(ts.transpileModule(source + expose, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, context);
  context.h.selectMode("player");
  return { h: context.h, mounts, unmounts, subscriptions };
}

test("a late player response cannot replace a newer selection or its history", async () => {
  const first = deferred(), second = deferred();
  const { h } = setup({ playerDetails: id => id === 1 ? first.promise : second.promise });
  const a = h.loadPlayer(1), b = h.loadPlayer(2);
  second.resolve({ accountId: 2, nickname: "B", realm: "asia" }); await b;
  first.resolve({ accountId: 1, nickname: "A", realm: "asia" }); await a;
  assert.equal(h.player.value.accountId, 2); assert.equal(h.query.value, "B");
  assert.equal(h.searching.value, false);
});

test("stale errors/finally cannot overwrite the current query's error/loading state", async () => {
  const first = deferred(), second = deferred();
  const { h } = setup({ playerDetails: id => id === 1 ? first.promise : second.promise });
  const a = h.loadPlayer(1), b = h.loadPlayer(2);
  first.reject(new Error("old failure")); await a;
  assert.equal(h.searching.value, true); assert.equal(h.error.value, "");
  second.reject(new Error("current failure")); await b;
  assert.equal(h.error.value, "current failure"); assert.equal(h.searching.value, false);
});

test("a nickname response from the old realm never starts detail lookup in the new realm", async () => {
  const response = deferred(), requests = [];
  const { h } = setup({ searchPlayers: () => response.promise,
    playerDetails: async (...args) => { requests.push(args); return {}; } });
  h.query.value = "Alpha"; const pending = h.runSearch();
  await h.changeRealm("eu");
  response.resolve([{ nickname: "Alpha", account_id: 101 }]); await pending;
  assert.equal(requests.length, 0); assert.equal(h.player.value, null);
  assert.equal(h.config.value.realm, "eu"); assert.equal(h.searching.value, false);
});

test("returning to history invalidates in-progress lookup", async () => {
  const response = deferred();
  const { h } = setup({ playerDetails: () => response.promise });
  const pending = h.loadPlayer(1); h.showQueryHistory();
  response.resolve({ nickname: "A", accountId: 1 }); await pending;
  assert.equal(h.player.value, null); assert.equal(h.query.value, "");
});

test("cross-realm history persists the realm before querying its account", async () => {
  const requests = [];
  const { h } = setup({ saveConfig: async config => { requests.push(["save", config.realm]); return config; },
    playerDetails: async (id, realm) => { requests.push(["query", realm]); return { nickname: "A", accountId: id, realm }; } });
  await h.openHistory({ kind: "player", realm: "eu", id: 1, label: "A" });
  assert.deepEqual(requests, [["save", "eu"], ["query", "eu"]]);
  assert.equal(h.player.value.realm, "eu");
});

test("switching to clan prevents a pending player lookup from taking over", async () => {
  const response = deferred();
  const { h } = setup({ playerDetails: () => response.promise });
  const pending = h.loadPlayer(1); h.selectMode("clan");
  response.resolve({ nickname: "A", accountId: 1 }); await pending;
  assert.equal(h.player.value, null); assert.equal(h.mode.value, "clan");
});

test("subscriptions precede startup snapshot and newer events survive snapshot completion", async () => {
  const state = deferred();
  const { h, mounts, subscriptions, unmounts } = setup({ getArenaState: () => state.promise });
  const pending = mounts[0]();
  const current = { battleId: "new", realm: "eu", mapName: "M", players: [] };
  subscriptions.onArenaUpdate(current); subscriptions.onRosterStats([{ name: "new", status: "ok" }]);
  subscriptions.onConfigChanged({ realm: "eu" });
  state.resolve({ arena: { battleId: "old" }, roster: [], visible: true }); await pending;
  assert.equal(h.arena.value.battleId, "new"); assert.equal(h.roster.value[0].name, "new");
  assert.equal(h.config.value.realm, "eu");
  unmounts[0](); assert.equal(Object.keys(subscriptions).length, 0);
});
