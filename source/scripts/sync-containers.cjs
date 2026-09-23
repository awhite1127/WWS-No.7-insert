"use strict";

const fs = require("node:fs");
const path = require("node:path");
const glossary = require("../data/wg-zh-sg-glossary.json");

const listUrl = "https://worldofwarships.com/papi/v1/container/?lang=en";
const detailBase = "https://vortex.worldofwarships.com/api/get_lootbox/zh-sg/";

async function fetchJson(url) {
  let lastError;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(url, { headers: { "User-Agent": "No7Insert/0.1.3" }, signal: AbortSignal.timeout(30000) });
      if (!response.ok) throw new Error(`${response.status} ${url}`);
      return response.json();
    } catch (error) {
      lastError = error;
      if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 750 * (attempt + 1)));
    }
  }
  throw lastError;
}

async function main() {
  const list = await fetchJson(listUrl);
  if (!Array.isArray(list.items) || !list.items.length) throw new Error("Official container list is empty");
  const previousPath = path.join(__dirname, "..", "data", "container-catalog.json");
  const items = new Array(list.items.length);
  let cursor = 0;
  let failed = 0;
  const missingNames = new Map();
  const unresolvedNames = new Map();
  const listedIds = new Set(list.items.map((item) => String(item.id)));
  async function worker() {
    while (cursor < list.items.length) {
      const index = cursor++;
      const item = list.items[index];
      let title;
      try {
        const detail = await fetchJson(detailBase + encodeURIComponent(item.id) + "/");
        title = detail.data?.title || detail.data?.shortTitle;
        if (process.argv.includes("--audit")) {
          for (const slot of detail.data?.slots || []) {
            for (const record of [slot.commonRewards, slot.valuableRewards]) {
              for (const group of Object.values(record || {})) {
                for (const reward of group.rewards || []) {
                  const rewardId = String(reward.id);
                  if (reward.id != null && !reward.additionalData?.title
                    && !glossary.items[rewardId] && !glossary.albums[rewardId]
                    && !glossary.ships[rewardId] && !listedIds.has(rewardId)) {
                    const count = unresolvedNames.get(reward.type)?.count || 0;
                    unresolvedNames.set(reward.type, { count: count + 1, sample: reward });
                  }
                  if (reward.additionalData?.title) continue;
                  const count = missingNames.get(reward.type)?.count || 0;
                  missingNames.set(reward.type, { count: count + 1, sample: reward });
                }
              }
            }
          }
        }
      } catch (error) {
        failed += 1;
        console.warn(`Could not localize container ${item.id}: ${error.message}`);
      }
      items[index] = { id: String(item.id), title: title || item.mark, englishName: item.mark };
    }
  }
  await Promise.all(Array.from({ length: 8 }, worker));
  if (failed) throw new Error(`Failed to localize ${failed} containers; catalog not replaced`);
  fs.mkdirSync(path.dirname(previousPath), { recursive: true });
  fs.writeFileSync(previousPath, JSON.stringify({ updatedAt: new Date().toISOString(), source: listUrl, items }, null, 2) + "\n");
  console.log(`Saved ${items.length} official containers to ${previousPath}`);
  if (process.argv.includes("--audit")) {
    for (const [type, entry] of [...missingNames].sort((a, b) => b[1].count - a[1].count)) {
      console.log(type, entry.count, JSON.stringify(entry.sample).slice(0, 500));
    }
    console.log("Unresolved IDs:");
    for (const [type, entry] of [...unresolvedNames].sort((a, b) => b[1].count - a[1].count)) {
      console.log(type, entry.count, JSON.stringify(entry.sample).slice(0, 500));
    }
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
