"use strict";
const fs = require("node:fs/promises");
const path = require("node:path");
const { translateShipDetail } = require("./news-detail-zh.cjs");
const INTERVAL = 30 * 60 * 1000;
const BLOG = "https://blog.worldofwarships.com";
const NEWS = "https://worldofwarships.asia";
const chineseShips = require("../data/wg-zh-sg-glossary.json").ships;
const englishShips = require("../data/wg-en-ship-names.json").ships;
const aliases = Object.entries(englishShips).flatMap(([id, english]) => {
  const chinese = chineseShips[id]?.title;
  if (!chinese) return [];
  const variants = [english];
  if (/^Almirante /i.test(english)) variants.push(english.replace(/^Almirante /i, ""));
  return variants.map(name => [name, chinese]);
}).sort((a, b) => b[0].length - a[0].length);
const namePattern = new RegExp("(?<![\\p{L}\\p{N}])(?:" + aliases.map(([name]) => name.replace(/[.*+?^$()|[\]{}\\]/g, "\\$&")).join("|") + ")(?![\\p{L}\\p{N}])", "giu");
const chineseByEnglish = new Map(aliases.map(([english, chinese]) => [english.toLocaleLowerCase(), chinese]));
function localizeShips(value) { return String(value || "").replace(namePattern, name => chineseByEnglish.get(name.toLocaleLowerCase()) || name); }
function plain(value) {
  const entities = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", iacute: "í", eacute: "é", Eacute: "É", oslash: "ø", Oslash: "Ø", ouml: "ö", auml: "ä", uuml: "ü", ntilde: "ñ", oacute: "ó", eacute: "é", uacute: "ú", aacute: "á", mdash: "—", ndash: "–", rsquo: "’" };
  return String(value || "").replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "").replace(/<[^>]*>/g, " ").replace(/&(#x[\da-f]+|#\d+|\w+);/gi, (m, k) => {
    if (k[0] !== "#") return entities[k] ?? m;
    const n = k[1].toLowerCase() === "x" ? parseInt(k.slice(2), 16) : Number(k.slice(1));
    return n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : "";
  }).replace(/\s+/g, " ").trim();
}
function officialUrl(value) {
  try { const u = new URL(value); return u.protocol === "https:" && !u.username && !u.password && !u.port && ((u.hostname === "blog.worldofwarships.com" && u.pathname.startsWith("/blog/")) || (u.hostname === "worldofwarships.asia" && u.pathname.startsWith("/zh-sg/news/"))); } catch { return false; }
}
function recentDate(value, timestamp) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return false;
  const date = new Date(value + "T00:00:00Z");
  const today = new Date(timestamp);
  const monthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 2, 1));
  const monthEnd = new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 0)).getUTCDate();
  const cutoff = new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth(), Math.min(today.getUTCDate(), monthEnd)));
  return !Number.isNaN(date.getTime()) && date >= cutoff && date.getTime() <= timestamp;
}
function isMajorUpdate(post) {
  const slug = String(post.slug || "");
  return (post.category === 20 && /^work-in-progress-\d+(?:-|$)/i.test(slug)) || (post.category === 21 && /^update-\d+(?:-|$)/i.test(slug) && !/(?:teaser|trailer)/i.test(slug));
}
function parseBlog(data) {
  if (!Array.isArray(data?.items) || !data.items.length) throw new Error("开发日志返回了空目录");
  return data.items.filter(p => /Balance Changes|Test Ships Changes|New Ships/i.test((p.categories || []).join(" "))).map(p => {
    const title = plain(p.title).replace(/Changes to Test ships/gi, "测试舰船调整").replace(/Balance Changes/gi, "舰船平衡性调整").replace(/New Ships/gi, "新舰船预告").replace(/Closed test/gi, "封闭测试").replace(/Public test/gi, "公开测试");
    const short = plain(p.short_content);
    const candidate = short.match(/(?:changes to (?:the ships|ships)|changes to)\s+(.+?)(?:\.|:|$)/i)?.[1];
    const mentioned = candidate && !/^(?:a |an |the new|new )/i.test(candidate) && !/which will|based on|mechanic/i.test(candidate) ? candidate.trim() : null;
    const version = (p.categories || []).find(c => /^\d+\.\d+$/.test(c));
    const summary = mentioned ? "本次测试调整涉及：" + localizeShips(mentioned.replace(/as well as balance adjustments for/gi, "同时调整").replace(/,?\s+and\s+/g, "、").replace(/,\s*/g, "、").replace("、同时调整", "；同时调整").replace(/同时调整\s+/g, "同时调整")) + "。点击查看详细改动。" : (version ? version + " 版本" : "开发测试") + "的" + (/New Ships/i.test(p.title) ? "新舰船开发预告" : "舰船平衡性调整报告") + "。点击查看详细改动。";
    return { id: "blog-" + p.id, category: "ships", title, originalTitle: plain(p.title), summary, publishedAt: String(p.publication_date).slice(0, 10), url: BLOG + "/blog/" + encodeURIComponent(p.slug), source: "开发者日志", language: "中文翻译 · 英文原文", stage: /Closed/i.test(p.title) ? "封闭测试" : /Public/i.test(p.title) ? "公开测试" : "开发预告", important: false };
  });
}
function parseNews(data, categories) {
  if (!Array.isArray(data?.items) || !data.items.length || !Array.isArray(categories?.items)) throw new Error("官方新闻返回了无效目录");
  const lookup = new Map(categories.items.map(c => [c.id, c.slug]));
  return data.items.filter(isMajorUpdate).map(p => ({ id: "news-" + p.id, category: "events", title: plain(p.title), originalTitle: "", summary: plain(p.description), publishedAt: new Date(p.published_at * 1000).toISOString().slice(0, 10), url: NEWS + "/zh-sg/news/" + lookup.get(p.category) + "/" + encodeURIComponent(p.slug) + "/", source: "亚服官网", language: "官方简体中文", stage: p.category === 20 ? "开发汇报" : "版本更新", important: p.label === "important" })).filter(p => !p.url.includes("/undefined/"));
}
function parseDetail(content) {
  if (typeof content !== "string") return [];
  const html = content.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<span\b(?=[^>]*\bship-id=["'](\d+)["'])[^>]*>[\s\S]*?<\/span>/gi, (match, id) => { const label = plain(match); const tier = label.match(/^(?:X|IX|VIII|VII|VI|V|IV|III|II|I)\s+/)?.[0] || ""; return chineseShips[id]?.title ? tier + chineseShips[id].title : label; })
    .replace(/<li\b[^>]*>/gi, "\n• ").replace(/<\/p\s*>|<\/li\s*>|<\/h[1-6]\s*>/gi, "\n")
    .replace(/<br\s*\/?\s*>/gi, "\n");
  const lines = html.split("\n").map(line => localizeShips(plain(line))).filter(Boolean);
  return lines.reduce((result, line) => {
    if (result.at(-1) === "•") result[result.length - 1] = "• " + line;
    else result.push(line);
    return result;
  }, []);
}
function parseChineseArticle(content) {
  if (typeof content !== "string") return [];
  const html = content.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<component\b[^>]*is=["']style["'][^>]*>[\s\S]*?<\/component>/gi, "")
    .replace(/<\/p\s*>|<\/li\s*>|<\/h[1-6]\s*>|<br\s*\/?\s*>|<\/div\s*>/gi, "\n");
  return html.split("\n").map(plain).filter(line => /[\p{Script=Han}]/u.test(line) && line.length < 2000);
}
function cleanRenderedArticle(lines) {
  return lines.map(line => localizeShips(String(line).trim())).filter(line => /[\p{Script=Han}]/u.test(line) && line.length < 2000);
}
function createNewsService({ cacheFile, fetchImpl = fetch, now = Date.now, seed = { items: [], sources: [] }, renderOfficialPage } = {}) {
  let snapshot = structuredClone(seed), pending, lastAttempt = 0, initialized = false;
  const details = new Map();
  const eligible = item => officialUrl(item.url) && recentDate(item.publishedAt, now()) && (item.category === "ships" || (item.category === "events" && ((item.stage === "开发汇报" && /\/work-in-progress-\d+(?:-|\/)/.test(item.url)) || (item.stage === "版本更新" && /\/update-\d+(?:-|\/)/.test(item.url) && !/(?:teaser|trailer)/i.test(item.url)))));
  const clean = items => items.filter(eligible).map(item => item.category === "ships" ? { ...item, summary: localizeShips(item.summary).replace(/(?:具体参数|详细舰船参数与变更说明)请查看官方原文。/, "点击查看详细改动。"), language: "中文翻译 · 英文原文" } : item);
  async function json(url) {
    const response = await fetchImpl(url, { signal: AbortSignal.timeout(15000), headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error("HTTP " + response.status);
    return response.json();
  }
  async function content(url) {
    const response = await fetchImpl(url, { signal: AbortSignal.timeout(15000), headers: { Accept: "text/html" } });
    if (!response.ok) throw new Error("HTTP " + response.status);
    return response.text();
  }
  async function eventDetail(url) {
    const slug = decodeURIComponent(new URL(url).pathname.split("/").filter(Boolean).at(-1));
    if (!/^[a-z0-9-]+$/.test(slug)) throw new Error("无效的文章标识");
    const api = NEWS + "/papi/v1/news/" + encodeURIComponent(slug);
    const article = await json(api + "/?consumer=pc-browser&lang=zh-sg");
    let lines;
    if (article.is_custom) {
      if (typeof renderOfficialPage !== "function") throw new Error("当前无法加载互动版文章");
      lines = cleanRenderedArticle(await renderOfficialPage(url));
    } else {
      lines = parseChineseArticle(await content(api + "/content/?consumer=pc-browser&lang=zh-sg"));
    }
    if (!lines.length) throw new Error("官网暂未提供简体中文正文");
    return lines;
  }
  async function update() {
    if (!initialized) {
      initialized = true;
      if (cacheFile) try {
        const saved = JSON.parse(await fs.readFile(cacheFile, "utf8"));
        if (Array.isArray(saved.items) && Array.isArray(saved.sources) && saved.items.every(i => officialUrl(i.url))) snapshot = saved;
      } catch { /* Keep bundled snapshot on first run or damaged cache. */ }
    }
    lastAttempt = now();
    const results = await Promise.allSettled([
      json(BLOG + "/api/posts/?limit=100").then(parseBlog),
      Promise.all([json(NEWS + "/papi/v1/news/?lang=zh-sg&limit=100"), json(NEWS + "/papi/v1/categories/?lang=zh-sg")]).then(([data, categories]) => parseNews(data, categories)),
    ]);
    const sources = [], items = [];
    for (const [index, category] of ["ships", "events"].entries()) {
      const result = results[index], old = snapshot.sources.find(s => s.category === category);
      if (result.status === "fulfilled") { items.push(...result.value); sources.push({ category, updatedAt: now(), error: "" }); }
      else { items.push(...clean(snapshot.items.filter(i => i.category === category))); sources.push({ category, updatedAt: old?.updatedAt || 0, error: "暂时无法更新，保留上次内容" }); }
    }
    snapshot = { items: [...new Map(clean(items).map(i => [i.id, i])).values()].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)).slice(0, 60), sources, checkedAt: now() };
    if (cacheFile) try { await fs.mkdir(path.dirname(cacheFile), { recursive: true }); await fs.writeFile(cacheFile + ".tmp", JSON.stringify(snapshot)); await fs.rename(cacheFile + ".tmp", cacheFile); } catch { /* Read-only profiles still display fetched news. */ }
    return snapshot;
  }
  return {
    async detail(url) {
      if (!officialUrl(url)) throw new Error("无效的官方文章链接");
      if (details.has(url)) return details.get(url);
      if (url.startsWith(NEWS + "/zh-sg/news/")) {
        const lines = await eventDetail(url);
        details.set(url, lines);
        return lines;
      }
      const slug = decodeURIComponent(new URL(url).pathname.slice("/blog/".length));
      if (!/^[a-z0-9-]+$/.test(slug)) throw new Error("无效的文章标识");
      const post = await json(BLOG + "/api/posts/" + encodeURIComponent(slug) + "/");
      const lines = translateShipDetail(parseDetail(post.content), /New Ships/i.test(post.title || ""));
      if (!lines.length) throw new Error("官方文章暂未提供详细内容");
      details.set(url, lines);
      return lines;
    },
    get(force = false) {
      if (pending) return pending;
      if (initialized && now() - lastAttempt < (force ? 10000 : INTERVAL)) return Promise.resolve({ ...snapshot, items: clean(snapshot.items) });
      pending = update().finally(() => { pending = undefined; });
      return pending;
    },
  };
}
module.exports = { createNewsService, parseBlog, parseNews, parseDetail, parseChineseArticle, localizeShips, recentDate, officialUrl, INTERVAL };
