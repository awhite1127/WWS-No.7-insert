"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");

// christmas-pools
{
  const { shipEntries, groupId } = require("../scripts/sync-christmas-pools.cjs");
  const { pools: [pool] } = require("../data/christmas-pools.json");
  test("Santa ships are grouped by official drop table rather than ship tier", () => {
    assert.deepEqual(pool.groups.map(g => g.id), ["rare", "high", "low"]);
    assert.deepEqual(pool.groups.map(g => pool.ships.filter(s => s.groupId === g.id).length), [42, 53, 48]);
    assert.equal(pool.ships.length, 143);
    assert.equal(new Set(pool.ships.map(s => s.id)).size, 143);
    assert.equal(pool.ships.find(s => s.englishName === "Theseus").groupId, "low");
    assert.equal(pool.ships.find(s => s.englishName === "Smolensk").groupId, "rare");
    assert.ok(pool.ships.some(s => s.groupId === "rare" && s.tier < 8));
    assert.ok(pool.ships.every(s => pool.groups.some(g => g.id === s.groupId && g.label === s.group)));
  });
  test("Santa group probabilities match WG's gift, mega and ultra tables", () => {
    assert.deepEqual(pool.groups.map(g => g.probabilities), [{ gift: 0.1, mega: 1, ultra: 3 }, { gift: 0.4, mega: 3, ultra: 9 }, { gift: 2, mega: 12, ultra: 20 }]);
    assert.deepEqual(pool.probabilitySources, { gift: "4016231344", mega: "4015182768", ultra: "4014134192" });
  });
  test("Santa sync reads the group probability and rejects unknown classifications", () => {
    const reward = { id: "1", type: "ship", probability: 99 };
    const data = { slots: [{ valuableRewards: { rare: { title: "Tier V–X ship", probability: "0.1", rewards: [reward, { type: "credits" }] } } }] };
    assert.deepEqual(shipEntries(data), [{ group: "Tier V–X ship", probability: 0.1, reward }]);
    assert.equal(groupId("Tier V–X ship"), "rare");
    assert.equal(groupId("Tier VIII–IX ship"), "high");
    assert.equal(groupId("Tier V–VIII ship"), "low");
    assert.equal(groupId("Tier V–VII ship"), "low");
    assert.throws(() => groupId("Unknown"), /Unknown official/);
  });
}

// containers
{

  const { normalizeContainer } = require("../electron/containers.cjs");
  const catalog = require("../data/container-catalog.json");

  test("keeps item probabilities separate from reward-group probabilities", () => {
    const details = normalizeContainer({
      id: 42,
      title: "测试补给箱",
      slots: [{
        commonRewards: { list0: { rewards: [
          { type: "coal", amount: 7500, probabilityDisplayed: 10 },
        ] } },
        valuableRewards: { list1: { title: "金币战舰", probabilityDisplayed: 2, rewards: [
          { type: "ship", id: 1, amount: 1, additionalData: { title: "甲舰" } },
          { type: "ship", id: 2, amount: 1, additionalData: { title: "乙舰" } },
        ] } },
      }],
    }, "asia");
    assert.equal(details.slots[0].groups[0].rewards[0].probability, 10);
    assert.equal(details.slots[0].groups[1].probability, 2);
    assert.equal(details.slots[0].groups[1].rewards[0].probability, null);
    assert.equal(details.slots[0].groups[1].rewards[0].name, "甲舰");
  });

  test("uses WG international simplified Chinese for container titles and ship rewards", () => {
    assert.equal(catalog.items.find((item) => item.id === "4002599856").title, "“星条曙光”补给箱");
    const details = normalizeContainer({
      id: 4059222960,
      title: "“特级快递：战斗支援物资”高级补给箱",
      slots: [{ valuableRewards: { ships: {
        title: "IX级加值战舰",
        probabilityDisplayed: 1.9,
        rewards: [{ type: "ship", id: 3436099280, amount: 1, additionalData: { title: "BA高梁", level: 9 } }],
      } } }],
    }, "asia");
    assert.equal(details.slots[0].groups[0].title, "金币战舰");
    assert.equal(details.slots[0].groups[0].rewards[0].name, "IX BA高梁");
    assert.match(details.sourceUrl, /\/zh-sg\/content\//);
  });

  test("names economic bonus categories and collection pieces without raw IDs", () => {
    const details = normalizeContainer({
      id: 4002599856,
      title: "“星条曙光”补给箱",
      slots: [{ commonRewards: { items: { rewards: [
        { type: "camoboost", id: 4281331632, amount: 12 },
        { type: "camoboost", id: 4270845872, amount: 12 },
        { type: "camoboost", id: 4260360112, amount: 12 },
        { type: "camoboost", id: 4249874352, amount: 12 },
        { type: "collection_album", id: 4245658544, amount: 1 },
      ] } } }],
    }, "asia");
    assert.deepEqual(details.slots[0].groups[0].rewards.map((reward) => reward.name), [
      "银币经济加成 +160%", "战舰经验经济加成 +800%", "指挥官经验经济加成 +800%", "全局经验经济加成 +2400%", "“星条曙光”收藏品拼图",
    ]);
  });
}

// snowflake
{

  const { shipsFromPort, summarizeSnowflakes } = require("../electron/snowflake.cjs");

  test("normalizes and deduplicates the authorized port ship list", () => {
    assert.deepEqual(shipsFromPort([101, "102", 101, null, 0, { ship_id: 103 }]), [
      { ship_id: 101 },
      { ship_id: 102 },
      { ship_id: 103 },
    ]);
    assert.deepEqual(shipsFromPort(null), []);
  });

  test("summarizes anniversary tokens and supership steel by tier", () => {
    const ships = [{ ship_id: 1 }, { ship_id: 2 }, { ship_id: 3 }, { ship_id: 4 }, { ship_id: 5 }];
    const metadata = {
      1: { tier: 5 },
      2: { tier: 5 },
      3: { tier: 10 },
      4: { tier: 11 },
      5: { tier: 4 },
    };
    const result = summarizeSnowflakes(ships, metadata, { accountId: 42, nickname: "Tester", realm: "asia" });
    assert.equal(result.totalShips, 5);
    assert.equal(result.eligibleShips, 4);
    assert.equal(result.totalTokens, 175);
    assert.equal(result.totalSteel, 200);
    assert.equal(result.tiers.find((row) => row.tier === 5).count, 2);
    assert.ok(result.event.exchangeRewards.some((reward) => reward.id === "kurama" && reward.price === 11000));
  });
}
