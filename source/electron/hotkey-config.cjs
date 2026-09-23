"use strict";

const NAMED_HOTKEYS = new Set([
  "Tab", "CapsLock", "Space", "Backquote", "Minus", "Equal",
  "BracketLeft", "BracketRight", "Backslash", "Semicolon", "Quote",
  "Comma", "Period", "Slash",
]);

function normalizeHotkey(value) {
  if (typeof value !== "string") return "Tab";
  if (/^Key[A-Z]$/.test(value)) return value;
  if (/^Digit[0-9]$/.test(value)) return value;
  if (/^F(?:[1-9]|1[0-2])$/.test(value)) return value;
  return NAMED_HOTKEYS.has(value) ? value : "Tab";
}

function resolveHotkeyCode(value, UiohookKey) {
  const hotkey = normalizeHotkey(value);
  if (hotkey.startsWith("Key")) return UiohookKey[hotkey.slice(3)];
  if (hotkey.startsWith("Digit")) return UiohookKey[hotkey.slice(5)];
  return UiohookKey[hotkey];
}

module.exports = { normalizeHotkey, resolveHotkeyCode };
