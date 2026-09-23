"use strict";

const fs = require("node:fs");
const path = require("node:path");

const listUrl = "https://worldofwarships.asia/papi/v1/container/?lang=en";
const detailBase = "https://vortex.worldofwarships.asia/api/get_lootbox/zh-cn/";

async function fetchJson(url) {
  const response = await fetch(url, { headers: { "User-Agent": "No7Insert/0.1.2" }, signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return response.json();
}

async function main() {
  const list = await fetchJson(listUrl);
  if (!Array.isArray(list.items) || !list.items.length) throw new Error("Official container list is empty");
  const previousPath = path.join(__dirname, "..", "data", "container-catalog.json");
  const previous = fs.existsSync(previousPath) ? JSON.parse(fs.readFileSync(previousPath, "utf8")) : { items: [] };
  const known = new Map(previous.items.map((item) => [item.id, item]));
  const items = new Array(list.items.length);
  let cursor = 0;
  let failed = 0;
  async function worker() {
    while (cursor < list.items.length) {
      const index = cursor++;
      const item = list.items[index];
      let title = known.get(String(item.id))?.title;
      if (!title) {
        try {
          const detail = await fetchJson(detailBase + encodeURIComponent(item.id) + "/");
          title = detail.data?.title || detail.data?.shortTitle;
        } catch (error) {
          failed += 1;
          console.warn(`Could not localize container ${item.id}: ${error.message}`);
        }
      }
      items[index] = { id: String(item.id), title: title || item.mark, englishName: item.mark };
    }
  }
  await Promise.all(Array.from({ length: 12 }, worker));
  if (failed) throw new Error(`Failed to localize ${failed} containers; catalog not replaced`);
  fs.mkdirSync(path.dirname(previousPath), { recursive: true });
  fs.writeFileSync(previousPath, JSON.stringify({ updatedAt: new Date().toISOString(), source: listUrl, items }, null, 2) + "\n");
  console.log(`Saved ${items.length} official containers to ${previousPath}`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
