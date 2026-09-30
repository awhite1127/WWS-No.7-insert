"use strict";

// Each ID refers to WG's published 2025 Santa lineup. Classification comes
// from the drop-table group, never from an individual ship's tier.
const fs = require("node:fs/promises");
const path = require("node:path");
const editions = [{ year: 2025, containerId: "4016231344", megaId: "4015182768", ultraId: "4014134192", expected: 143,
  article: "https://worldofwarships.com/en/news/sales-and-events/santas-gifts-arrived-to-nordlyshavn/" }];
async function container(id, locale) {
  const response = await fetch(`https://vortex.worldofwarships.asia/api/get_lootbox/${locale}/${id}/`, { signal: AbortSignal.timeout(60000) });
  if (!response.ok) throw new Error(`WG ${locale} ${id}: HTTP ${response.status}`);
  const body = await response.json();
  if (body.status !== "ok" || !Array.isArray(body.data?.slots)) throw new Error("Invalid WG Santa response");
  return body.data;
}
function shipEntries(data) {
  return data.slots.flatMap(slot => [...Object.values(slot.commonRewards || {}), ...Object.values(slot.valuableRewards || {})]
    .flatMap(group => (group.rewards || []).filter(reward => reward.type === "ship").map(reward => ({ group: group.title, probability: Number(group.probabilityDisplayed ?? group.probability), reward }))));
}
function groupId(title) {
  if (/^Tier V[–-]X ship$/.test(title)) return "rare";
  if (/^Tier VIII[–-]IX ship$/.test(title)) return "high";
  if (/^Tier V[–-]VIII? ship$/.test(title)) return "low";
  throw new Error("Unknown official Santa group: " + title);
}
function buildPool(edition, zh, en, mega, ultra) {
  const english = shipEntries(en);
  const enById = new Map(english.map(entry => [String(entry.reward.id), entry]));
  const groups = ["rare", "high", "low"].map(id => {
    const entries = english.filter(entry => groupId(entry.group) === id);
    if (!entries.length) throw new Error("Missing Santa group: " + id);
    const probabilities = { gift: entries[0].probability };
    for (const [kind, data] of [["mega", mega], ["ultra", ultra]]) {
      const peers = shipEntries(data).filter(entry => groupId(entry.group) === id);
      const ids = entries.map(entry => String(entry.reward.id)).sort();
      if (JSON.stringify(peers.map(entry => String(entry.reward.id)).sort()) !== JSON.stringify(ids)) throw new Error("Santa group membership differs: " + kind + ":" + id);
      probabilities[kind] = peers[0].probability;
    }
    if (!Object.values(probabilities).every(p => Number.isFinite(p) && p > 0 && p <= 100)) throw new Error("Invalid Santa group probability");
    const range = entries[0].group.match(/Tier (.+) ship/)[1];
    return { id, label: id === "rare" ? "稀有及 X 级" : range + " 级", officialTitle: entries[0].group, probabilities };
  });
  const ships = shipEntries(zh).map(({ reward }) => {
    const englishEntry = enById.get(String(reward.id));
    if (!englishEntry) throw new Error("Missing English Santa ship: " + reward.id);
    const id = groupId(englishEntry.group);
    return { id: Number(reward.id), name: reward.additionalData?.title || String(reward.id), englishName: englishEntry.reward.additionalData?.title || "",
      tier: Number(reward.additionalData?.level) || 0, nation: reward.additionalData?.nation?.name || "", type: reward.additionalData?.type?.name || "",
      groupId: id, group: groups.find(group => group.id === id).label };
  });
  if (ships.length !== edition.expected || new Set(ships.map(ship => ship.id)).size !== ships.length) throw new Error("Unexpected Santa lineup size");
  return { year: edition.year, containerId: edition.containerId, sourceUrl: edition.article,
    probabilitySources: { gift: edition.containerId, mega: edition.megaId, ultra: edition.ultraId }, groups, ships };
}
async function main() {
  const pools = [];
  for (const edition of editions) {
    const tables = await Promise.all([container(edition.containerId, "zh-sg"), container(edition.containerId, "en"), container(edition.megaId, "en"), container(edition.ultraId, "en")]);
    const pool = buildPool(edition, ...tables);
    pools.push(pool);
    process.stdout.write(edition.year + ": " + pool.ships.length + " ships in " + pool.groups.length + " official groups\n");
  }
  await fs.writeFile(path.join(__dirname, "..", "data", "christmas-pools.json"), JSON.stringify({ updatedAt: new Date().toISOString(), pools }, null, 2) + "\n");
}
if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
module.exports = { shipEntries, groupId, buildPool, editions };
