"use strict";

const fs = require("node:fs");

function firstValue(object, keys) {
  for (const key of keys) {
    const value = object?.[key];
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return undefined;
}

function normalizePlayer(raw, index = 0) {
  if (!raw || typeof raw !== "object") return null;
  const name = firstValue(raw, [
    "name",
    "nickname",
    "playerName",
    "player_name",
    "accountName",
    "account_name",
  ]);
  if (typeof name !== "string" || name.trim().length === 0) return null;

  const relation = Number(firstValue(raw, ["relation", "team", "teamId", "team_id"]));
  const side = relation === 2 || relation === -1 || String(relation) === "2" ? "enemy" : "ally";
  const shipId = Number(firstValue(raw, ["shipId", "ship_id", "vehicleId", "vehicle_id"]));
  const accountId = Number(firstValue(raw, ["accountId", "account_id", "accountDBID", "account_db_id", "dbId", "db_id"]));
  return {
    key: String(firstValue(raw, ["id", "accountId", "account_id"]) ?? `${side}-${index}-${name}`),
    name: name.trim(),
    side,
    relation: Number.isFinite(relation) ? relation : null,
    accountId: Number.isSafeInteger(accountId) && accountId > 0 ? accountId : null,
    shipId: Number.isFinite(shipId) && shipId > 0 ? shipId : null,
    shipName: String(firstValue(raw, ["shipName", "ship_name", "vehicleName", "vehicle_name"]) ?? ""),
    shipType: String(firstValue(raw, ["shipType", "ship_type", "vehicleType", "vehicle_type"]) ?? ""),
  };
}

function findCandidateArrays(value, results = [], depth = 0) {
  if (depth > 7 || value == null) return results;
  if (Array.isArray(value)) {
    const normalized = value.map(normalizePlayer).filter(Boolean);
    if (normalized.length > 0) results.push(normalized);
    for (const entry of value) findCandidateArrays(entry, results, depth + 1);
    return results;
  }
  if (typeof value === "object") {
    for (const child of Object.values(value)) findCandidateArrays(child, results, depth + 1);
  }
  return results;
}

function parseArenaData(raw) {
  const candidates = [];
  for (const key of ["vehicles", "players", "members", "teamMembers", "participants"]) {
    if (Array.isArray(raw?.[key])) {
      const normalized = raw[key].map(normalizePlayer).filter(Boolean);
      if (normalized.length > 0) candidates.push(normalized);
    }
  }
  if (candidates.length === 0) findCandidateArrays(raw, candidates);
  const players = (candidates.sort((a, b) => b.length - a.length)[0] ?? []).filter(
    (player, index, list) => list.findIndex((candidate) => candidate.name === player.name) === index,
  );
  if (players.length === 0) throw new Error("未在 JSON 中找到玩家名单");
  return {
    battleId: String(firstValue(raw, ["arenaId", "arena_id", "battleId", "battle_id"]) ?? ""),
    mapName: String(firstValue(raw, ["mapDisplayName", "mapName", "map_name"]) ?? ""),
    gameMode: String(firstValue(raw, ["gameLogic", "gameMode", "game_mode"]) ?? ""),
    updatedAt: Date.now(),
    players,
  };
}

function parseArenaFile(filePath) {
  const source = fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
  return parseArenaData(JSON.parse(source));
}

module.exports = { normalizePlayer, parseArenaData, parseArenaFile };
