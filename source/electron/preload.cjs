"use strict";

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("wws", {
  getConfig: () => ipcRenderer.invoke("config:get"),
  saveConfig: (config) => ipcRenderer.invoke("config:save", config),
  getArenaState: () => ipcRenderer.invoke("arena:get-state"),
  getWgAuthStatus: () => ipcRenderer.invoke("wg:auth-status"),
  loginWg: (realm) => ipcRenderer.invoke("wg:login", { realm }),
  getMyStats: () => ipcRenderer.invoke("wg:my-details"),
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
