/// <reference types="vite/client" />

import type { AppConfig, ArenaInfo, ArenaState, ClanDetails, ClanSearchResult, PlayerDetails, RosterPlayer, SearchResult, SnowflakeAuthStatus, WgAuthStatus } from "./types";

declare global {
  interface Window {
    wws: {
      getConfig(): Promise<AppConfig>;
      saveConfig(config: Partial<AppConfig>): Promise<AppConfig>;
      getArenaState(): Promise<ArenaState>;
      refreshRoster(): Promise<RosterPlayer[]>;
      getWgAuthStatus(): Promise<WgAuthStatus>;
      loginWg(realm: AppConfig["realm"]): Promise<WgAuthStatus>;
      getMyStats(): Promise<PlayerDetails>;
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
      simulateArena(): Promise<ArenaInfo>;
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
