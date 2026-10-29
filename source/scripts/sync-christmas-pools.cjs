"use strict";

// Use the latest devblog lineup and resolve IDs through WG's ship glossary.
// Classification comes from the drop-table group, never from a ship's tier.
const fs = require("node:fs/promises");
const path = require("node:path");
const BLOG_SLUG = "closed-test-1511-new-year-celebrations-santas-gifts-and-the-ice-station-port";
const BLOG_URL = `https://blog.worldofwarships.com/blog/${BLOG_SLUG}`;

function plainText(html) {
  return html.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ")
    .replace(/&([A-Za-z]+);/g, (_, entity) => ({ amp: "&", quot: '"', apos: "'", rsquo: "’", aacute: "á", Aacute: "Á", eacute: "é", iacute: "í", uacute: "ú", uuml: "ü", Uuml: "Ü", auml: "ä", Aring: "Å", aring: "å" })[entity] ?? `&${entity};`)
    .trim();
}
function normalizedName(name) {
  return name.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().replace(/ł/g, "l").replace(/[^a-z0-9]/g, "");
}
function blogGroups(content, heading) {
  const start = content.indexOf(heading + "</div>");
  if (start < 0) throw new Error("Missing Santa container: " + heading);
  const end = content.indexOf('<div class="spoiler-title">', start + heading.length);
  const section = content.slice(start, end < 0 ? undefined : end);
  const matches = [...section.matchAll(/One of the following ships\s*-\s*([\d.]+)%:[\s\S]*?<ul>([\s\S]*?)<\/ul>/g)];
  if (matches.length !== 3) throw new Error("Expected three Santa ship groups: " + heading);
  return matches.map((match, index) => ({
    id: ["rare", "high", "low"][index], probability: Number(match[1]),
    ships: [...match[2].matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/g)].flatMap(row => {
      // The Mega table places the compensation paragraph inside its last list item.
      const line = plainText(row[1]).split("If you already own")[0].trim().match(/^Tier (VIII|VII|VI|IX|X|V):\s*(.+)$/);
      if (!line) throw new Error("Unrecognized Santa tier: " + plainText(row[1]));
      const tier = { V: 5, VI: 6, VII: 7, VIII: 8, IX: 9, X: 10 }[line[1]];
      return line[2].split(",").map(name => ({ name: name.trim(), tier }));
    }),
  }));
}
async function glossary(locale) {
  const response = await fetch("https://vortex.worldofwarships.com/api/graphql/glossary/", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: `query { vehicles(lang: "${locale}") { id title level nation { name } type { name } } }` }),
    signal: AbortSignal.timeout(60000),
  });
  if (!response.ok) throw new Error(`WG glossary: HTTP ${response.status}`);
  const body = await response.json();
  if (!body.data?.vehicles?.length || body.errors?.length) throw new Error("Invalid WG ship glossary");
  return body.data.vehicles;
}
function buildBlogPool(article, english, chinese) {
  const variants = ["Santa's Gift container", "Santa's Mega Gift container", "Santa's Ultra Gift container"].map(title => blogGroups(article.content, title));
  const names = new Map(english.map(ship => [normalizedName(ship.title), ship]));
  const localized = new Map(chinese.map(ship => [String(ship.id), ship.title]));
  const groups = variants[0].map((group, index) => {
    for (const variant of variants.slice(1)) {
      if (JSON.stringify(variant[index].ships) !== JSON.stringify(group.ships)) throw new Error("Santa variant membership differs");
    }
    return { id: group.id, label: ["稀有及 X 级", "VIII–IX 级", "V–VIII 级"][index],
      officialTitle: ["Tier V–X ship", "Tier VIII–IX ship", "Tier V–VIII ship"][index],
      probabilities: { gift: group.probability, mega: variants[1][index].probability, ultra: variants[2][index].probability } };
  });
  const ships = variants[0].flatMap((group, index) => group.ships.map(entry => {
    const ship = names.get(normalizedName(entry.name));
    if (!ship || Number(ship.level) !== entry.tier) throw new Error("Unresolved Santa ship: " + entry.name);
    return { id: Number(ship.id), name: localized.get(String(ship.id)) || ship.title, englishName: ship.title,
      tier: entry.tier, nation: ship.nation.name, type: ship.type.name, groupId: group.id, group: groups[index].label };
  }));
  if (ships.length !== 143 || new Set(ships.map(ship => ship.id)).size !== ships.length) throw new Error("Unexpected 2026 Santa lineup");
  return { year: 2026, sourceUrl: BLOG_URL, publishedAt: article.publication_date,
    probabilitySources: { gift: BLOG_URL, mega: BLOG_URL, ultra: BLOG_URL }, groups, ships };
}
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
  const response = await fetch(`https://blog.worldofwarships.com/api/posts/${BLOG_SLUG}/`, { signal: AbortSignal.timeout(60000) });
  if (!response.ok) throw new Error(`WG devblog: HTTP ${response.status}`);
  const article = await response.json();
  const [english, chinese] = await Promise.all([glossary("en"), glossary("zh-sg")]);
  const pool = buildBlogPool(article, english, chinese);
  const output = path.join(__dirname, "..", "data", "christmas-pools.json");
  const previous = JSON.parse(await fs.readFile(output, "utf8"));
  const pools = [pool, ...previous.pools.filter(item => item.year !== pool.year)];
  await fs.writeFile(output, JSON.stringify({ updatedAt: new Date().toISOString(), pools }, null, 2) + "\n");
  process.stdout.write(pool.year + ": " + pool.ships.length + " ships in " + pool.groups.length + " official groups\n");
}
if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
module.exports = { shipEntries, groupId, buildPool, editions, blogGroups, buildBlogPool };
