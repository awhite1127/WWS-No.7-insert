"use strict";
const { operations } = require("../data/operations.json");
const normalize = value => String(value || "").trim().toLowerCase().replace(/\\/g, "/").replace(/^.*\//, "").replace(/\.\w+$/, "").replace(/[\s_-]/g, "");

// Aegis shares Mountain Range with ordinary battles: its map alone is insufficient.
function detectOperation({ mapId, mapName, gameMode, matchGroup, scenario }) {
  const mode = normalize(gameMode), group = normalize(matchGroup);
  const explicit = ["scenario", "scenarios", "operation", "operations"].includes(mode)
    || ["pve", "pvepremade", "operations", "scenario"].includes(group);
  const scenarioKey = normalize(scenario);
  const mapKeys = [mapId, mapName].map(normalize).filter(Boolean);
  const operation = operations.find(op => op.aliases.some(alias => normalize(alias) === scenarioKey)
    || op.maps.some(map => mapKeys.includes(normalize(map)) && (op.id !== "aegis" || explicit))
    || op.aliases.some(alias => mapKeys.includes(normalize(alias))));
  return { isOperation: explicit || Boolean(operation), operationId: operation?.id || "" };
}
module.exports = { detectOperation };
