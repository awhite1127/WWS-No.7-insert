"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");

// hotkey-config
{

  const { normalizeHotkey, resolveHotkeyCode } = require("../electron/hotkey-config.cjs");

  test("accepts supported overlay hotkeys and falls back to Tab", () => {
    assert.equal(normalizeHotkey("KeyQ"), "KeyQ");
    assert.equal(normalizeHotkey("F8"), "F8");
    assert.equal(normalizeHotkey("ControlLeft"), "Tab");
  });

  test("maps browser keyboard codes to uiohook key codes", () => {
    const keys = { Tab: 15, Q: 16, 7: 8, F8: 66 };
    assert.equal(resolveHotkeyCode("Tab", keys), 15);
    assert.equal(resolveHotkeyCode("KeyQ", keys), 16);
    assert.equal(resolveHotkeyCode("Digit7", keys), 8);
    assert.equal(resolveHotkeyCode("F8", keys), 66);
  });
}

// overlay-config
{
  const fs = require("node:fs");
  const path = require("node:path");
  const vm = require("node:vm");
  const { normalizeHotkey } = require("../electron/hotkey-config.cjs");
  const source = fs.readFileSync(path.join(__dirname, "../electron/main.cjs"), "utf8");
  const functions = source.slice(source.indexOf("function loadConfig()"), source.indexOf("const wg = new WgApi"));
  function launch(storage) {
    const context = vm.createContext({ cachedConfig: null, process: { env: {} }, path, normalizeHotkey,
      configPath: () => "settings/config.json", syncKeyboardHook: () => {},
      currentArena: null, destroyOverlayWindow: () => {}, createOverlayWindow: () => {}, sendAll: () => {}, handleArena: () => {},
      fs: { readFileSync: () => storage.content, mkdirSync: () => {}, writeFileSync: (file, value) => { assert.equal(file, "settings/config.json"); storage.content = value; } },
    });
    vm.runInContext(functions, context);
    return context;
  }
  test("legacy settings default to random and selected ranked mode survives restart and other setting saves", () => {
    const storage = { content: JSON.stringify({ applicationId: "test-key", overlayHotkey: "Tab" }) };
    let context = launch(storage);
    assert.equal(context.loadConfig().overlayBattleMode, "random");
    const saved = context.saveConfig({ overlayBattleMode: "ranked" });
    assert.equal(saved.overlayBattleMode, "ranked"); assert.equal(saved.applicationId, undefined);
    context = launch(storage);
    assert.equal(context.loadConfig().overlayBattleMode, "ranked");
    assert.equal(context.saveConfig({ theme: "light" }).overlayBattleMode, "ranked");
    assert.equal(context.saveConfig({ overlayBattleMode: "invalid" }).overlayBattleMode, "ranked");
    assert.equal(context.saveConfig({ overlayBattleMode: "random" }).overlayBattleMode, "random");
  });

  test("saving a new realm reloads the current battle and broadcasts the new config", () => {
    const context = launch({ content: JSON.stringify({ realm: "asia" }) });
    const arena = { battleId: "battle" }, events = [], refreshed = [];
    context.currentArena = arena;
    context.sendAll = (channel, payload) => events.push([channel, payload]);
    context.handleArena = value => refreshed.push(value);
    context.saveConfig({ realm: "eu" });
    assert.equal(context.loadConfig().realm, "eu");
    assert.equal(refreshed.length, 1); assert.equal(refreshed[0], arena);
    assert.equal(events[0][0], "config:changed"); assert.equal(events[0][1].realm, "eu");
    context.saveConfig({ theme: "light" }); assert.equal(refreshed.length, 1);
  });
}

// overlay-window
{
  const fs = require("node:fs");
  const path = require("node:path");
  const vm = require("node:vm");
  const { EventEmitter } = require("node:events");
  const { resolveHotkeyCode } = require("../electron/hotkey-config.cjs");

  function setup(overrides = {}) {
    const source = fs.readFileSync(path.join(__dirname, "../electron/main.cjs"), "utf8");
    const hook = new EventEmitter();
    hook.start = () => {}; hook.stop = () => {};
    let bounds = { x: -1280, y: 0, width: 1280, height: 720 };
    const cursor = { x: -700, y: 200 };
    const config = { overlayEnabled: true, overlayHotkeyEnabled: true, overlayHotkey: "Tab", ...overrides };
    class Window extends EventEmitter {
      constructor(options) { super(); this.options = options; this.bounds = options; this.visible = false; this.showCalls = 0; }
      isDestroyed() { return false; }
      setBounds(value) { this.bounds = value; }
      showInactive() { this.visible = true; this.showCalls++; }
      hide() { this.visible = false; }
      isVisible() { return this.visible; }
      setAlwaysOnTop() {}
      setIgnoreMouseEvents(value) { this.ignoreMouse = value; }
    }
    const context = vm.createContext({
      overlayWindow: null, currentArena: { players: Array(24).fill({}) },
      keyboardHook: null, hookListenersInstalled: false, hotkeyDown: false, activeHotkeyKeycode: null,
      BrowserWindow: Window, path, __dirname,
      screen: { getCursorScreenPoint: () => cursor, getDisplayNearestPoint: point => { assert.equal(point, cursor); return { bounds }; } },
      loadConfig: () => config, loadRenderer: async () => {}, sendAll: () => {}, resolveHotkeyCode,
      rosterBroadcaster: { send: () => {} },
      require: name => { assert.equal(name, "uiohook-napi"); return { uIOhook: hook, UiohookKey: { Tab: 15 } }; },
    });
    vm.runInContext(source.slice(source.indexOf("function getOverlayBounds()"), source.indexOf("async function handleArena(")), context);
    context.createOverlayWindow();
    return { context, hook, config, moveDisplay: value => { bounds = value; } };
  }

  test("overlay centers a bounded panel on the selected display without taking focus", () => {
    const { context, hook } = setup();
    hook.emit("keydown", { keycode: 15 });
    assert.deepEqual({ ...context.overlayWindow.bounds }, { x: -1241, y: 36, width: 1203, height: 648 });
    assert.equal(context.overlayWindow.options.focusable, false);
    assert.equal(context.overlayWindow.options.transparent, true);
    assert.equal(context.overlayWindow.ignoreMouse, true);
    assert.equal(context.overlayWindow.showCalls, 1);
    assert.equal(context.overlayWindow.visible, true);
    hook.emit("keyup", { keycode: 16 });
    assert.equal(context.overlayWindow.visible, true);
    hook.emit("keyup", { keycode: 15 });
    assert.equal(context.overlayWindow.visible, false);
  });

  test("operation overlay accepts map clicks and restores click-through on the next ordinary battle", () => {
    const { context } = setup({ overlayBattleMode: "operations" });
    assert.equal(context.overlayWindow.ignoreMouse, false);
    context.loadConfig = () => ({ overlayEnabled: true, overlayHotkeyEnabled: true, overlayHotkey: "Tab", overlayBattleMode: "random" });
    context.createOverlayWindow();
    assert.equal(context.overlayWindow.ignoreMouse, true);
    context.currentArena.isOperation = true;
    context.createOverlayWindow();
    assert.equal(context.overlayWindow.ignoreMouse, false);
  });

  test("next key press updates display bounds after monitor or DPI changes and ignores repeated presses", () => {
    const { context, hook, moveDisplay } = setup();
    hook.emit("keydown", { keycode: 15 });
    hook.emit("keydown", { keycode: 15 });
    assert.equal(context.overlayWindow.showCalls, 1);
    hook.emit("keyup", { keycode: 15 });
    const next = { x: 0, y: -720, width: 1707, height: 960 };
    moveDisplay(next);
    hook.emit("keydown", { keycode: 15 });
    const panel = context.overlayWindow.bounds;
    assert.ok(panel.x > next.x && panel.y > next.y);
    assert.ok(panel.x + panel.width < next.x + next.width);
    assert.ok(panel.y + panel.height < next.y + next.height);
    assert.equal(panel.width, 1440);
    assert.equal(panel.height, 860);
    assert.equal(context.overlayWindow.showCalls, 2);
  });

  test("disabled overlay and ended battles stay hidden", () => {
    const { context, hook, config } = setup();
    config.overlayEnabled = false;
    hook.emit("keydown", { keycode: 15 });
    assert.equal(context.overlayWindow.visible, false);
    config.overlayEnabled = true;
    context.currentArena = null;
    context.setOverlayVisible(true);
    assert.equal(context.overlayWindow.visible, false);
  });

  test("disabled overlay is not created until enabled during a battle", () => {
    const { context, config } = setup({ overlayEnabled: false });
    assert.equal(context.overlayWindow, null);
    config.overlayEnabled = true;
    context.createOverlayWindow();
    assert.ok(context.overlayWindow);
    assert.equal(context.overlayWindow.options.webPreferences.backgroundThrottling, true);
  });
}
