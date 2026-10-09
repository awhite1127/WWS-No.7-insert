/// <reference types="vite/client" />

import type { NewsFeed, AppConfig, ArenaInfo, ArenaState, ClanDetails, ClanSearchResult, ContainerDetails, ContainerSummary, ChristmasPortShips, DownloadedUpdate, PlayerDetails, RosterPlayer, SearchResult, SnowflakeAuthStatus, UpdateCheckResult, UpdateProgress, WgAuthStatus } from "./types";

import type { PlannerCatalog } from "./build-planner";

declare global {
  interface ShipDataStatus {
    state: "idle" | "checking" | "ready" | "error";
    version: string;
    revision: number;
    shipCount: number;
    checkedAt: number | null;
    updated: boolean;
    error: string;
  }
  interface Window {
    wws: {
      getPlannerCatalog(force?: boolean): Promise<PlannerCatalog>;
      getShipDataStatus(): Promise<ShipDataStatus>;
      checkShipData(): Promise<ShipDataStatus>;
      onShipDataStatus(callback: (status: ShipDataStatus) => void): () => void;
      getNews(): Promise<NewsFeed>;
      getNewsDetail(url: string): Promise<string[]>;
      openNewsSource(url: string): Promise<void>;
      openRatingSource(): Promise<void>;
      getConfig(): Promise<AppConfig>;
      onConfigChanged(callback: (config: AppConfig) => void): () => void;
      onWindowActivity(callback: (status: { active: boolean }) => void): () => void;
      saveConfig(config: Partial<AppConfig>): Promise<AppConfig>;
      checkForUpdate(): Promise<UpdateCheckResult>;
      downloadUpdate(): Promise<DownloadedUpdate>;
      showUpdateFile(): Promise<boolean>;
      installUpdate(): Promise<boolean>;
      openUpdateRelease(): Promise<void>;
      onUpdateProgress(callback: (progress: UpdateProgress) => void): () => void;
      getArenaState(): Promise<ArenaState>;
      listContainers(realm: AppConfig["realm"]): Promise<ContainerSummary[]>;
      containerDetails(id: string, realm: AppConfig["realm"]): Promise<ContainerDetails>;
      openContainerSource(realm: AppConfig["realm"]): Promise<void>;
      refreshRoster(): Promise<RosterPlayer[]>;
      getWgAuthStatus(): Promise<WgAuthStatus>;
      loginWg(realm: AppConfig["realm"]): Promise<WgAuthStatus>;
      getMyStats(): Promise<PlayerDetails>;
      getChristmasPortShips(): Promise<ChristmasPortShips>;
      openChristmasSource(year: number): Promise<void>;
      getSnowflakeStatus(): Promise<SnowflakeAuthStatus>;
      loginSnowflake(realm: AppConfig["realm"]): Promise<SnowflakeAuthStatus>;
      refreshSnowflake(): Promise<SnowflakeAuthStatus>;
      logoutSnowflake(): Promise<boolean>;
      searchPlayers(query: string, realm: string): Promise<SearchResult[]>;
      playerDetails(accountId: number, realm: string): Promise<PlayerDetails>;
      searchClans(query: string, realm: string): Promise<ClanSearchResult[]>;
      clanDetails(clanId: number, realm: string): Promise<ClanDetails>;
      chooseGameDirectory(): Promise<string>;
      startArenaWatch(gamePath: string): Promise<string>;
      stopArenaWatch(): Promise<boolean>;
      setOverlayVisible(visible: boolean): Promise<boolean>;
      minimizeWindow(): Promise<boolean>;
      toggleMaximizeWindow(): Promise<boolean>;
      isWindowMaximized(): Promise<boolean>;
      closeWindow(): Promise<boolean>;
      onWindowMaximized(callback: (maximized: boolean) => void): () => void;
      onArenaUpdate(callback: (arena: ArenaInfo | null) => void): () => void;
      onRosterStats(callback: (players: RosterPlayer[]) => void): () => void;
      onOverlayStatus(callback: (status: Record<string, unknown>) => void): () => void;
    };
  }
}

export {};
