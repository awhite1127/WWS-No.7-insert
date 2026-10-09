import expectedPr from "../data/pr-expected.json";
import { ratingValue } from "./stats-trend";
import type { PrAggregate } from "./types";
import newsSnapshot from "../data/news-snapshot.json";
import type { NewsFeed, AppConfig, ClanDetails, ContainerDetails, ContainerSummary, PlayerDetails, SnowflakeAuthStatus, WgAuthStatus } from "./types";

if (!window.wws) {
  // Optional slow-data preview; Electron always uses its real preload API.
  const previewDelay = import.meta.env.DEV ? Math.min(10000, Math.max(0, Number(new URLSearchParams(location.search).get("previewDelay")) || 0)) : 0;
  async function previewResult<T>(value: T): Promise<T> {
    if (previewDelay) await new Promise((resolve) => setTimeout(resolve, previewDelay));
    return value;
  }
  const config: AppConfig = { realm: "asia", theme: "dark", gamePath: "", overlayEnabled: true, overlayHotkeyEnabled: true, overlayHotkey: "Tab", overlayBattleMode: "random" };
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
    history: Array.from({ length: 100 }, (_, index) => {
      const battles = 4983 + index * 5, wins = 2815 + index * 3;
      const damage = battles * (108900 + index * 20), frags = battles * (1 + index * .0003);
      return { capturedAt: Date.now() - (99-index)*86400000, battles, wins, damageDealt: damage, xp: battles*(1800+index*.34), frags, survivedBattles: Math.floor(battles*.428), pr: { version:"1790730408", totalBattles:battles, coveredBattles:battles, damage, frags, wins, expectedDamage:battles*85000, expectedFrags:battles*.8, expectedWins:battles*.5 } };
    }),
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
      englishName: ["Yamato", "Shimakaze", "Zao", "Texas", "Yoshino", "Shinano"][index % 6] + (index > 5 ? ` ${Math.floor(index / 6) + 1}` : ""),
      tier: 10,
      type: ["Battleship", "Destroyer", "Cruiser", "Battleship", "Cruiser", "AirCarrier"][index % 6],
      nation: ["japan", "japan", "japan", "usa", "japan", "japan"][index % 6],
      battles: 520 - index * 17,
      wins: 300 - index * 7,
      winRate: 47 + ((index * 2.7) % 17),
      avgDamage: 121000 - index * 2100,
      avgXp: 1800 - index * 20,
      avgFrags: 1.35 - index * 0.02,
    })),
  };
  function previewPr(ships: PlayerDetails["ships"]) {
    const a: PrAggregate = { version: expectedPr.version, coveredBattles:0,totalBattles:0,damage:0,frags:0,wins:0,expectedDamage:0,expectedFrags:0,expectedWins:0 };
    for (const ship of ships) {
      a.totalBattles+=ship.battles;
      const e=(expectedPr.data as Record<string,{average_damage_dealt:number;average_frags:number;win_rate:number}>)[String(ship.shipId)];
      if (!e) continue;
      a.coveredBattles+=ship.battles; a.damage+=ship.avgDamage*ship.battles; a.frags+=ship.avgFrags*ship.battles;a.wins+=ship.wins;
      a.expectedDamage+=e.average_damage_dealt*ship.battles; a.expectedFrags+=e.average_frags*ship.battles;a.expectedWins+=e.win_rate/100*ship.battles;
    }
    return { value:ratingValue(a),coverage:a.coveredBattles&&a.totalBattles?a.coveredBattles/a.totalBattles:null };
  }
  mockDetails.ships=mockDetails.ships.map(ship=>({...ship,pr:previewPr([ship]).value}));
  mockDetails.shipClasses=[{type:"Destroyer",code:"DD",label:"驱逐舰"},{type:"Battleship",code:"BB",label:"战列舰"},{type:"AirCarrier",code:"CV",label:"航空母舰"},{type:"Cruiser",code:"CL",label:"巡洋舰"},{type:"Submarine",code:"SS",label:"潜艇"}].map(c=>{
    const ships=mockDetails.ships.filter(s=>s.type===c.type);const battles=ships.reduce((n,s)=>n+s.battles,0),wins=ships.reduce((n,s)=>n+s.wins,0);
    const avg=(key:"avgDamage"|"avgXp"|"avgFrags")=>battles?ships.reduce((n,s)=>n+s[key]*s.battles,0)/battles:null;
    const pr=previewPr(ships);return {...c,shipCount:ships.length,battles,wins,winRate:battles?wins/battles*100:null,avgDamage:avg("avgDamage"),avgXp:avg("avgXp"),avgFrags:avg("avgFrags"),pr:pr.value,prCoverage:pr.coverage};
  });
  const mockClan: ClanDetails = {
    clanId: 2000030618,
    tag: "GNK48",
    name: "Diana's 48 Good Night Kisses",
    description: "一支活跃于亚服的舰队，欢迎热爱团队作战与战术交流的玩家。",
    createdAt: 1643603651,
    creatorName: "Noob__DD",
    leaderName: "Noob__DD",
    membersCount: 36,
    overall: { battles: 91240, winRate: 55.8, avgDamage: 96840, avgXp: 1712, totalXp: 156246080, publicMembers: 15 },
    members: Array.from({ length: 16 }, (_, index) => ({
      accountId: 3003269897 + index,
      accountName: index === 0 ? "yizhibai" : `FleetMember_${String(index).padStart(2, "0")}`,
      joinedAt: 1668656328 + index * 86400,
      role: index === 0 ? "commander" : index < 4 ? "executive_officer" : "private",
      statsStatus: index === 15 ? "hidden" : "ok",
      overall: index === 15 ? null : { battles: 1600 + index * 175, winRate: 48 + (index * 7 % 18), avgDamage: 73000 + index * 2200, avgXp: 1450 + index * 32 },
    })),
  };
  const mockContainers: ContainerSummary[] = [
    { id: "4059222960", title: "“特级快递：战斗支援物资”高级补给箱", englishName: '"Special Delivery: Combat Supplies" Premium container' },
    { id: "4002599856", title: "“星条曙光”补给箱", englishName: "Dawn of a Nation container" },
    { id: "4169323440", title: "白银联盟补给箱", englishName: "Silver League container" },
  ];
  const mockContainerDetails: ContainerDetails = {
    id: mockContainers[0].id,
    title: mockContainers[0].title,
    savePoint: null,
    sourceUrl: "https://worldofwarships.asia/zh-sg/content/contents-and-drop-rates-of-containers/",
    slots: [{ number: 1, title: "", groups: [
      { kind: "common", title: "常规奖励", probability: null, guaranteedAfter: null, rewards: [
        { name: "银币经济加成 +160%", type: "camoboost", amount: 8, probability: 10, id: "4281331632" },
        { name: "精英指挥官经验", type: "elite_xp", amount: 57000, probability: 38.1, id: null },
      ] },
      { kind: "valuable", title: "金币战舰", probability: 1.9, guaranteedAfter: 110, rewards: [
        { name: "IX BA高梁", type: "ship", amount: 1, probability: null, id: "3436099280" },
      ] },
    ] }],
  };
  const mockAlbumDetails: ContainerDetails = {
    id: "4002599856",
    title: "“星条曙光”补给箱",
    savePoint: null,
    sourceUrl: "https://worldofwarships.asia/zh-sg/content/contents-and-drop-rates-of-containers/",
    slots: [{ number: 1, title: "", groups: [
      { kind: "common", title: "常规奖励", probability: null, guaranteedAfter: null, rewards: [
        { name: "“星条曙光”收藏品拼图", type: "collection_album", amount: 1, probability: 100, id: "4245658544" },
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
    getShipDataStatus: async () => {
      const catalog = await window.wws.getPlannerCatalog();
      return {state:"idle",version:catalog.version,revision:catalog.revision,shipCount:catalog.ships.length,checkedAt:null,updated:false,error:""};
    },
    checkShipData: async () => ({...await window.wws.getShipDataStatus(),state:"error",error:"浏览器预览仅使用内置数据，请在桌面版检查更新。"}),
    onShipDataStatus: () => () => {},
    getPlannerCatalog: async () => {
      const response = await fetch(import.meta.env.BASE_URL + "planner-catalog.json.gz");
      if (!response.ok || !response.body) throw new Error("配装数据包不可用");
      const stream = response.body.pipeThrough(new DecompressionStream("gzip"));
      return await new Response(stream).json() as import("./build-planner").PlannerCatalog;
    },
    getNews: async () => { const today = new Date(); const monthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 2, 1)); const lastDay = new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 0)).getUTCDate(); const cutoff = new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth(), Math.min(today.getUTCDate(), lastDay))); return previewResult({ ...newsSnapshot, items: newsSnapshot.items.filter(item => { const published = new Date(item.publishedAt + "T00:00:00Z"); return published >= cutoff && published <= today; }) } as NewsFeed); },
    getNewsDetail: async () => ["浏览器预览暂不提供文章全文，请在桌面版查看。"],
    openRatingSource: async () => { window.open("https://wows-numbers.com/personal/rating/", "_blank", "noopener,noreferrer"); },
    openNewsSource: async (url) => { window.open(url, "_blank", "noopener,noreferrer"); },
    getConfig: async () => config,
    onConfigChanged: () => () => {},
    onWindowActivity: () => () => {},
    saveConfig: async (next) => Object.assign(config, next),
    getArenaState: async () => ({ arena: null, roster: [], watchedPath: "", arenaFileFound: false }),
    listContainers: async () => previewResult(mockContainers),
    containerDetails: async (id) => id === mockAlbumDetails.id
      ? mockAlbumDetails
      : { ...mockContainerDetails, id, title: mockContainers.find((item) => item.id === id)?.title || mockContainerDetails.title },
    openContainerSource: async () => {},
    refreshRoster: async () => [],
    getWgAuthStatus: async () => snowStatus as WgAuthStatus,
    loginWg: async () => snowStatus as WgAuthStatus,
    getMyStats: async () => previewResult(mockDetails),
    getChristmasPortShips: async () => ({ accountId: 3003269897, nickname: "yizhibai", realm: "asia", shipIds: [3436099280, 3544102864, 4074645200, 4281317360], syncedAt: Date.now() }),
    openChristmasSource: async (year) => { window.open(({ 2023: "https://worldofwarships.com/news/sales-and-events/armory-1211-santa-crates/", 2024: "https://worldofwarships.com/en/content/contents-and-drop-rates-of-containers/", 2025: "https://worldofwarships.com/en/news/sales-and-events/santas-gifts-arrived-to-nordlyshavn/" } as Record<number, string>)[year], "_blank"); },
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
    checkForUpdate: async () => ({ currentVersion: "0.1.7", latestVersion: "0.1.3", updateAvailable: false, releaseUrl: "https://github.com/awhite1127/WWS-No.7-insert/releases/tag/V0.1.3", asset: null }),
    downloadUpdate: async () => { throw new Error("浏览器预览不能下载程序"); },
    showUpdateFile: async () => false,
    installUpdate: async () => false,
    openUpdateRelease: async () => {},
    onUpdateProgress: () => () => {},
    setOverlayVisible: async () => true,
    minimizeWindow: async () => true,
    toggleMaximizeWindow: async () => false,
    isWindowMaximized: async () => false,
    closeWindow: async () => true,
    onWindowMaximized: () => () => {},
    onArenaUpdate: () => () => {},
    onRosterStats: () => () => {},
    onOverlayStatus: () => () => {},
  };
}
