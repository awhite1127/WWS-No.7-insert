"use strict";

const SNOWFLAKE_REWARDS = {
  5: { amount: 700, type: "coal" },
  6: { amount: 750, type: "coal" },
  7: { amount: 800, type: "coal" },
  8: { amount: 70, type: "steel" },
  9: { amount: 80, type: "steel" },
  10: { amount: 1, type: "token" },
  11: { amount: 200, type: "steel" },
};

const EXCHANGE_REWARDS = [
  { id: "santa-gift", name: "圣诞老人的礼物补给箱", category: "补给箱", price: 1 },
  { id: "santa-mega", name: "圣诞老人的超大号礼物补给箱", category: "补给箱", price: 5, featured: true },
  { id: "credits", name: "375,000 银币", category: "银币", price: 1 },
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
    totalCoal: tiers.filter((row) => row.rewardType === "coal").reduce((sum, row) => sum + row.totalReward, 0),
    tiers,
    event: {
      id: "wows-15.11-new-year-2026",
      name: "2026 圣诞与新年庆典",
      currencyName: "节日代币",
      exchangeRewards: EXCHANGE_REWARDS,
    },
    syncedAt: Date.now(),
  };
}

module.exports = { EXCHANGE_REWARDS, SNOWFLAKE_REWARDS, shipsFromPort, summarizeSnowflakes };
