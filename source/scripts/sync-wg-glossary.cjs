"use strict";

const fs = require("node:fs");
const path = require("node:path");

const source = "https://vortex.worldofwarships.com/api/graphql/glossary/";
const query = `query OfficialSimplifiedChinese($languageCode: String) {
  vehicles(lang: $languageCode) { id title level }
  items(lang: $languageCode) { id title }
  collectibleAlbum(lang: $languageCode) { id title }
  version
}`;

async function main() {
  const response = await fetch(source, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json", "User-Agent": "No7Insert/0.1.3" },
    body: JSON.stringify({ query, variables: { languageCode: "zh-sg" } }),
    signal: AbortSignal.timeout(90000),
  });
  if (!response.ok) throw new Error(`WG glossary HTTP ${response.status}`);
  const result = await response.json();
  if (result.errors?.length) throw new Error(result.errors[0].message);
  const data = result.data;
  if (!data?.vehicles?.length || !data?.items?.length || !data?.collectibleAlbum?.length) {
    throw new Error("WG glossary returned incomplete data");
  }
  const names = (entries, value) => Object.fromEntries(entries
    .filter((entry) => entry.id != null && entry.title)
    .sort((a, b) => Number(a.id) - Number(b.id))
    .map((entry) => [String(entry.id), value(entry)]));
  const catalog = {
    updatedAt: new Date().toISOString(),
    source,
    locale: "zh-sg",
    version: data.version,
    ships: names(data.vehicles, (entry) => ({ title: entry.title, level: Number(entry.level) || null })),
    items: names(data.items, (entry) => entry.title),
    albums: names(data.collectibleAlbum, (entry) => entry.title),
  };
  const output = path.join(__dirname, "..", "data", "wg-zh-sg-glossary.json");
  fs.writeFileSync(output, JSON.stringify(catalog, null, 2) + "\n");
  console.log(`Saved ${Object.keys(catalog.ships).length} ships, ${Object.keys(catalog.items).length} items, ${Object.keys(catalog.albums).length} albums to ${output}`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
