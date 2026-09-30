import type { PrAggregate, StatsSnapshot } from "./types";
export type TrendMetric = "winRate" | "avgDamage" | "avgXp" | "avgFrags" | "pr";
export type TrendMode = "cumulative" | "interval";
export interface TrendPoint { capturedAt: number; battles: number; values: Record<TrendMetric, number | null> | null; from: number | null; prCoverage: number | null; prVersion: string | null; }
const totals = ["battles", "wins", "damageDealt", "xp", "frags", "survivedBattles"] as const;
export function ratingValue(a?: PrAggregate | null): number | null {
  if (!a || ![a.damage,a.frags,a.wins,a.expectedDamage,a.expectedFrags,a.expectedWins].every(Number.isFinite) || [a.damage,a.frags,a.wins].some(v=>v<0) || [a.expectedDamage,a.expectedFrags,a.expectedWins].some(v=>v<=0)) return null;
  return 700*Math.max(0,(a.damage/a.expectedDamage-.4)/.6)+300*Math.max(0,(a.frags/a.expectedFrags-.1)/.9)+150*Math.max(0,(a.wins/a.expectedWins-.7)/.3);
}
function values(s: StatsSnapshot) { return { pr: ratingValue(s.pr), winRate: s.wins / s.battles * 100, avgDamage: s.damageDealt / s.battles, avgXp: s.xp / s.battles, avgFrags: s.frags / s.battles }; }
export function dailySnapshots(history: StatsSnapshot[]) {
  const days = new Map<string, StatsSnapshot>();
  for (const s of [...history].filter(s => s && Number.isFinite(s.capturedAt) && s.capturedAt > 0 && totals.every(k => Number.isFinite(s[k]) && s[k] >= 0) && s.wins <= s.battles).sort((a,b) => a.capturedAt - b.capturedAt)) {
    const d = new Date(s.capturedAt);
    days.set([d.getFullYear(), d.getMonth(), d.getDate()].join("-"), s);
  }
  return [...days.values()];
}
export function trendPoints(history: StatsSnapshot[], mode: TrendMode, now = Date.now()): TrendPoint[] {
  const daily = dailySnapshots(history);
  return daily.map((s, i): TrendPoint => {
    const prior = daily[i - 1];
    if (mode === "cumulative") return { capturedAt: s.capturedAt, battles: s.battles, values: s.battles > 0 ? values(s) : null, from: null, prCoverage: s.pr && s.pr.totalBattles > 0 ? s.pr.coveredBattles / s.pr.totalBattles : null, prVersion: s.pr?.version ?? null };
    if (!prior || totals.some(k => s[k] < prior[k]) || s.battles === prior.battles) return { capturedAt: s.capturedAt, battles: 0, values: null, from: prior?.capturedAt ?? null, prCoverage: null, prVersion: null };
    const diff = { ...s, ...Object.fromEntries(totals.map(k => [k, s[k] - prior[k]])) } as StatsSnapshot;
    diff.pr = null;
    if (s.pr && prior.pr && s.pr.version === prior.pr.version) {
      const keys = ["coveredBattles", "totalBattles", "damage", "frags", "wins", "expectedDamage", "expectedFrags", "expectedWins"] as const;
      const delta = { version: s.pr.version, ...Object.fromEntries(keys.map(k => [k, s.pr![k]-prior.pr![k]])) } as PrAggregate;
      if (keys.every(k => Number.isFinite(delta[k]) && delta[k]>=0) && delta.coveredBattles>0 && delta.coveredBattles<=delta.totalBattles && delta.wins<=delta.coveredBattles) diff.pr = delta;
    }
    return { capturedAt: s.capturedAt, battles: diff.battles, values: diff.wins <= diff.battles ? values(diff) : null, from: prior.capturedAt, prCoverage: diff.pr && diff.pr.totalBattles>0 ? diff.pr.coveredBattles/diff.pr.totalBattles : null, prVersion: diff.pr?.version ?? null };
  }).filter(p => p.capturedAt <= now);
}
