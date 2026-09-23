"use strict";

const catalog = require("../data/container-catalog.json");

const HOSTS = {
  asia: { portal: "worldofwarships.asia", vortex: "vortex.worldofwarships.asia" },
  eu: { portal: "worldofwarships.eu", vortex: "vortex.worldofwarships.eu" },
  na: { portal: "worldofwarships.com", vortex: "vortex.worldofwarships.com" },
};
const labels = {
  ship: "战舰", crew: "指挥官", camoboost: "经济加成", camouflage: "涂装",
  permoflage: "永久涂装", signal: "信号旗", modernization: "升级品",
  lootbox: "补给箱", credits: "银币", coal: "煤炭", steel: "钢铁",
  gold: "达布隆", free_xp: "全局经验", elite_xp: "精英指挥官经验",
  paragon_xp: "研发点", wows_premium: "战舰世界高级账号（天）",
  premium: "高级账号（天）", slot: "港口船位",
};
const titleById = new Map(catalog.items.map((item) => [item.id, item.title]));
const listCache = new Map();

function realmHosts(realm) {
  return HOSTS[realm] || HOSTS.asia;
}

async function fetchJson(url) {
  const response = await fetch(url, { headers: { "User-Agent": "No7Insert/0.1.2", Accept: "application/json" }, signal: AbortSignal.timeout(15000) });
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
  const explicit = reward.additionalData?.title;
  if (typeof explicit === "string" && explicit.trim()) return explicit.trim();
  const label = labels[reward.type] || reward.type || "未知奖励";
  return reward.id && ["camoboost", "signal", "camouflage", "permoflage", "modernization"].includes(reward.type)
    ? `${label}（ID ${reward.id}）` : label;
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
    title: String(group.title || "").trim() || (kind === "valuable" ? "珍稀奖励" : "常规奖励"),
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
    sourceUrl: `https://${realmHosts(realm).portal}/en/content/contents-and-drop-rates-of-containers/`,
  };
}

async function containerDetails(id, realm = "asia") {
  const idText = String(id);
  if (!/^\d{1,12}$/.test(idText)) throw new Error("无效的箱子编号");
  const host = realmHosts(realm).vortex;
  const result = await fetchJson(`https://${host}/api/get_lootbox/zh-cn/${idText}/`);
  if (result.status !== "ok" || !result.data?.slots) throw new Error("官网未返回箱子奖励数据");
  return normalizeContainer(result.data, realm);
}

module.exports = { listContainers, containerDetails, normalizeContainer };
