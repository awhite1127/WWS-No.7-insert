"use strict";

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("wws", {
  getNews: (force) => ipcRenderer.invoke("news:get", Boolean(force)),
  getNewsDetail: (url) => ipcRenderer.invoke("news:detail", url),
  openNewsSource: (url) => ipcRenderer.invoke("news:open", url),
  getConfig: () => ipcRenderer.invoke("config:get"),
  saveConfig: (config) => ipcRenderer.invoke("config:save", config),
  checkForUpdate: () => ipcRenderer.invoke("update:check"),
  downloadUpdate: () => ipcRenderer.invoke("update:download"),
  showUpdateFile: () => ipcRenderer.invoke("update:show-file"),
  installUpdate: () => ipcRenderer.invoke("update:install"),
  openUpdateRelease: () => ipcRenderer.invoke("update:open-release"),
  onUpdateProgress: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on("update:progress", listener);
    return () => ipcRenderer.removeListener("update:progress", listener);
  },
  getArenaState: () => ipcRenderer.invoke("arena:get-state"),
  listContainers: (realm) => ipcRenderer.invoke("containers:list", { realm }),
  containerDetails: (id, realm) => ipcRenderer.invoke("containers:details", { id, realm }),
  openContainerSource: (realm) => ipcRenderer.invoke("containers:open-source", { realm }),
  getWgAuthStatus: () => ipcRenderer.invoke("wg:auth-status"),
  loginWg: (realm) => ipcRenderer.invoke("wg:login", { realm }),
  getMyStats: () => ipcRenderer.invoke("wg:my-details"),
  getChristmasPortShips: () => ipcRenderer.invoke("christmas:port-ships"),
  openChristmasSource: (year) => ipcRenderer.invoke("christmas:open-source", { year }),
  getSnowflakeStatus: () => ipcRenderer.invoke("snowflake:get"),
  loginSnowflake: (realm) => ipcRenderer.invoke("snowflake:login", { realm }),
  refreshSnowflake: () => ipcRenderer.invoke("snowflake:refresh"),
  logoutSnowflake: () => ipcRenderer.invoke("snowflake:logout"),
  searchPlayers: (query, realm) => ipcRenderer.invoke("wg:search", { query, realm }),
  playerDetails: (accountId, realm) => ipcRenderer.invoke("wg:details", { accountId, realm }),
  searchClans: (query, realm) => ipcRenderer.invoke("wg:clan-search", { query, realm }),
  clanDetails: (clanId, realm) => ipcRenderer.invoke("wg:clan-details", { clanId, realm }),
  chooseGameDirectory: () => ipcRenderer.invoke("arena:choose-game-directory"),
  startArenaWatch: (gamePath) => ipcRenderer.invoke("arena:start", { gamePath }),
  stopArenaWatch: () => ipcRenderer.invoke("arena:stop"),
  simulateArena: () => ipcRenderer.invoke("arena:simulate"),
  refreshRoster: () => ipcRenderer.invoke("arena:refresh-roster"),
  setOverlayVisible: (visible) => ipcRenderer.invoke("overlay:visible", { visible }),
  minimizeWindow: () => ipcRenderer.invoke("window:minimize"),
  toggleMaximizeWindow: () => ipcRenderer.invoke("window:toggle-maximize"),
  isWindowMaximized: () => ipcRenderer.invoke("window:is-maximized"),
  closeWindow: () => ipcRenderer.invoke("window:close"),
  onWindowMaximized: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on("window:maximized", listener);
    return () => ipcRenderer.removeListener("window:maximized", listener);
  },
  onArenaUpdate: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on("arena:update", listener);
    return () => ipcRenderer.removeListener("arena:update", listener);
  },
  onRosterStats: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on("roster:stats", listener);
    return () => ipcRenderer.removeListener("roster:stats", listener);
  },
  onOverlayStatus: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on("overlay:status", listener);
    return () => ipcRenderer.removeListener("overlay:status", listener);
  },
});
