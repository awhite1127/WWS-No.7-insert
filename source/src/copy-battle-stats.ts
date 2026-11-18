import type { OverallStats, ShipStats } from "./types";

export function copyBattleStats(name: string, overall?: OverallStats | null, ship?: ShipStats | null) {
  const percent = (value?: number) => value == null ? "—" : `${value.toFixed(2)}%`;
  const number = (value?: number) => value == null ? "—" : String(Math.round(value));
  return navigator.clipboard.writeText([
    name,
    percent(overall?.winRate),
    number(overall?.avgXp),
    percent(ship?.winRate),
    number(ship?.avgDamage),
  ].join(" + "));
}
