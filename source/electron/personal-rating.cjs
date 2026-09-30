"use strict";
const expected = require("../data/pr-expected.json");
function ratingValue(a) {
  if (!a || ![a.damage, a.frags, a.wins, a.expectedDamage, a.expectedFrags, a.expectedWins].every(Number.isFinite) || [a.damage,a.frags,a.wins].some(v=>v<0) || [a.expectedDamage,a.expectedFrags,a.expectedWins].some(v=>v<=0)) return null;
  return 700 * Math.max(0,(a.damage/a.expectedDamage-.4)/.6) + 300 * Math.max(0,(a.frags/a.expectedFrags-.1)/.9) + 150 * Math.max(0,(a.wins/a.expectedWins-.7)/.3);
}
function aggregateRating(ships, table = expected) {
  const a = { version: table.version, coveredBattles: 0, totalBattles: 0, damage: 0, frags: 0, wins: 0, expectedDamage: 0, expectedFrags: 0, expectedWins: 0 };
  for (const s of ships || []) {
    if (!Number.isFinite(s.battles) || s.battles<=0) continue;
    a.totalBattles += s.battles;
    const e = table.data[String(s.shipId)];
    if (!e || ![s.avgDamage,s.avgFrags,s.wins,e.average_damage_dealt,e.average_frags,e.win_rate].every(Number.isFinite) || s.avgDamage<0 || s.avgFrags<0 || s.wins<0 || s.wins>s.battles || e.average_damage_dealt<=0 || e.average_frags<=0 || e.win_rate<=0) continue;
    a.coveredBattles+=s.battles; a.damage+=s.avgDamage*s.battles; a.frags+=s.avgFrags*s.battles; a.wins+=s.wins;
    a.expectedDamage+=e.average_damage_dealt*s.battles; a.expectedFrags+=e.average_frags*s.battles; a.expectedWins+=e.win_rate/100*s.battles;
  }
  return ratingValue(a) === null ? null : a;
}
module.exports = { ratingValue, aggregateRating };
