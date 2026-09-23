"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { normalizeContainer } = require("../electron/containers.cjs");

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
