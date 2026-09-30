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
function shipClassStats(ships, table = expected) {
  const classes = [
    { type: "Destroyer", code: "DD", label: "驱逐舰" },
    { type: "Battleship", code: "BB", label: "战列舰" },
    { type: "AirCarrier", code: "CV", label: "航空母舰" },
    { type: "Cruiser", code: "CL", label: "巡洋舰" },
    { type: "Submarine", code: "SS", label: "潜艇" },
  ];
  const valid = (ships || []).filter(s => [s.battles,s.wins,s.avgDamage,s.avgXp,s.avgFrags].every(Number.isFinite) && s.battles > 0 && s.wins >= 0 && s.wins <= s.battles && s.avgDamage >= 0 && s.avgXp >= 0 && s.avgFrags >= 0);
  if (valid.some(s => !classes.some(c => c.type === s.type))) classes.push({ type: "Unknown", code: "—", label: "未分类" });
  return classes.map(c => {
    const group = valid.filter(s => c.type === "Unknown" ? !classes.slice(0,5).some(item => item.type === s.type) : s.type === c.type);
    const battles = group.reduce((n,s)=>n+s.battles,0), wins = group.reduce((n,s)=>n+s.wins,0);
    const average = key => battles ? group.reduce((n,s)=>n+s[key]*s.battles,0)/battles : null;
    const pr = aggregateRating(group,table);
    return { ...c, shipCount: group.length, battles, wins, winRate: battles ? wins/battles*100 : null,
      avgDamage: average("avgDamage"), avgXp: average("avgXp"), avgFrags: average("avgFrags"),
      pr: ratingValue(pr), prCoverage: pr && pr.totalBattles > 0 ? pr.coveredBattles/pr.totalBattles : null };
  });
}
module.exports = { ratingValue, aggregateRating, shipClassStats };
