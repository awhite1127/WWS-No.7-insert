"use strict";

const SNOWFLAKE_REWARDS = {
  5: { amount: 25, type: "token" },
  6: { amount: 35, type: "token" },
  7: { amount: 50, type: "token" },
  8: { amount: 75, type: "token" },
  9: { amount: 100, type: "token" },
  10: { amount: 125, type: "token" },
  11: { amount: 200, type: "steel" },
};

const EXCHANGE_REWARDS = [
  { id: "kurama", name: "★ 鞍马", category: "舰船", price: 11000, limit: 1, featured: true },
  { id: "press-f", name: "Press F 击沉特效", category: "外观", price: 2500, limit: 1 },
  { id: "this-is-fine", name: "This Is Fine 击沉特效", category: "外观", price: 2000, limit: 1 },
  { id: "supership-bonus", name: "超级舰船收益加成包", category: "加成", price: 2000, limit: 1 },
  { id: "destruction-container", name: "击沉特效补给箱", category: "补给箱", price: 300, limit: 10 },
  { id: "santiago-container", name: "圣地亚哥-德古巴海战补给箱", category: "补给箱", price: 150 },
  { id: "supercontainer", name: "超级补给箱", category: "补给箱", price: 125, limit: 130 },
  { id: "rare-bonuses", name: "各类型稀有加成 ×1", category: "加成", price: 125, limit: 50 },
  { id: "decals-premium", name: "贴花高级补给箱", category: "补给箱", price: 100 },
  { id: "red-steel-titan", name: "红钢巨人高级补给箱", category: "补给箱", price: 95 },
  { id: "signals-1", name: "信号旗组合包 I", category: "信号旗", price: 50 },
  { id: "signals-2", name: "信号旗组合包 II", category: "信号旗", price: 50 },
  { id: "uncommon-bonuses", name: "各类型特殊加成 ×1", category: "加成", price: 24, limit: 150 },
  { id: "common-bonuses", name: "各类型普通加成 ×1", category: "加成", price: 12 },
];

function shipsFromPort(port) {
  if (!Array.isArray(port)) return [];
  const shipIds = new Set();
  for (const value of port) {
    const shipId = Number(value?.ship_id ?? value);
    if (Number.isSafeInteger(shipId) && shipId > 0) shipIds.add(shipId);
  }
  return [...shipIds].map((ship_id) => ({ ship_id }));
}

function summarizeSnowflakes(ships, metadata, account) {
  const counts = new Map();
  for (const ship of ships) {
    const shipId = String(ship.ship_id);
    const tier = Number(metadata[shipId]?.tier ?? 0);
    if (SNOWFLAKE_REWARDS[tier]) counts.set(tier, (counts.get(tier) ?? 0) + 1);
  }

  const tiers = Object.entries(SNOWFLAKE_REWARDS).map(([tierText, reward]) => {
    const tier = Number(tierText);
    const count = counts.get(tier) ?? 0;
    return {
      tier,
      label: tier === 11 ? "超级舰船" : `${tier}级`,
      count,
      rewardPerShip: reward.amount,
      rewardType: reward.type,
      totalReward: count * reward.amount,
    };
  });

  return {
    accountId: Number(account.accountId),
    nickname: account.nickname,
    realm: account.realm,
    totalShips: ships.length,
    eligibleShips: tiers.reduce((sum, row) => sum + row.count, 0),
    totalTokens: tiers.filter((row) => row.rewardType === "token").reduce((sum, row) => sum + row.totalReward, 0),
    totalSteel: tiers.filter((row) => row.rewardType === "steel").reduce((sum, row) => sum + row.totalReward, 0),
    tiers,
    event: {
      id: "wows-15.8-11th-anniversary",
      name: "11周年庆典",
      currencyName: "节日代币",
      exchangeRewards: EXCHANGE_REWARDS,
    },
    syncedAt: Date.now(),
  };
}

module.exports = { EXCHANGE_REWARDS, SNOWFLAKE_REWARDS, shipsFromPort, summarizeSnowflakes };
