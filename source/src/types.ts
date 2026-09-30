export interface AppConfig {
  realm: "asia" | "eu" | "na";
  theme: "dark" | "light";
  gamePath: string;
  overlayEnabled: boolean;
  overlayHotkeyEnabled: boolean;
  overlayHotkey: string;
}

export interface UpdateCheckResult {
  currentVersion: string;
  latestVersion: string;
  updateAvailable: boolean;
  releaseUrl: string;
  asset: { name: string; size: number; installer: boolean } | null;
}

export interface DownloadedUpdate {
  path: string;
  verified: boolean;
  installer: boolean;
}

export interface UpdateProgress {
  received: number;
  total: number;
  percent: number | null;
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
  overall: {
    battles: number;
    winRate: number;
    avgDamage: number;
    avgXp: number;
    totalXp: number;
    publicMembers: number;
  } | null;
  members: Array<{
    accountId: number;
    accountName: string;
    joinedAt: number | null;
    role: string;
    statsStatus: "ok" | "hidden" | "unavailable";
    overall: { battles: number; winRate: number; avgDamage: number; avgXp: number } | null;
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
  pr?: number | null;
  shipId: number;
  name: string;
  englishName?: string;
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

export interface PrAggregate {
  version: string;
  coveredBattles: number;
  totalBattles: number;
  damage: number;
  wins: number;
  frags: number;
  expectedDamage: number;
  expectedWins: number;
  expectedFrags: number;
}

export interface StatsSnapshot {
  pr?: PrAggregate | null;
  capturedAt: number;
  battles: number;
  wins: number;
  damageDealt: number;
  xp: number;
  frags: number;
  survivedBattles: number;
}

export interface ShipClassStats {
  type: string;
  code: string;
  label: string;
  shipCount: number;
  battles: number;
  wins: number;
  winRate: number | null;
  avgDamage: number | null;
  avgXp: number | null;
  avgFrags: number | null;
  pr: number | null;
  prCoverage: number | null;
}

export interface PlayerDetails {
  shipClasses?: ShipClassStats[];
  history?: StatsSnapshot[];
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
  gameKarma?: number | null;
  karmaStatus?: "loading" | "ok" | "unavailable";
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
  arenaFileFound?: boolean;
}

export interface ContainerSummary {
  id: string;
  title: string;
  englishName: string;
}

export interface ContainerReward {
  name: string;
  type: string;
  amount: number;
  probability: number | null;
  id: string | null;
}

export interface ContainerGroup {
  kind: "common" | "valuable";
  title: string;
  probability: number | null;
  guaranteedAfter: number | null;
  rewards: ContainerReward[];
}

export interface ContainerDetails {
  id: string;
  title: string;
  savePoint: number | null;
  slots: Array<{ number: number; title: string; groups: ContainerGroup[] }>;
  sourceUrl: string;
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

export interface ChristmasPortShips {
  accountId: number;
  nickname: string;
  realm: "asia" | "eu" | "na";
  shipIds: number[];
  syncedAt: number;
}

export interface SnowflakeAuthStatus extends WgAuthStatus {
  summary?: SnowflakeSummary;
  error?: string;
}

export interface NewsItem {
  id: string; category: "ships" | "events"; title: string; originalTitle: string; summary: string; publishedAt: string; url: string; source: string; language: string; stage: string; important: boolean;
}
export interface NewsFeed {
  items: NewsItem[];
  sources: Array<{ category: "ships" | "events"; updatedAt: number; error: string }>;
  checkedAt?: number;
}
