import type { RosterPlayer } from "./types";

export type TeamWinRate = { value: number | null; available: number; total: number };

export function summarizeBattleTeams(players: Pick<RosterPlayer, "side" | "status" | "overall">[]) {
  const summarize = (side: RosterPlayer["side"]): TeamWinRate => {
    const team = players.filter((player) => player.side === side && player.status !== "bot");
    const publicStats = team.filter((player) => player.status === "ok"
      && Number.isFinite(player.overall?.winRate) && Number(player.overall?.battles) > 0);
    return {
      value: publicStats.length
        ? publicStats.reduce((sum, player) => sum + Number(player.overall!.winRate), 0) / publicStats.length
        : null,
      available: publicStats.length,
      total: team.length,
    };
  };
  return { ally: summarize("ally"), enemy: summarize("enemy") };
}
