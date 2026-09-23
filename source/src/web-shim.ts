import type { AppConfig, ArenaInfo, ClanDetails, ContainerDetails, ContainerSummary, PlayerDetails, RosterPlayer, SnowflakeAuthStatus, WgAuthStatus } from "./types";

if (!window.wws) {
  const config: AppConfig = { realm: "asia", theme: "dark", gamePath: "", overlayEnabled: true, overlayHotkey: "Tab" };
  const arenaListeners: Array<(arena: ArenaInfo | null) => void> = [];
  const rosterListeners: Array<(players: RosterPlayer[]) => void> = [];
  const mockDetails: PlayerDetails = {
    accountId: 3003269897,
    nickname: "yizhibai",
    realm: "asia",
    hiddenProfile: false,
    createdAt: 0,
    lastBattleTime: 0,
    clan: { id: 2000030618, tag: "MONKEY", name: "WWS Monkey Fleet" },
    overall: { battles: 5478, wins: 3150, winRate: 57.5, avgDamage: 110881, avgXp: 1834, avgFrags: 1.03, survivalRate: 42.8 },
    cumulative: { battles: 5478, wins: 3150, damageDealt: 607406118, xp: 10047452, frags: 5642, survivedBattles: 2345 },
    recent: {
      trackedSince: Date.now() - 100 * 86400000,
      periods: [
        { days: 1, available: true, actualDays: 1, battles: 8, wins: 5, winRate: 62.5, avgDamage: 124800, avgXp: 1940, avgFrags: 1.25, survivalRate: 50 },
        { days: 7, available: true, actualDays: 7, battles: 43, wins: 26, winRate: 60.47, avgDamage: 118420, avgXp: 1870, avgFrags: 1.14, survivalRate: 46.5 },
        { days: 30, available: true, actualDays: 30, battles: 154, wins: 91, winRate: 59.09, avgDamage: 115280, avgXp: 1842, avgFrags: 1.08, survivalRate: 44.8 },
        { days: 90, available: true, actualDays: 90, battles: 402, wins: 235, winRate: 58.46, avgDamage: 112930, avgXp: 1819, avgFrags: 1.05, survivalRate: 43.5 },
      ],
    },
    ranked: [
      { seasonId: 1030, battles: 25, wins: 9, winRate: 36, avgDamage: 39002 },
      { seasonId: 1029, battles: 59, wins: 28, winRate: 47.5, avgDamage: 52496 },
      { seasonId: 1028, battles: 41, wins: 25, winRate: 61, avgDamage: 41813 },
      { seasonId: 1027, battles: 46, wins: 23, winRate: 50, avgDamage: 50654 },
    ],
    ships: Array.from({ length: 22 }, (_, index) => ({
      shipId: index === 0 ? 4074645200 : index === 1 ? 4281317360 : 4000000000 + index,
      name: ["大和", "岛风", "藏王", "得克萨斯", "吉野", "信浓"][index % 6] + (index > 5 ? ` · ${Math.floor(index / 6) + 1}` : ""),
      tier: 10,
      type: ["Battleship", "Destroyer", "Cruiser", "AirCarrier"][index % 4],
      nation: "japan",
      battles: 520 - index * 17,
      wins: 300 - index * 7,
      winRate: 47 + ((index * 2.7) % 17),
      avgDamage: 121000 - index * 2100,
      avgXp: 1800 - index * 20,
      avgFrags: 1.35 - index * 0.02,
    })),
  };
  const mockArena: ArenaInfo = {
    battleId: "preview",
    mapName: "北方海域",
    gameMode: "制海权",
    updatedAt: Date.now(),
    players: (["ally", "enemy"] as const).flatMap((side) =>
      [
        ["白龙", "AirCarrier"], ["大和", "Battleship"], ["蒙大拿", "Battleship"],
        ["勃艮第", "Battleship"], ["俄亥俄", "Battleship"], ["威尼斯", "Cruiser"],
        ["得梅因", "Cruiser"], ["彼得罗巴甫洛夫斯克", "Cruiser"], ["米诺陶斯", "Cruiser"],
        ["莫斯科", "Cruiser"], ["岛风", "Destroyer"], ["春云", "Destroyer"],
      ].map(([shipName, shipType], index) => ({
        key: side + index, name: side === "ally" && index === 0 ? "yizhibai" : (side === "ally" ? "FleetMate_" : "SeaRival_") + String(index + 1).padStart(2, "0"),
        side, relation: side === "ally" ? 1 : 2, accountId: 3003269897 + index + (side === "enemy" ? 100 : 0),
        shipId: 4000000000 + index, shipName, shipType, shipTier: 10,
      }))),
  };
  const mockClan: ClanDetails = {
    clanId: 2000030618,
    tag: "GNK48",
    name: "Diana's 48 Good Night Kisses",
    description: "一支活跃于亚服的舰队，欢迎热爱团队作战与战术交流的玩家。",
    createdAt: 1643603651,
    creatorName: "Noob__DD",
    leaderName: "Noob__DD",
    membersCount: 36,
    members: Array.from({ length: 16 }, (_, index) => ({
      accountId: 3003269897 + index,
      accountName: index === 0 ? "yizhibai" : `FleetMember_${String(index).padStart(2, "0")}`,
      joinedAt: 1668656328 + index * 86400,
      role: index === 0 ? "commander" : index < 4 ? "executive_officer" : "private",
    })),
  };
  const mockRoster: RosterPlayer[] = mockArena.players.map((player, index) => ({
    ...player,
    status: "ok",
    overall: {
      battles: 1600 + index * 267, wins: 800 + index * 130,
      winRate: 43 + ((index * 7 + Math.floor(index / 12) * 4) % 21), avgDamage: 62000 + index * 1900,
      avgXp: 1180 + index * 28, avgFrags: 0.7, survivalRate: 40,
    },
    currentShip: {
      shipId: player.shipId!, name: player.shipName, tier: 10, type: player.shipType!,
      nation: "japan", battles: 42 + index * 13, wins: 20 + index * 6,
      winRate: 39 + (index * 9 % 25), avgDamage: 78000 + index * 1800,
      avgXp: 1250 + index * 32, avgFrags: 0.8,
    },
    clan: index === 0 ? mockDetails.clan : null,
  }));
  const mockContainers: ContainerSummary[] = [
    { id: "4059222960", title: "“特殊递送：作战物资”高级补给箱", englishName: '"Special Delivery: Combat Supplies" Premium container' },
    { id: "4046640048", title: "“超大号圣诞老人的礼物”补给箱", englishName: "Santa's Mega Gift container" },
    { id: "4169323440", title: "白银段位补给箱", englishName: "Silver League container" },
  ];
  const mockContainerDetails: ContainerDetails = {
    id: mockContainers[0].id,
    title: mockContainers[0].title,
    savePoint: null,
    sourceUrl: "https://worldofwarships.asia/en/content/contents-and-drop-rates-of-containers/",
    slots: [{ number: 1, title: "", groups: [
      { kind: "common", title: "常规奖励", probability: null, guaranteedAfter: null, rewards: [
        { name: "经济加成（ID 4281331632）", type: "camoboost", amount: 8, probability: 10, id: "4281331632" },
        { name: "精英指挥官经验", type: "elite_xp", amount: 57000, probability: 38.1, id: null },
      ] },
      { kind: "valuable", title: "IX级金币战舰", probability: 1.9, guaranteedAfter: 110, rewards: [
        { name: "BA 狒", type: "ship", amount: 1, probability: null, id: "3436099280" },
      ] },
    ] }],
  };
  const snowStatus: SnowflakeAuthStatus = {
    authorized: true,
    accountId: 3003269897,
    nickname: "yizhibai",
    realm: "asia",
    expiresAt: Math.floor(Date.now() / 1000) + 864000,
    summary: {
      accountId: 3003269897,
      nickname: "yizhibai",
      realm: "asia",
      totalShips: 183,
      eligibleShips: 142,
      totalTokens: 10875,
      totalSteel: 1200,
      tiers: [
        [5, "5级", 28, 25, "token"], [6, "6级", 25, 35, "token"], [7, "7级", 24, 50, "token"],
        [8, "8级", 27, 75, "token"], [9, "9级", 18, 100, "token"], [10, "10级", 14, 125, "token"], [11, "超级舰船", 6, 200, "steel"],
      ].map(([tier, label, count, rewardPerShip, rewardType]) => ({ tier, label, count, rewardPerShip, rewardType, totalReward: Number(count) * Number(rewardPerShip) })) as SnowflakeAuthStatus["summary"] extends infer S ? S extends { tiers: infer T } ? T : never : never,
      event: {
        id: "wows-15.8-11th-anniversary", name: "11周年庆典", currencyName: "节日代币",
        exchangeRewards: [
          { id: "kurama", name: "★ 鞍马", category: "舰船", price: 11000, limit: 1, featured: true },
          { id: "press-f", name: "Press F 击沉特效", category: "外观", price: 2500, limit: 1 },
          { id: "supership-bonus", name: "超级舰船收益加成包", category: "加成", price: 2000, limit: 1 },
          { id: "supercontainer", name: "超级补给箱", category: "补给箱", price: 125, limit: 130 },
          { id: "red-steel-titan", name: "红钢巨人高级补给箱", category: "补给箱", price: 95 },
          { id: "signals-1", name: "信号旗组合包 I", category: "信号旗", price: 50 },
        ],
      },
      syncedAt: Date.now(),
    },
  };

  window.wws = {
    getConfig: async () => config,
    saveConfig: async (next) => Object.assign(config, next),
    getArenaState: async () => ({ arena: null, roster: [], watchedPath: "", arenaFileFound: false }),
    listContainers: async () => mockContainers,
    containerDetails: async (id) => ({ ...mockContainerDetails, id, title: mockContainers.find((item) => item.id === id)?.title || mockContainerDetails.title }),
    openContainerSource: async () => {},
    refreshRoster: async () => {
      rosterListeners.forEach((listener) => listener(mockRoster));
      return mockRoster;
    },
    getWgAuthStatus: async () => snowStatus as WgAuthStatus,
    loginWg: async () => snowStatus as WgAuthStatus,
    getMyStats: async () => mockDetails,
    getSnowflakeStatus: async () => snowStatus,
    loginSnowflake: async () => snowStatus,
    refreshSnowflake: async () => snowStatus,
    logoutSnowflake: async () => true,
    searchPlayers: async (query) => [{ account_id: 3003269897, nickname: query }],
    playerDetails: async () => mockDetails,
    searchClans: async (query) => [{ clan_id: mockClan.clanId, tag: query.toUpperCase(), name: mockClan.name, members_count: mockClan.membersCount }],
    clanDetails: async () => mockClan,
    chooseGameDirectory: async () => "",
    startArenaWatch: async (gamePath) => gamePath,
    stopArenaWatch: async () => true,
    simulateArena: async () => {
      arenaListeners.forEach((listener) => listener(mockArena));
      rosterListeners.forEach((listener) => listener(mockRoster));
      return mockArena;
    },
    setOverlayVisible: async () => true,
    minimizeWindow: async () => true,
    toggleMaximizeWindow: async () => false,
    isWindowMaximized: async () => false,
    closeWindow: async () => true,
    onWindowMaximized: () => () => {},
    onArenaUpdate: (callback) => {
      arenaListeners.push(callback);
      if (new URLSearchParams(location.search).get("overlay") === "1") queueMicrotask(() => callback(mockArena));
      return () => arenaListeners.splice(arenaListeners.indexOf(callback), 1);
    },
    onRosterStats: (callback) => {
      rosterListeners.push(callback);
      if (new URLSearchParams(location.search).get("overlay") === "1") queueMicrotask(() => callback(mockRoster));
      return () => rosterListeners.splice(rosterListeners.indexOf(callback), 1);
    },
    onOverlayStatus: () => () => {},
  };
}
