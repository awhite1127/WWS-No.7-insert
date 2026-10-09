"use strict";

function isBotPlayer(player) {
  if (!player || typeof player !== "object") return false;
  const flagged = [player.isBot, player.is_bot, player.bot]
    .some(value => value === true || value === 1 || value === "true");
  return flagged || /^:[^:]+:$/.test(String(player.name || player.nickname || "").trim());
}

module.exports = { isBotPlayer };
