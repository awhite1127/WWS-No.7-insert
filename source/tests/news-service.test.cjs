"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { createNewsService, parseBlog, parseNews, parseDetail, parseChineseArticle, recentDate, officialUrl, INTERVAL } = require("../electron/news-service.cjs");
const NOW = Date.parse("2026-09-29T12:00:00Z");
const blog = { items: [{ id: 1, title: "Closed Test 15.8 - Changes to Test ships", slug: "changes", publication_date: "2026-09-24 10:00:00", categories: ["Test Ships Changes"], short_content: "<p>Based on testing results, we are applying changes to the ships Arag&oacute;n and New Jersey:</p>" }] };
const news = { items: [
  { id: 2, title: "15.8版本：荣耀十一载", description: "版本内容", slug: "update-158-11-years-of-glory", category: 21, published_at: Date.parse("2026-09-24") / 1000 },
  { id: 3, title: "开发汇报：15.9版本", description: "版本预告", slug: "work-in-progress-159", category: 20, published_at: Date.parse("2026-09-25") / 1000 },
  { id: 4, title: "中秋活动", description: "参与活动", slug: "mid-autumn", category: 4, published_at: Date.parse("2026-09-24") / 1000 },
  { id: 5, title: "15.8版本：预告片", description: "视频", slug: "update-158-teaser", category: 21, published_at: Date.parse("2026-09-24") / 1000 },
] };
const categories = { items: [{ id: 4, slug: "sales-and-events" }, { id: 20, slug: "work-in-progress" }, { id: 21, slug: "game-updates" }] };
test("ship summaries use official Chinese names and activity feed only includes major updates", () => {
  const ships = parseBlog(blog), events = parseNews(news, categories);
  assert.match(ships[0].title, /封闭测试/);
  assert.match(ships[0].summary, /阿拉贡、新泽西/);
  assert.deepEqual(events.map(item => item.id), ["news-2", "news-3"]);
  assert(events.every(item => officialUrl(item.url)));
});
test("detail uses ship ID for Chinese names and retains individual parameters", () => {
  const lines = parseDetail('<p><span class="ship" ship-id="3530470832">IX Aragón</span>:</p><ul><li>\n<p>Damage increased: 10 to 20.</p></li></ul>');
  assert.deepEqual(lines, ["IX 阿拉贡:", "• Damage increased: 10 to 20."]);
});
test("two calendar months includes cutoff and excludes older or future dates", () => {
  assert(recentDate("2026-07-29", NOW));
  assert(!recentDate("2026-07-28", NOW));
  assert(!recentDate("2026-09-30", NOW));
  assert(recentDate("2026-02-28", Date.parse("2026-04-30T12:00:00Z")));
  assert(!recentDate("2026-02-27", Date.parse("2026-04-30T12:00:00Z")));
});
test("news links only allow HTTPS official articles", () => {
  for (const url of ["javascript:alert(1)", "https://worldofwarships.asia.evil.com/zh-sg/news/x", "https://x@worldofwarships.asia/zh-sg/news/x", "http://blog.worldofwarships.com/blog/x"]) assert.equal(officialUrl(url), false);
  assert(officialUrl("https://blog.worldofwarships.com/blog/changes"));
});
test("refresh deduplicates, respects TTL, retains failed source, and loads details", async () => {
  let time = NOW, count = 0, failBlog = false;
  const service = createNewsService({ now: () => time, fetchImpl: async url => {
    count++;
    if (failBlog && url.includes("blog.") && !url.includes("/api/posts/changes/")) throw Error("offline");
    const body = url.includes("/api/posts/changes/") ? { content: '<p><span class="ship" ship-id="3530470832">IX Aragón</span>:</p><ul><li>Maximum damage increased: 10 to 20</li></ul>' } : url.includes("blog.") ? blog : url.includes("categories") ? categories : news;
    return { ok: true, json: async () => body };
  } });
  const [first, second] = await Promise.all([service.get(), service.get(true)]);
  assert.deepEqual(first, second);
  assert.equal(count, 3);
  assert.equal(first.items.length, 3);
  const detail = await service.detail(first.items.find(item => item.category === "ships").url);
  assert.match(detail.join(" "), /阿拉贡.*最大伤害提高：10 → 20/);
  await service.detail(first.items.find(item => item.category === "ships").url);
  assert.equal(count, 4);
  await service.get(); assert.equal(count, 4);
  time += INTERVAL + 1; failBlog = true;
  const partial = await service.get();
  assert.equal(partial.items.length, 3);
  assert(partial.sources[0].error);
  assert.equal(partial.sources[1].error, "");
});
test("offline startup drops old and unrelated bundled news", async () => {
  const seed = { items: [
    ...parseBlog(blog),
    ...parseNews(news, categories),
    { id: "old", category: "ships", publishedAt: "2026-07-28", url: "https://blog.worldofwarships.com/blog/old" },
    { id: "event", category: "events", stage: "活动资讯", publishedAt: "2026-09-24", url: "https://worldofwarships.asia/zh-sg/news/sales-and-events/event/" },
  ], sources: [{ category: "ships", updatedAt: 123, error: "" }] };
  const service = createNewsService({ now: () => NOW, seed, fetchImpl: async () => { throw Error("offline"); } });
  const result = await service.get();
  assert.equal(result.items.length, 3);
  assert.equal(result.sources[0].updatedAt, 123);
  assert(result.sources.every(source => source.error));
});

test("ship balance detail translates the announcement text into Chinese", () => {
  const { translateShipDetail } = require("../electron/news-detail-zh.cjs");
  const lines = translateShipDetail(["Captains!", "IX 阿拉贡:", "• Bonus to maximum main battery shell dispersion increased: -25 to -32%", "• Detectability range by sea increased: 5.24 to 5.8km"]);
  assert.match(lines.join(" "), /舰长们/);
  assert.match(lines.join(" "), /主炮炮弹最大散布加成提高：-25 → -32%/);
  assert.match(lines.join(" "), /海上被发现距离提高：5.24 → 5.8千米/);
  assert(!lines.join(" ").includes("Captains"));
});
test("standard and interactive version updates both provide Chinese detail", async () => {
  const requested = [];
  const service = createNewsService({ renderOfficialPage: async url => {
    assert.match(url, /update-158-11-years-of-glory/);
    return ["15.8版本：荣耀十一载", "新增周年纪念活动", "Read more"];
  }, fetchImpl: async url => {
    requested.push(url);
    const body = url.includes("update-158-11-years-of-glory") ? { is_custom: true } : { is_custom: false };
    return { ok: true, json: async () => body, text: async () => "<style>.x{color:red}</style><p>15.9版本公开测试</p><p>新增太平洋战线活动。</p><p>Read more</p>" };
  } });
  const custom = await service.detail("https://worldofwarships.asia/zh-sg/news/game-updates/update-158-11-years-of-glory/");
  assert.deepEqual(custom, ["15.8版本：荣耀十一载", "新增周年纪念活动"]);
  const standard = await service.detail("https://worldofwarships.asia/zh-sg/news/work-in-progress/work-in-progress-159/");
  assert.deepEqual(standard, ["15.9版本公开测试", "新增太平洋战线活动。"]);
  assert(requested.some(url => url.includes("/content/?consumer=pc-browser&lang=zh-sg")));
  assert.deepEqual(parseChineseArticle("<component is=\"style\">body{color:red}</component><p>简中正文</p>"), ["简中正文"]);
});
