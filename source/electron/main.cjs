"use strict";

const path = require("node:path");
const fs = require("node:fs");
const http = require("node:http");
const { app, BrowserWindow, dialog, ipcMain, Menu, safeStorage, screen, shell } = require("electron");
const envPath = app.isPackaged
  ? path.join(process.resourcesPath, ".env.local")
  : path.join(__dirname, "..", ".env.local");
require("dotenv").config({ path: envPath, quiet: true });

const { WgApi } = require("./wg-api.cjs");
const { ArenaWatcher } = require("./arena-watcher.cjs");
const { parseArenaData } = require("./arena-parser.cjs");
const { normalizeHotkey, resolveHotkeyCode } = require("./hotkey-config.cjs");
const { makeSnapshot, mergeSnapshot, recentFromSnapshots } = require("./stats-history.cjs");

let mainWindow = null;
let overlayWindow = null;
let currentArena = null;
let currentRoster = [];
let rosterRequestId = 0;
let hotkeyDown = false;
let activeHotkeyKeycode = null;
let keyboardHook = null;
const watcher = new ArenaWatcher();
let activeAuthServer = null;

const AUTH_HOSTS = {
  asia: "api.worldoftanks.asia",
  eu: "api.worldoftanks.eu",
  na: "api.worldoftanks.com",
};

function configPath() {
  return path.join(app.getPath("userData"), "config.json");
}

function authPath() {
  return path.join(app.getPath("userData"), "wg-auth.json");
}

function statsHistoryPath(player) {
  return path.join(app.getPath("userData"), "stats-history", `${player.realm}-${player.accountId}.json`);
}

function attachRecentStats(player) {
  const current = makeSnapshot(player);
  if (!current) return { ...player, recent: null };
  const filePath = statsHistoryPath(player);
  let snapshots = [];
  try {
    const stored = JSON.parse(fs.readFileSync(filePath, "utf8"));
    snapshots = Array.isArray(stored?.snapshots) ? stored.snapshots : [];
  } catch {}
  const recent = recentFromSnapshots(current, snapshots);
  const nextSnapshots = mergeSnapshot(snapshots, current);
  try {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify({ version: 1, accountId: player.accountId, realm: player.realm, snapshots: nextSnapshots }, null, 2), "utf8");
  } catch (error) {
    recent.storageError = error instanceof Error ? error.message : String(error);
  }
  return { ...player, recent };
}

function loadAuth() {
  try {
    const saved = JSON.parse(fs.readFileSync(authPath(), "utf8"));
    if (!safeStorage.isEncryptionAvailable() || !saved.encryptedToken) return null;
    if (!Number.isFinite(Number(saved.expiresAt)) || Number(saved.expiresAt) * 1000 <= Date.now()) {
      try { fs.unlinkSync(authPath()); } catch {}
      return null;
    }
    return {
      realm: saved.realm,
      accountId: Number(saved.accountId),
      nickname: saved.nickname,
      expiresAt: Number(saved.expiresAt),
      accessToken: safeStorage.decryptString(Buffer.from(saved.encryptedToken, "base64")),
    };
  } catch {
    return null;
  }
}

function wgAuthStatus() {
  const auth = loadAuth();
  if (!auth) return { authorized: false };
  return {
    authorized: true,
    accountId: auth.accountId,
    nickname: auth.nickname,
    realm: auth.realm,
    expiresAt: auth.expiresAt,
  };
}

function saveAuth(auth) {
  if (!safeStorage.isEncryptionAvailable()) throw new Error("系统安全存储不可用，无法保存 WG 授权");
  const saved = {
    realm: auth.realm,
    accountId: Number(auth.accountId),
    nickname: auth.nickname,
    expiresAt: Number(auth.expiresAt),
    encryptedToken: safeStorage.encryptString(auth.accessToken).toString("base64"),
  };
  fs.mkdirSync(path.dirname(authPath()), { recursive: true });
  fs.writeFileSync(authPath(), JSON.stringify(saved, null, 2), "utf8");
}

async function wgAuthRequest(realm, method, params = {}) {
  const applicationId = loadConfig().applicationId;
  const host = AUTH_HOSTS[realm];
  if (!applicationId) throw new Error("WG 服务尚未完成配置，请联系管理员");
  if (!host) throw new Error("不支持的 WG 区服");
  const query = new URLSearchParams({ application_id: applicationId, ...params });
  const usesPost = method === "prolongate" || method === "logout";
  const response = await fetch(
    usesPost ? `https://${host}/wot/auth/${method}/` : `https://${host}/wot/auth/${method}/?${query}`,
    {
      method: usesPost ? "POST" : "GET",
      headers: {
        "User-Agent": "No7Insert/0.1.1",
        ...(usesPost ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
      },
      ...(usesPost ? { body: query } : {}),
    },
  );
  if (!response.ok) throw new Error(`WG 授权服务 HTTP ${response.status}`);
  const body = await response.json();
  if (body.status !== "ok") throw new Error(body.error?.message || "WG 授权失败");
  return body.data;
}

async function snowflakeStatus() {
  const auth = loadAuth();
  if (!auth) return { authorized: false };
  const base = {
    authorized: true,
    accountId: auth.accountId,
    nickname: auth.nickname,
    realm: auth.realm,
    expiresAt: auth.expiresAt,
  };
  try {
    return { ...base, summary: await wg.snowflakeSummary(auth.accountId, auth.nickname, auth.accessToken, auth.realm) };
  } catch (error) {
    return { ...base, error: error instanceof Error ? error.message : String(error) };
  }
}

async function loginWg(realm) {
  if (activeAuthServer) throw new Error("WG 授权窗口已经打开");
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (error, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (activeAuthServer) activeAuthServer.close();
      activeAuthServer = null;
      if (error) reject(error);
      else resolve(value);
    };
    const server = http.createServer(async (request, response) => {
      try {
        const callback = new URL(request.url, "http://127.0.0.1");
        if (callback.pathname.replace(/\/+$/, "") !== "/wg-callback") {
          response.writeHead(404).end();
          return;
        }
        if (callback.searchParams.get("status") !== "ok") {
          throw new Error(callback.searchParams.get("message") || "用户取消了 WG 授权");
        }
        const receivedToken = callback.searchParams.get("access_token");
        if (!receivedToken) throw new Error("WG 授权未返回访问令牌");
        const verified = await wgAuthRequest(realm, "prolongate", { access_token: receivedToken });
        const auth = {
          realm,
          accountId: Number(verified.account_id),
          nickname: callback.searchParams.get("nickname") || `UID ${verified.account_id}`,
          expiresAt: Number(verified.expires_at),
          accessToken: verified.access_token,
        };
        saveAuth(auth);
        response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        response.end("<!doctype html><meta charset='utf-8'><title>授权成功</title><style>body{font-family:system-ui;background:#07151d;color:#d9eff0;display:grid;place-items:center;height:100vh;margin:0}main{text-align:center}p{color:#78919d}</style><main><h1>WG 账号授权成功</h1><p>可以关闭此页面并返回 No. 7 insert。</p></main>");
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.show();
          mainWindow.focus();
        }
        finish(null, wgAuthStatus());
      } catch (error) {
        response.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
        response.end(error instanceof Error ? error.message : String(error));
        finish(error);
      }
    });
    activeAuthServer = server;
    const timeout = setTimeout(() => finish(new Error("WG 授权等待超时，请重试")), 5 * 60 * 1000);
    server.listen(0, "127.0.0.1", async () => {
      try {
        const address = server.address();
        const redirectUri = `http://127.0.0.1:${address.port}/wg-callback`;
        const data = await wgAuthRequest(realm, "login", {
          redirect_uri: redirectUri,
          nofollow: "1",
          expires_at: String(14 * 24 * 60 * 60),
        });
        await shell.openExternal(data.location);
      } catch (error) {
        finish(error);
      }
    });
  });
}

function loadConfig() {
  let saved = {};
  try {
    saved = JSON.parse(fs.readFileSync(configPath(), "utf8"));
  } catch {}
  let gamePath = saved.gamePath || saved.arenaPath || "";
  if (path.extname(gamePath).toLowerCase() === ".json") {
    const parentPath = path.dirname(gamePath);
    gamePath = path.basename(parentPath).toLowerCase() === "replays" ? path.dirname(parentPath) : parentPath;
  }
  return {
    applicationId: saved.applicationId || process.env.WWSMONKEY_WG_APPLICATION_ID || "",
    realm: saved.realm || "asia",
    theme: saved.theme === "light" ? "light" : "dark",
    gamePath,
    overlayEnabled: saved.overlayEnabled !== false,
    overlayHotkey: normalizeHotkey(saved.overlayHotkey),
  };
}

function publicConfig(config) {
  return {
    realm: config.realm,
    theme: config.theme,
    gamePath: config.gamePath,
    overlayEnabled: config.overlayEnabled,
    overlayHotkey: config.overlayHotkey,
  };
}

function saveConfig(next) {
  const current = loadConfig();
  const validRealms = new Set(["asia", "eu", "na"]);
  const merged = {
    ...current,
    realm: validRealms.has(next?.realm) ? next.realm : current.realm,
    theme: next?.theme === "light" || next?.theme === "dark" ? next.theme : current.theme,
    gamePath: typeof next?.gamePath === "string" ? next.gamePath : current.gamePath,
    overlayEnabled: typeof next?.overlayEnabled === "boolean" ? next.overlayEnabled : current.overlayEnabled,
    overlayHotkey: typeof next?.overlayHotkey === "string" ? normalizeHotkey(next.overlayHotkey) : current.overlayHotkey,
  };
  fs.mkdirSync(path.dirname(configPath()), { recursive: true });
  fs.writeFileSync(configPath(), JSON.stringify(merged, null, 2), "utf8");
  return publicConfig(merged);
}

const wg = new WgApi(() => loadConfig().applicationId);

function sendAll(channel, payload) {
  for (const window of [mainWindow, overlayWindow]) {
    if (window && !window.isDestroyed()) window.webContents.send(channel, payload);
  }
}

async function loadRenderer(window, overlay = false) {
  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) {
    await window.loadURL(overlay ? `${devUrl}?overlay=1` : devUrl);
  } else {
    await window.loadFile(path.join(__dirname, "..", "dist", "index.html"), {
      query: overlay ? { overlay: "1" } : {},
    });
  }
}

function createWindows() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 980,
    minHeight: 680,
    backgroundColor: "#071018",
    title: "No. 7 insert",
    frame: false,
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
    },
  });
  Menu.setApplicationMenu(null);
  mainWindow.once("ready-to-show", () => mainWindow.show());
  mainWindow.on("closed", () => {
    mainWindow = null;
    if (overlayWindow && !overlayWindow.isDestroyed()) overlayWindow.destroy();
  });
  const sendWindowState = () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("window:maximized", mainWindow.isMaximized());
    }
  };
  mainWindow.on("maximize", sendWindowState);
  mainWindow.on("unmaximize", sendWindowState);
  void loadRenderer(mainWindow, false);

  const display = screen.getPrimaryDisplay().workArea;
  overlayWindow = new BrowserWindow({
    x: Math.round(display.x + (display.width - Math.min(1180, display.width)) / 2),
    y: Math.round(display.y + display.height * 0.12),
    width: Math.min(1180, display.width),
    height: Math.min(720, Math.round(display.height * 0.76)),
    transparent: true,
    frame: false,
    show: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    focusable: false,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
    },
  });
  overlayWindow.setAlwaysOnTop(true, "screen-saver");
  overlayWindow.setIgnoreMouseEvents(true, { forward: true });
  void loadRenderer(overlayWindow, true);
}

function setOverlayVisible(visible) {
  if (!overlayWindow || overlayWindow.isDestroyed()) return;
  if (visible && loadConfig().overlayEnabled && currentArena) {
    overlayWindow.showInactive();
  } else {
    overlayWindow.hide();
  }
  sendAll("overlay:status", { visible: overlayWindow.isVisible(), keyboardHook: Boolean(keyboardHook) });
}

function startKeyboardHook() {
  try {
    const { uIOhook, UiohookKey } = require("uiohook-napi");
    uIOhook.on("keydown", (event) => {
      const configuredKeycode = resolveHotkeyCode(loadConfig().overlayHotkey, UiohookKey);
      if (event.keycode === configuredKeycode && !hotkeyDown) {
        hotkeyDown = true;
        activeHotkeyKeycode = configuredKeycode;
        setOverlayVisible(true);
      }
    });
    uIOhook.on("keyup", (event) => {
      if (hotkeyDown && event.keycode === activeHotkeyKeycode) {
        hotkeyDown = false;
        activeHotkeyKeycode = null;
        setOverlayVisible(false);
      }
    });
    uIOhook.start();
    keyboardHook = uIOhook;
  } catch (error) {
    sendAll("overlay:status", { visible: false, keyboardHook: false, error: error.message });
  }
}

async function handleArena(arena) {
  const requestId = ++rosterRequestId;
  currentArena = arena;
  currentRoster = arena.players.map((player) => {
    const previous = currentRoster.find((item) => item.key === player.key);
    return { ...player, shipType: previous?.shipType || player.shipType, shipTier: previous?.shipTier || player.shipTier, status: "loading" };
  });
  sendAll("arena:update", arena);
  sendAll("roster:stats", currentRoster);
  const result = await wg.rosterStats(arena.players, loadConfig().realm);
  if (requestId !== rosterRequestId) return;
  currentRoster = result;
  sendAll("roster:stats", currentRoster);
}

watcher.on("arena", (arena) => void handleArena(arena));
watcher.on("warning", (message) => sendAll("overlay:status", { warning: message }));
watcher.on("path", (watchedPath) => sendAll("overlay:status", { watchedPath }));

ipcMain.handle("config:get", () => publicConfig(loadConfig()));
ipcMain.handle("config:save", (_event, config) => saveConfig(config));
ipcMain.handle("arena:get-state", () => ({ arena: currentArena, roster: currentRoster, watchedPath: watcher.filePath }));
ipcMain.handle("arena:refresh-roster", async () => {
  if (!currentArena) throw new Error("尚未识别对局");
  if (currentArena.battleId === "mock-battle") {
    sendAll("roster:stats", currentRoster);
    return currentRoster;
  }
  await handleArena(currentArena);
  return currentRoster;
});
ipcMain.handle("wg:auth-status", () => wgAuthStatus());
ipcMain.handle("wg:login", (_event, { realm }) => loginWg(realm));
ipcMain.handle("wg:my-details", async () => {
  const auth = loadAuth();
  if (!auth) throw new Error("请先授权 WG 账号");
  return attachRecentStats(await wg.playerDetails(auth.accountId, auth.realm, auth.accessToken));
});
ipcMain.handle("snowflake:get", () => snowflakeStatus());
ipcMain.handle("snowflake:refresh", () => snowflakeStatus());
ipcMain.handle("snowflake:login", async (_event, { realm }) => {
  await loginWg(realm);
  return snowflakeStatus();
});
ipcMain.handle("snowflake:logout", async () => {
  const auth = loadAuth();
  if (auth) {
    try { await wgAuthRequest(auth.realm, "logout", { access_token: auth.accessToken }); } catch {}
  }
  try { fs.unlinkSync(authPath()); } catch {}
  return true;
});
ipcMain.handle("wg:search", (_event, { query, realm }) => wg.searchPlayers(query, realm));
ipcMain.handle("wg:details", async (_event, { accountId, realm }) => attachRecentStats(await wg.playerDetails(accountId, realm)));
ipcMain.handle("wg:clan-search", (_event, { query, realm }) => wg.searchClans(query, realm));
ipcMain.handle("wg:clan-details", (_event, { clanId, realm }) => wg.clanDetails(clanId, realm));
ipcMain.handle("arena:choose-game-directory", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: "选择《战舰世界》游戏安装目录",
    defaultPath: loadConfig().gamePath || undefined,
    buttonLabel: "选择文件夹",
    properties: ["openDirectory"],
  });
  return result.canceled ? "" : result.filePaths[0];
});
ipcMain.handle("arena:start", (_event, { gamePath }) => {
  rosterRequestId++;
  currentArena = null;
  currentRoster = [];
  sendAll("arena:update", null);
  sendAll("roster:stats", []);
  const watched = watcher.start(gamePath);
  saveConfig({ gamePath });
  return watched;
});
ipcMain.handle("arena:stop", () => {
  watcher.stop();
  return true;
});
ipcMain.handle("arena:simulate", async () => {
  rosterRequestId++;
  const ships = [
    ["Hakuryu", "AirCarrier"], ["Yamato", "Battleship"], ["Montana", "Battleship"],
    ["Bourgogne", "Battleship"], ["Ohio", "Battleship"], ["Venezia", "Cruiser"],
    ["Des Moines", "Cruiser"], ["Petropavlovsk", "Cruiser"], ["Minotaur", "Cruiser"],
    ["Moskva", "Cruiser"], ["Shimakaze", "Destroyer"], ["Harugumo", "Destroyer"],
  ];
  const sample = {
    arenaId: "mock-battle",
    mapDisplayName: "模拟海域",
    gameLogic: "Domination",
    vehicles: [1, 2].flatMap((relation) => ships.map(([shipName, shipType], index) => ({
      id: relation * 100 + index,
      name: (relation === 1 ? "FleetMate_" : "SeaRival_") + String(index + 1).padStart(2, "0"),
      relation, shipId: 4000000000 + index, shipName, shipType,
    }))),
  };
  const arena = parseArenaData(sample);
  currentArena = arena;
  currentRoster = arena.players.map((player, index) => ({
    ...player, status: "ok", shipTier: 10,
    overall: {
      battles: 1600 + index * 267, wins: 800 + index * 130,
      winRate: 43 + ((index * 7 + Math.floor(index / 12) * 4) % 21), avgDamage: 62000 + index * 1900,
      avgXp: 1180 + index * 28, avgFrags: 0.7, survivalRate: 40,
    },
    currentShip: {
      shipId: player.shipId, name: player.shipName, tier: 10, type: player.shipType,
      nation: "japan", battles: 42 + index * 13, wins: 20 + index * 6,
      winRate: 39 + (index * 9 % 25), avgDamage: 78000 + index * 1800,
      avgXp: 1250 + index * 32, avgFrags: 0.8,
    },
  }));
  sendAll("arena:update", arena);
  sendAll("roster:stats", currentRoster);
  return arena;
});
ipcMain.handle("overlay:visible", (_event, { visible }) => {
  setOverlayVisible(Boolean(visible));
  return true;
});
ipcMain.handle("window:minimize", (event) => {
  BrowserWindow.fromWebContents(event.sender)?.minimize();
  return true;
});
ipcMain.handle("window:toggle-maximize", (event) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  if (!window || window === overlayWindow) return false;
  if (window.isMaximized()) window.unmaximize();
  else window.maximize();
  return window.isMaximized();
});
ipcMain.handle("window:is-maximized", (event) => BrowserWindow.fromWebContents(event.sender)?.isMaximized() ?? false);
ipcMain.handle("window:close", (event) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  if (window && window !== overlayWindow) window.close();
  return true;
});

app.whenReady().then(() => {
  // Keep existing settings and local history when the visible product name changes.
  const userDataPath = path.join(app.getPath("appData"), "wwsmonkey");
  fs.mkdirSync(userDataPath, { recursive: true });
  app.setPath("userData", userDataPath);
  createWindows();
  startKeyboardHook();
  const config = loadConfig();
  if (config.gamePath) watcher.start(config.gamePath);
});

app.on("window-all-closed", () => {
  watcher.stop();
  if (activeAuthServer) activeAuthServer.close();
  if (keyboardHook) keyboardHook.stop();
  app.quit();
});
