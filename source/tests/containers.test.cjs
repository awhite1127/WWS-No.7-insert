"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
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
