"use strict";

const PERIODS = [1, 7, 30, 90];
const DAY_MS = 24 * 60 * 60 * 1000;

function makeSnapshot(player, capturedAt = Date.now()) {
  const totals = player?.cumulative;
  if (!totals || !Number.isFinite(totals.battles)) return null;
  return {
    capturedAt,
    battles: Number(totals.battles) || 0,
    wins: Number(totals.wins) || 0,
    damageDealt: Number(totals.damageDealt) || 0,
    xp: Number(totals.xp) || 0,
    frags: Number(totals.frags) || 0,
    survivedBattles: Number(totals.survivedBattles) || 0,
  };
}

function recentFromSnapshots(current, snapshots) {
  const valid = (Array.isArray(snapshots) ? snapshots : [])
    .filter((item) => item && Number.isFinite(item.capturedAt) && item.capturedAt < current.capturedAt)
    .sort((a, b) => a.capturedAt - b.capturedAt);
  const trackedSince = valid[0]?.capturedAt ?? current.capturedAt;
  const periods = PERIODS.map((days) => {
    const target = current.capturedAt - days * DAY_MS;
    const baseline = valid.reduce((best, item) => (
      !best || Math.abs(item.capturedAt - target) < Math.abs(best.capturedAt - target) ? item : best
    ), null);
    const actualDays = baseline ? (current.capturedAt - baseline.capturedAt) / DAY_MS : 0;
    const available = Boolean(baseline && actualDays >= days * 0.8);
    if (!available) return { days, available: false, actualDays };

    const battles = current.battles - baseline.battles;
    const wins = current.wins - baseline.wins;
    const damage = current.damageDealt - baseline.damageDealt;
    const xp = current.xp - baseline.xp;
    const frags = current.frags - baseline.frags;
    const survived = current.survivedBattles - baseline.survivedBattles;
    if ([battles, wins, damage, xp, frags, survived].some((value) => value < 0)) {
      return { days, available: false, actualDays };
    }
    return {
      days,
      available: true,
      actualDays,
      battles,
      wins,
      winRate: battles > 0 ? (wins / battles) * 100 : 0,
      avgDamage: battles > 0 ? damage / battles : 0,
      avgXp: battles > 0 ? xp / battles : 0,
      avgFrags: battles > 0 ? frags / battles : 0,
      survivalRate: battles > 0 ? (survived / battles) * 100 : 0,
    };
  });
  return { trackedSince, periods };
}

function mergeSnapshot(snapshots, current) {
  const result = (Array.isArray(snapshots) ? snapshots : [])
    .filter((item) => item && Number.isFinite(item.capturedAt) && item.capturedAt >= current.capturedAt - 180 * DAY_MS)
    .sort((a, b) => a.capturedAt - b.capturedAt);
  const last = result[result.length - 1];
  if (last && current.capturedAt - last.capturedAt < 30 * 60 * 1000) result[result.length - 1] = current;
  else result.push(current);
  return result.slice(-1000);
}

module.exports = { DAY_MS, PERIODS, makeSnapshot, mergeSnapshot, recentFromSnapshots };
