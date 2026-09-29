"use strict";

// WG's development blog is English only. Keep the numeric values verbatim and
// translate the recurring balance-change grammar and ship parameter labels.
const labels = new Map(Object.entries({
  "alternative fire mode": "替代射击模式",
  "alternative fire mode reload time": "替代射击模式装填时间",
  "alternative firing mode reload": "替代射击模式装填时间",
  "hydroacoustic search consumable range": "水底搜索消耗品作用距离",
  "preparation time at the beginning of the battle": "开局准备时间",
  "muzzle velocity": "炮口初速",
  "turret traverse time": "炮塔转向时间",
  "ap shell": "穿甲弹",
  "alternative firing mode": "替代射击模式",
  "combat instructions": "作战指令",
  "smoke generator consumable": "发烟机消耗品",
  "exhaust smoke generator consumable": "高速发烟机消耗品",
  "hydroacoustic search consumable": "水底搜索消耗品",
  "surveillance radar consumable": "监视雷达消耗品",
  "repair party consumable": "维修小组消耗品",
  "repair party": "维修小组",
  "heavy repair teams": "重型维修小组",
  "specialized repair teams": "专业维修小组",
  "torpedo defense system consumable": "鱼雷防御系统消耗品",
  "main battery": "主炮",
  "main battery reload time": "主炮装填时间",
  "main battery reload": "主炮装填时间",
  "main battery turret traverse time": "主炮炮塔转向时间",
  "main battery maximum range": "主炮最大射程",
  "main battery firing range": "主炮射程",
  "main battery accuracy": "主炮精度",
  "main battery parameters": "主炮参数",
  "main battery ap shell damage": "主炮穿甲弹伤害",
  "main battery shell dispersion": "主炮炮弹散布",
  "maximum main battery shell dispersion": "主炮炮弹最大散布",
  "secondary battery accuracy": "副炮精度",
  "secondary battery reload time": "副炮装填时间",
  "secondary battery guns reload time": "副炮装填时间",
  "secondary armament reload time": "副炮装填时间",
  "ship hp per second": "舰船每秒恢复生命值",
  "torpedo armament": "鱼雷武器",
  "maximum ap shell damage": "穿甲弹最大伤害",
  "ap shell parameters": "穿甲弹参数",
  "ap shell fuse time": "穿甲弹引信触发时间",
  "ap shell penetration": "穿甲弹穿深",
  "he shell penetration": "高爆弹穿深",
  "torpedo armament": "鱼雷武器",
  "torpedo tube reload time": "鱼雷发射管装填时间",
  "torpedo reload time": "鱼雷装填时间",
  "torpedo range": "鱼雷射程",
  "torpedo protection": "鱼雷防护",
  "detectability range by sea": "海上被发现距离",
  "detectability by sea": "海上被发现距离",
  "ship detection range": "舰船侦测距离",
  "detectability range": "被发现距离",
  "dive capacity recharge rate": "潜航能力恢复速度",
  "casemate side plating armor": "炮廓侧面装甲厚度",
  "upper belt and deck armor plating thickness": "上层装甲带及甲板装甲厚度",
  "combat instructions parameter of effect": "作战指令效果",
  "consumable preparation and cooldown time bonus": "消耗品准备及冷却时间加成",
  "bonus to maximum main battery shell dispersion": "主炮炮弹最大散布加成",
  "bonus to ap shell armor penetration capabilities": "穿甲弹穿深加成",
  "bonus to main battery ap shell damage": "主炮穿甲弹伤害加成",
  "bonus to ap shell damage": "穿甲弹伤害加成",
  "bonus to main battery ap shell damage": "主炮穿甲弹伤害加成",
  "bonus to main battery maximum dispersion": "主炮最大散布加成",
  "reduction of all damage taken from aircraft and ship torpedoes, as well as depth charges": "受到航空鱼雷、舰载鱼雷及深水炸弹伤害的减免",
  "percent of non-citadel damage that can be restored": "可恢复的非核心区伤害比例",
  "continuous aa damage bonus": "防空持续伤害加成",
  "continuous aa damage": "防空持续伤害",
  "concentrated aa fire": "集中防空火力",
  "action time": "作用时间",
  "duration time": "持续时间",
  "reload time": "装填时间",
  "charges": "使用次数",
  "hp per second": "每秒恢复生命值",
  "sigma value": "σ值",
  "maximum ship speed": "舰船最高航速",
  "ship turning radius": "舰船转向半径",
  "maximum damage": "最大伤害",
  "maximum range": "最大射程",
  "speed": "速度",
  "maximum speed": "最高航速",
  "firing range": "射程",
  "maximum dispersion": "最大散布",
  "initial velocity": "初速",
  "hit points": "生命值",
  "fire duration": "起火持续时间",
  "fires duration": "起火持续时间",
  "damage reduction": "伤害减免",
  "fore- and aft-end plating": "舰首及舰尾装甲",
  "torpedo protection. damage reduction": "鱼雷防护伤害减免",
  "180-degree turn time": "旋转180度所需时间",
  "180 degree turn time": "旋转180度所需时间",
  "sigma": "σ值",
  "armor penetration capacity": "装甲穿透能力",
  "chances of causing a fire on target": "点燃目标概率",
  "continuous damage": "持续伤害",
  "damage by short-range aa guns": "近程防空炮伤害",
  "damage by medium-range aa guns": "中程防空炮伤害",
  "damage by long-range aa guns": "远程防空炮伤害",
  "damage by shell explosion": "炮弹爆炸伤害",
  "number of shell explosions in a salvo": "每轮齐射的炮弹爆炸数量",
  "hit probability": "命中概率",
  "firing range": "射程",
  "priority sector reinforcement": "优先区域强化",
  "aa defense priority reinforcement": "防空优先区域强化",
  "activated effect": "激活效果",
  "activation effects": "激活效果",
  "continuous aa damage increase": "防空持续伤害加成",
  "damage from aa shell explosions increase": "防空炮弹爆炸伤害加成",
  "instantaneous damage interval": "瞬时伤害间隔",
  "cooldown time": "冷却时间",
  "progress accumulation and loss": "进度获取与流失",
  "progress gain per second": "每秒获取进度",
  "time before you start losing progress": "进度开始流失前的时间",
  "progress loss per second": "每秒流失进度",
  "turning circle radius": "转向半径",
  "rudder shift time": "转舵时间",
  "detectability range by depths": "水下被发现距离",
  "detectability range by air": "空中被发现距离",
  "detectability when ship is on fire": "起火时被发现距离",
  "detectability after firing a main gun shell": "主炮开火后被发现距离",
  "detectability after firing main guns in smoke": "烟幕中主炮开火后被发现距离",
  "airstrike range": "空袭射程",
  "available flights": "可用航空队数量",
  "number of aircraft in attacking flight": "攻击编队飞机数量",
  "aircraft hp": "飞机生命值",
  "bombs in payload": "携带炸弹数量",
  "maximum bomb damage": "炸弹最大伤害",
  "size of attacking flight": "攻击编队规模",
  "aircraft per squadron": "每支中队飞机数量",
  "aircraft on deck": "甲板飞机数量",
  "aircraft preparation": "飞机准备时间",
  "torpedo tube reload time": "鱼雷发射管装填时间",
  "torpedo arming distance": "鱼雷启用距离",
  "aerial torpedo speed": "航空鱼雷航速",
  "torpedoes in payload": "携带鱼雷数量",
  "maximum torpedo damage": "鱼雷最大伤害",
  "bombs type": "炸弹类型",
  "number of loaders": "装填手数量",
  "torpedo type switching time": "鱼雷类型切换时间",
  "action radius": "作用半径",
  "dispersion time": "烟幕持续时间",
  "total duration": "总持续时间",
  "total usage time": "总使用时间",
  "minimum usage time": "最短使用时间",
  "preparation time": "准备时间",
  "main battery reload time reduction": "主炮装填时间缩短",
  "torpedo tube reload time reduction": "鱼雷发射管装填时间缩短",
  "secondary battery reload time reduction": "副炮装填时间缩短",
  "continuous aa damage augmentation": "防空持续伤害提升",
  "main battery ap shell damage increase": "主炮穿甲弹伤害提升",
  "main battery maximum dispersion reduction": "主炮最大散布缩减",
  "armor": "装甲",
  "survivability": "生存能力",
  "artillery": "火炮",
  "aa defense": "防空火力",
  "short-range": "近程",
  "mid-range": "中程",
  "long-range": "远程",
  "maneuverability": "机动性",
  "concealment": "隐蔽性",
  "consumables": "消耗品",
  "main battery": "主炮",
  "secondary armament": "副炮",
  "he shells": "高爆弹",
  "ap shells": "穿甲弹",
  "airstrike": "空袭",
  "torpedoes": "鱼雷",
  "fighters": "战斗机",
  "standard torpedo": "标准鱼雷",
  "alternative torpedo": "替代鱼雷",
  "damage control party": "损害管制小组",
  "engine boost": "引擎增压",
  "smoke generator": "发烟机",
  "exhaust smoke generator": "高速发烟机",
  "hydroacoustic search": "水底搜索",
  "surveillance radar": "监视雷达",
  "repair party": "维修小组",
  "enhanced repair party": "强化维修小组",
  "emergency engine power": "紧急引擎动力",
  "ship's parameters": "舰船参数",
  "gameplay features": "玩法特点",
  "combat instructions": "作战指令",
  "aa defense priority reinforcement": "防空优先区域强化",
  "torpedo defense system": "鱼雷防御系统"
}));
const exact = new Map(Object.entries({
  "Captains!": "舰长们！",
  "All other detectability ranges adjusted accordingly": "其他被发现距离也相应调整。",
  "A ll other detectability ranges adjusted accordingly.": "其他被发现距离也相应调整。",
  "They are now 5-10% higher depending on distance": "穿深根据距离提高约5%至10%。",
  "Ballistics are slightly improved": "弹道略有改善。",
  "Armor penetration capability is slightly improved": "装甲穿透能力略有提升。",
  "Armor penetration characteristics increased": "装甲穿透能力提高。",
  "Ballistic parameters changed. Shell arcs are now floatier": "弹道参数调整，炮弹弹道弧线更加高抛。",
  "Shell ballistics improved. Trajectory will become slightly flatter.": "炮弹弹道改善，轨迹将更加平直。",
  "S hell penetration and ballistics have slightly improved": "炮弹穿深和弹道略有改善。",
  "Removed reload penalty": "移除装填惩罚。",
  "Progress does not decay.": "进度不会流失。",
  "The ship is designed to serve as a long-range sniper, and the Exhaust Smoke Generator made her too powerful in the unintended role of destroyer hunter.": "该舰定位为远程狙击型舰船。高速发烟机使其在非预期的驱逐舰猎手角色中过强，因此被移除。",
  "Secondary battery accuracy improved. It's now similar to those found on the 普鲁士 line.": "副炮精度提高，现与普鲁士系列相近。",
  "For the 1st turret, the traverse angles were adjusted to 147 degrees in each direction.": "1号炮塔转向角调整为两侧各147度。",
  "For the 3rd turret, the traverse angles were adjusted to 140 degrees in each direction.": "3号炮塔转向角调整为两侧各140度。",
  "Main Battery accuracy reduced , it now has standard cruiser dispersion.": "主炮精度降低，现采用标准巡洋舰散布。",
  "A ll other detectability ranges adjusted accordingly.": "其他被发现距离也相应调整。",
  "Improved engine parameters, the ship will now accelerate quicker and bleed off less speed in turns (similar to B ritish light cruisers)": "引擎参数改善，舰船加速更快、转向时速度损失更少，表现接近英国轻巡洋舰。",
  "A s a result of this, the turning radius increased: 690 to 760m": "因此转向半径由690米增至760米。",
  "He and AP s hell parameters changed, they now correspond to those that can be found on 依阿华": "高爆弹与穿甲弹参数调整，现与依阿华的炮弹相同。",
  "Note that the following change affects all battleships equipped with the Surveillance Radar consumable.": "以下改动影响所有配备监视雷达的战列舰。",
  "Note that the following change affects all cruisers of the branch, starting with 德累斯顿.": "以下改动影响从德累斯顿开始的该系列全部巡洋舰。",
  "Based on testing results, we are applying some changes to a new AA mechanic .": "根据测试结果，我们将调整新的防空机制。",
  "We're applying balance changes to a number of ships based on an analysis of both their combat statistics and player feedback.": "根据战斗数据和玩家反馈，我们将调整多艘舰船的平衡性。",
  "Additionally, we are applying the following changes to a ship that is already released on the live server.": "此外，以下已上线舰船也将获得调整。",
  "Based on testing results, we are applying changes to a new AA mechanic.": "根据测试结果，我们将调整新的防空机制。",
  "Concentrated AA Fire :": "集中防空火力：",
  "Ships with Concentrated AA Fire :": "配备集中防空火力的舰船：",
  "Access to support-oriented consumables": "可使用支援型消耗品",
  "Combat Instructions charged by using the support consumables": "使用支援型消耗品可为作战指令充能",
  "High speed": "航速较高",
  "Lower than average HP pool, but with an access to Enhanced Repair Party": "生命值低于平均水平，但可使用强化维修小组",
  "Mediocre base firepower": "基础火力一般",
  "Good concealment": "隐蔽性良好",
  "Solid DPM (though reduced compared to her sister 海伦娜)": "每分钟伤害较高，但低于姊妹舰海伦娜",
  "Access to Smoke Generator": "可使用发烟机",
  "Wide array of consumables": "消耗品种类丰富"
}));
function normalized(text) { return String(text).replace(/\bA ll\b/g, "All").replace(/\br eload\b/gi, "reload").replace(/\bs hell\b/gi, "shell").replace(/\bA lternative\b/g, "Alternative").replace(/\bAlbema rle\b/g, "阿尔伯马尔").replace(/\s+/g, " ").replace(/\s+([.,:])/g, "$1").trim(); }
function formatValue(value) {
  let translated = normalized(value);
  const terms = [
    [/Auxiliary and Torpedo Weaponry Coordination/gi, "辅助武器与鱼雷协同"],
    [/Engineering Crew Support/gi, "工程队支援"],
    [/Gun Crew Assistance/gi, "炮组支援"],
    [/E[\w\s]*?ngine[\w\s]*?P[\w\s]*?ower/gi, "紧急引擎动力"],
    [/Auxiliary and Torpedo Armament Assistance/gi, "辅助武器与鱼雷支援"],
    [/Engineering Crew Assistance/gi, "工程队支援"],
    [/Support oriented consumable/gi, "支援型消耗品"],
    [/Submarine Surveillance/gi, "潜艇监视"],
    [/Exhaust Smoke Generator/gi, "高速发烟机"],
    [/Smoke Generator/gi, "发烟机"],
    [/Hydroacoustic Search/gi, "水底搜索"],
    [/Engine Boost/gi, "引擎增压"],
    [/Interceptors/gi, "截击机"],
    [/Torpedo Defense System/gi, "鱼雷防御系统"],
    [/Damage Control Party/gi, "损害管制小组"],
    [/Repair Party/gi, "维修小组"],
    [/Spotting Aircraft/gi, "侦察机"],
    [/Fighters/gi, "战斗机"],
    [/\bknots\b/gi, "节"],
  ];
  for (const [pattern, term] of terms) translated = translated.replace(pattern, term);
  return translated.replace(/\bto\b/gi, "→").replace(/km\b/gi, "千米").replace(/kt\b/gi, "节").replace(/\bunits\/s\b/gi, "单位/秒").replace(/mm\b/gi, "毫米").replace(/m\/s\b/gi, "米/秒").replace(/\bs\b/gi, "秒").replace(/\s+%/g, "%").replace(/(\d)x(\d)/g, "$1×$2");
}
function label(text) {
  const clean = normalized(text).replace(/[.:]+$/, "");
  const direct = labels.get(clean.toLocaleLowerCase());
  if (direct) return direct;
  const bonus = /^Bonus to (.+)$/i.exec(clean);
  if (bonus) { const part = label(bonus[1]); return part ? part + "加成" : null; }
  const forMount = /^For (\d+)\s?mm mounts?$/i.exec(clean);
  if (forMount) return forMount[1] + "毫米炮座";
  const slot = /^(\d+) slot$/i.exec(clean);
  if (slot) return "第" + slot[1] + "栏";
  return null;
}
function isChineseName(line) {
  return /^[IVX]+\s+[\p{Script=Han}A-Z0-9][\p{Script=Han}A-Z0-9·、，\s-]*(?:[:：])?$/u.test(line);
}
function translateChange(line) {
  let text = normalized(line).replace(/^•\s*/, "");
  const bullet = /^•/.test(line) ? "• " : "";
  if (exact.has(text)) return bullet + exact.get(text);
  if (/^He and AP shell parameters changed/i.test(text)) return bullet + "高爆弹与穿甲弹参数调整，现与依阿华的炮弹相同。";
  if (/^Shell penetration and ballistics have slightly improved/i.test(text)) return bullet + "炮弹穿深和弹道略有改善。";
  if (/^\*?\d{2}\.\d{2}\.\d{4} Fixed a mistake with torpedo tube reload time/i.test(text)) return "更正：兰布罗斯·卡措尼斯的鱼雷发射管装填时间不会调整。";
  if (/^Added a new parameter to the Surveillance Radar consumable/i.test(text)) return bullet + "监视雷达消耗品新增以下参数：";
  if (/^Torpedo armament changed - torpedoes are now similar/i.test(text)) return bullet + "鱼雷武器调整，现与格但斯克的鱼雷相近：";
  if (/^AP shell parameters changed, they now correspond/i.test(text)) return bullet + "穿甲弹参数调整，现与北卡罗来纳相同：";
  if (/^HE shell penetration has been increased/i.test(text)) return bullet + "高爆弹穿深提高至口径的25%，具体数值如下：";
  if (/^When active, the Continuous AA damage bonus increased/i.test(text)) return bullet + "启用时，防空持续伤害加成由+25%提高至+50%；亚特兰大、亚特兰大B和弗林特由+50%提高至+75%。";
  if (/^All other detectability ranges adjusted accordingly/i.test(text)) return bullet + "其他被发现距离也相应调整。";
  if (/^Main Battery accuracy reduced/i.test(text)) return bullet + "主炮精度降低，现采用标准巡洋舰散布。";
  if (/^For the 1st turret/i.test(text)) return bullet + "1号炮塔转向角调整为两侧各147度。";
  if (/^For the 3rd turret/i.test(text)) return bullet + "3号炮塔转向角调整为两侧各140度。";
  if (/^.+?\s+and\s+.+?[:：]?$/i.test(text) && /[\p{Script=Han}]/u.test(text) && /^[IVX]+\s/.test(text)) return bullet + text.replace(/\s+and\s+/gi, "、").replace(/:$/, "：");
  if (/^Based on testing results, we are applying changes to /i.test(text)) return "根据测试结果，我们将调整以下舰船：";
  if (/^[\p{Script=Han}\s,，、:：]+$/u.test(text)) return bullet + text.replace(/\s*[,，]\s*/g, "、").replace(/:$/, "：");
  if (isChineseName(text) || /^Z-\d+[:：]?$/.test(text) || (/^[IVX]+\s/.test(text) && /[\p{Script=Han}]/u.test(text))) return bullet + text.replace(/\s+and\s+/gi, "、").replace(/:$/, "：");
  if (/^Based on testing results, we are applying some changes/i.test(text)) return "根据测试结果，我们将调整新的防空机制。";
  if (/^Ships with Concentrated AA Fire/i.test(text)) return "配备集中防空火力的舰船：";
  let match = /^(.+?) (?:parameters?|parameter of effect) changed(?:,.*)?\s*:?\s*$/i.exec(text);
  if (match) { const name = label(match[1]); if (name) return bullet + name + "参数调整："; }
  match = /^(.+?)[, ]+?(increased|reduced|decreased|lowered|improved|adjusted|standardized)\s*:\s*(.+)$/i.exec(text);
  if (match) {
    const name = label(match[1]);
    if (name) {
      const verb = { increased: "提高", reduced: "降低", decreased: "降低", lowered: "降低", improved: "改善", adjusted: "调整", standardized: "统一为" }[match[2].toLowerCase()];
      return bullet + name + verb + "：" + formatValue(match[3]);
    }
  }
  match = /^(.+?) (increased|reduced|decreased|lowered|improved)\s*:?$/i.exec(text);
  if (match) { const name = label(match[1]); if (name) return bullet + name + ({ increased: "提高。", reduced: "降低。", decreased: "降低。", lowered: "降低。", improved: "改善。" }[match[2].toLowerCase()]); }
  match = /^(.+?) (removed|changed)\.?$/i.exec(text);
  if (match) { const name = label(match[1]); if (name) return bullet + name + (match[2].toLowerCase() === "removed" ? "已移除。" : "已调整。"); }
  match = /^(.+?) replaced with (.+?),? with the following parameters:?$/i.exec(text);
  if (match) {
    const from = label(match[1]), to = label(match[2]);
    if (from && to) return bullet + from + "替换为" + to + "，参数如下：";
  }
  match = /^(.+?)\s*(?::| - )\s*(.+)$/i.exec(text);
  if (match) {
    const name = label(match[1]);
    if (name) return bullet + name + "：" + formatValue(match[2]);
  }
  const name = label(text);
  if (name) return bullet + name;
  return null;
}
const shipTypes = { "European cruiser": "欧洲巡洋舰", "American cruiser": "美国巡洋舰", "American Battleship": "美国战列舰", "Japanese aircraft carrier": "日本航空母舰", "Japanese cruiser": "日本巡洋舰", "Soviet battleship": "苏联战列舰", "Spanish cruiser": "西班牙巡洋舰", "European submarine": "欧洲潜艇" };
const unreleasedNames = { Dragon: "龙", "Kralj Petar I": "彼得一世国王", Honolulu: "檀香山", Akagi: "赤城", "Ōta": "大田", Rodina: "祖国" };
function translateNewShipLine(line) {
  const text = normalized(line).replace(/^(&bull;|•|-)\s*/, "");
  const bullet = /^(&bull;|•|-)\s*/.test(line) ? "• " : "";
  if (exact.has(text)) return bullet + exact.get(text);
  const type = Object.keys(shipTypes).find(name => text.toLocaleLowerCase().startsWith(name.toLocaleLowerCase() + " "));
  const heading = type && /^(.+?), Tier ([IVX]+)$/i.exec(text.slice(type.length + 1));
  if (heading) return heading[2] + "级" + shipTypes[type] + " " + (unreleasedNames[heading[1]] || heading[1]);
  if (isChineseName(text)) return text.replace(/:$/, "：");
  if (/^\d+x\d+\s+\d+(?:\.\d+)?\s*mm\.?$/i.test(text)) return bullet + formatValue(text);
  if (/^\d+x\d+\s+\d+(?:\.\d+)?\s*mm(?:\.,?\s*\d+x\d+\s+\d+(?:\.\d+)?\s*mm\.?)*$/i.test(text)) return bullet + formatValue(text);
  const translated = translateChange(bullet + text);
  if (translated) return translated;
  return null;
}
function translateShipDetail(lines, isNewShips = false) {
  if (!Array.isArray(lines)) return [];
  const result = [];
  let omitted = 0;
  if (isNewShips) result.push("以下为新舰船的主要参数中文导读；背景介绍及完整排版请查看官网原文。");
  for (const line of lines) {
    const translated = isNewShips ? translateNewShipLine(line) : translateChange(line);
    if (translated) result.push(translated);
    else omitted++;
  }
  if (omitted && !isNewShips) result.push("另有" + omitted + "条复杂说明暂未译出，请通过“官网原文”核对。");
  return result;
}
module.exports = { translateShipDetail, translateChange, translateNewShipLine, label, formatValue };
