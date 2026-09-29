"use strict";

// Refresh this list only after WG has published a new Santa container lineup.
// Each container ID is a specific year's official drop table, not a live alias.
const fs = require("node:fs/promises");
const path = require("node:path");

const editions = [
  { year: 2025, containerId: "4016231344", expected: 143, article: "https://worldofwarships.com/en/news/sales-and-events/santas-gifts-arrived-to-nordlyshavn/" },
];

async function container(id, locale) {
  const response = await fetch(`https://vortex.worldofwarships.asia/api/get_lootbox/${locale}/${id}/`, { signal: AbortSignal.timeout(60000) });
  if (!response.ok) throw new Error(`WG ${locale} ${id}: HTTP ${response.status}`);
  const body = await response.json();
  if (body.status !== "ok" || !Array.isArray(body.data?.slots)) throw new Error(`WG ${locale} ${id}: invalid response`);
  return body.data;
}

function shipEntries(data) {
  return data.slots.flatMap((slot) => [...Object.values(slot.commonRewards || {}), ...Object.values(slot.valuableRewards || {})]
    .flatMap((group) => (group.rewards || []).filter((reward) => reward.type === "ship").map((reward) => ({ group: group.title, reward }))));
}

async function main() {
  const pools = [];
  for (const edition of editions) {
    const [zh, en] = await Promise.all([container(edition.containerId, "zh-sg"), container(edition.containerId, "en")]);
    const enById = new Map(shipEntries(en).map(({ reward }) => [String(reward.id), reward.additionalData?.title]));
    const ships = shipEntries(zh).map(({ group, reward }) => ({
      id: Number(reward.id),
      name: reward.additionalData?.title || String(reward.id),
      englishName: enById.get(String(reward.id)) || "",
      tier: Number(reward.additionalData?.level) || 0,
      nation: reward.additionalData?.nation?.name || "",
      type: reward.additionalData?.type?.name || "",
      group,
    }));
    if (ships.length !== edition.expected || new Set(ships.map((ship) => ship.id)).size !== ships.length) {
      throw new Error(`${edition.year}: expected ${edition.expected} unique ships, got ${ships.length}`);
    }
    pools.push({ year: edition.year, containerId: edition.containerId, sourceUrl: edition.article, ships });
    process.stdout.write(`${edition.year}: ${ships.length} ships\n`);
  }
  await fs.writeFile(path.join(__dirname, "..", "data", "christmas-pools.json"), JSON.stringify({ updatedAt: new Date().toISOString(), pools }, null, 2) + "\n");
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
