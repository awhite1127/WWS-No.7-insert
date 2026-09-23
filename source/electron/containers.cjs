"use strict";

const catalog = require("../data/container-catalog.json");
const glossary = require("../data/wg-zh-sg-glossary.json");

const HOSTS = {
  asia: { portal: "worldofwarships.asia", vortex: "vortex.worldofwarships.asia" },
  eu: { portal: "worldofwarships.eu", vortex: "vortex.worldofwarships.eu" },
  na: { portal: "worldofwarships.com", vortex: "vortex.worldofwarships.com" },
};
const OFFICIAL_LOCALE = "zh-sg";
const labels = {
  ship: "战舰", crew: "指挥官", camoboost: "经济加成", camouflage: "涂装",
  permoflage: "永久涂装", signal: "信号旗", modernization: "升级品",
  skin: "涂装", mskin: "涂装", style: "永久涂装", ensign: "旗帜",
  collection_album: "收藏品拼图", shipdestruction: "击沉特效",
  visual_customization: "外观", multiboost: "经济加成", eventum_11: "活动代币",
  lootbox: "补给箱", credits: "银币", coal: "煤炭", steel: "钢铁",
  gold: "达布隆", free_xp: "全局经验", elite_xp: "精英指挥官经验",
  paragon_xp: "研发点", wows_premium: "战舰世界高级账号（天）",
  premium: "高级账号（天）", slot: "港口船位", slots: "港口船位",
  recruitment_points: "招募点数",
};
const romanTiers = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "★"];
const economicBonusNames = new Map([
  ...[4280283056, 4281331632, 4282380208, 4283428784].map((id) => [String(id), "银币经济加成"]),
  ...[4269797296, 4270845872, 4271894448, 4272943024].map((id) => [String(id), "战舰经验经济加成"]),
  ...[4259311536, 4260360112, 4261408688, 4262457264].map((id) => [String(id), "指挥官经验经济加成"]),
  ...[4248825776, 4249874352, 4250922928, 4251971504].map((id) => [String(id), "全局经验经济加成"]),
]);
const titleById = new Map(catalog.items.map((item) => [item.id, item.title]));
const listCache = new Map();

function realmHosts(realm) {
  return HOSTS[realm] || HOSTS.asia;
}

async function fetchJson(url) {
  const response = await fetch(url, { headers: { "User-Agent": "No7Insert/0.1.3", Accept: "application/json" }, signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`官网数据请求失败（${response.status}）`);
  return response.json();
}

function listEntry(item) {
  return { id: String(item.id), title: titleById.get(String(item.id)) || item.mark, englishName: item.mark };
}

async function listContainers(realm = "asia") {
  const cached = listCache.get(realm);
  if (cached && Date.now() - cached.time < 10 * 60 * 1000) return cached.items;
  const host = realmHosts(realm).portal;
  try {
    const data = await fetchJson(`https://${host}/papi/v1/container/?lang=en`);
    if (!Array.isArray(data.items) || !data.items.length) throw new Error("官网未返回箱子目录");
    const items = data.items.map(listEntry);
    listCache.set(realm, { time: Date.now(), items });
    return items;
  } catch (error) {
    if (cached) return cached.items;
    return catalog.items;
  }
}

function probability(value) {
  const number = Number(value);
  return value === undefined || value === null || !Number.isFinite(number) ? null : number;
}

function rewardName(reward) {
  const id = String(reward.id);
  const officialItem = glossary.items[id];
  if (reward.type === "camoboost") {
    const bonus = officialItem?.match(/(银币|战舰经验|指挥官经验|全局经验)\s*\+\s*([\d.]+%)/);
    return bonus ? `${bonus[1]}经济加成 +${bonus[2]}` : economicBonusNames.get(id) || "经济加成";
  }
  if (reward.type === "collection_album") {
    const album = glossary.albums[id];
    return album ? `“${album.replace(/^[“”"]|[“”"]$/g, "")}”收藏品拼图` : "收藏品拼图";
  }
  const explicit = reward.type === "ship"
    ? glossary.ships[id]?.title || reward.additionalData?.title
    : reward.additionalData?.title || officialItem;
  if (typeof explicit === "string" && explicit.trim()) {
    const name = explicit.trim();
    if (reward.type !== "ship") return name;
    const tier = romanTiers[Number(reward.additionalData?.level || glossary.ships[id]?.level)] || "";
    return tier && !name.startsWith(`${tier} `) ? `${tier} ${name}` : name;
  }
  if (reward.type === "lootbox" && titleById.has(id)) return titleById.get(id);
  return labels[reward.type] || "未知奖励";
}

function normalizeReward(reward) {
  return {
    name: rewardName(reward),
    type: reward.type || "unknown",
    amount: Number(reward.amount) || 1,
    probability: probability(reward.probabilityDisplayed ?? reward.probability),
    id: reward.id == null ? null : String(reward.id),
  };
}

function normalizeGroups(record, kind) {
  return Object.values(record || {}).map((group) => ({
    kind,
    title: /(?:加值|金币)战舰/.test(group.title || "")
      ? "金币战舰"
      : String(group.title || "").trim() || (kind === "valuable" ? "珍稀奖励" : "常规奖励"),
    probability: probability(group.probabilityDisplayed ?? group.probability),
    guaranteedAfter: Number(group.savePoint) || null,
    rewards: (group.rewards || []).map(normalizeReward),
  })).filter((group) => group.rewards.length);
}

function normalizeContainer(data, realm) {
  return {
    id: String(data.id),
    title: data.title || titleById.get(String(data.id)) || data.name,
    savePoint: Number(data.savePoint) || null,
    slots: (data.slots || []).map((slot, index) => ({
      number: index + 1,
      title: String(slot.title || "").trim(),
      groups: [
        ...normalizeGroups(slot.commonRewards, "common"),
        ...normalizeGroups(slot.valuableRewards, "valuable"),
      ],
    })),
    sourceUrl: `https://${realmHosts(realm).portal}/${OFFICIAL_LOCALE}/content/contents-and-drop-rates-of-containers/`,
  };
}

async function containerDetails(id, realm = "asia") {
  const idText = String(id);
  if (!/^\d{1,12}$/.test(idText)) throw new Error("无效的箱子编号");
  const host = realmHosts(realm).vortex;
  const result = await fetchJson(`https://${host}/api/get_lootbox/${OFFICIAL_LOCALE}/${idText}/`);
  if (result.status !== "ok" || !result.data?.slots) throw new Error("官网未返回箱子奖励数据");
  return normalizeContainer(result.data, realm);
}

module.exports = { listContainers, containerDetails, normalizeContainer };
