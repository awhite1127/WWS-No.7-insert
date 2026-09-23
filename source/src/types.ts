export interface AppConfig {
  realm: "asia" | "eu" | "na";
  theme: "dark" | "light";
  gamePath: string;
  overlayEnabled: boolean;
  overlayHotkey: string;
}

export interface SearchResult {
  account_id: number;
  nickname: string;
}

export interface ClanSearchResult {
  clan_id: number;
  tag: string;
  name: string;
  members_count: number;
}

export interface ClanDetails {
  clanId: number;
  tag: string;
  name: string;
  description: string;
  createdAt: number | null;
  creatorName: string;
  leaderName: string;
  membersCount: number;
  members: Array<{
    accountId: number;
    accountName: string;
    joinedAt: number | null;
    role: string;
  }>;
}

export interface OverallStats {
  battles: number;
  wins: number;
  winRate: number;
  avgDamage: number;
  avgXp: number;
  avgFrags: number;
  survivalRate: number;
}

export interface ShipStats {
  shipId: number;
  name: string;
  tier: number;
  type: string;
  nation: string;
  battles: number;
  wins: number;
  winRate: number;
  avgDamage: number;
  avgXp: number;
  avgFrags: number;
}

export interface RankedSeason {
  seasonId: number;
  battles: number;
  wins: number;
  winRate: number;
  avgDamage: number;
}

export interface PlayerDetails {
  accountId: number;
  nickname: string;
  realm: string;
  hiddenProfile: boolean;
  createdAt: number | null;
  lastBattleTime: number | null;
  clan: { id: number; tag: string; name: string } | null;
  overall: OverallStats | null;
  cumulative?: {
    battles: number;
    wins: number;
    damageDealt: number;
    xp: number;
    frags: number;
    survivedBattles: number;
  } | null;
  recent?: {
    trackedSince: number;
    storageError?: string;
    periods: Array<{
      days: 1 | 7 | 30 | 90;
      available: boolean;
      actualDays: number;
      battles?: number;
      wins?: number;
      winRate?: number;
      avgDamage?: number;
      avgXp?: number;
      avgFrags?: number;
      survivalRate?: number;
    }>;
  } | null;
  ships: ShipStats[];
  ranked: RankedSeason[];
}

export interface ArenaPlayer {
  key: string;
  name: string;
  side: "ally" | "enemy";
  relation: number | null;
  accountId: number | null;
  shipId: number | null;
  shipName: string;
  shipType?: string;
  shipTier?: number;
}

export interface ArenaInfo {
  battleId: string;
  mapName: string;
  gameMode: string;
  updatedAt: number;
  players: ArenaPlayer[];
}

export interface RosterPlayer extends ArenaPlayer {
  status: "loading" | "ok" | "hidden" | "not-found" | "error";
  clan?: PlayerDetails["clan"];
  overall?: OverallStats | null;
  currentShip?: ShipStats | null;
  error?: string;
}

export interface ArenaState {
  arena: ArenaInfo | null;
  roster: RosterPlayer[];
  watchedPath?: string;
}

export interface SnowflakeTierSummary {
  tier: number;
  label: string;
  count: number;
  rewardPerShip: number;
  rewardType: "token" | "steel";
  totalReward: number;
}

export interface SnowflakeSummary {
  accountId: number;
  nickname: string;
  realm: "asia" | "eu" | "na";
  totalShips: number;
  eligibleShips: number;
  totalTokens: number;
  totalSteel: number;
  tiers: SnowflakeTierSummary[];
  event: {
    id: string;
    name: string;
    currencyName: string;
    exchangeRewards: Array<{
      id: string;
      name: string;
      category: string;
      price: number;
      limit?: number;
      featured?: boolean;
    }>;
  };
  syncedAt: number;
}

export interface WgAuthStatus {
  authorized: boolean;
  accountId?: number;
  nickname?: string;
  realm?: "asia" | "eu" | "na";
  expiresAt?: number;
}

export interface SnowflakeAuthStatus extends WgAuthStatus {
  summary?: SnowflakeSummary;
  error?: string;
}
