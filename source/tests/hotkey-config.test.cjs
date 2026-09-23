"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
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
