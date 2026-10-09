"use strict";
// Game data is converted from the public WoWs ShipBuilder data snapshot.
// No client models or executable game files are included.
const CLASSES = ["Battleship", "Cruiser", "Destroyer", "AirCarrier", "Submarine"];
const snake = (s) => s.replace(/([a-z0-9])([A-Z])/g, "$1_$2").replace(/([A-Z])([A-Z][a-z])/g, "$1_$2").toUpperCase();
const clean = (s = "") => String(s).replace(/<[^>]*>/g, "").replace(/\{[^}]*\}/g, "…").trim();
function normalizeData(raw, version, glossary = {}, englishNames = {}) {
  const zh = raw.zh || {}, en = raw.en || {};
  const local = (key, fallback) => clean(zh[key] || en[key] || (fallback !== undefined ? fallback : key));
  function modifier(m) {
    return { name: m.name, value: m.value, properties: m.affectedProperties || [], mode: m.valueProcessingKind || "None", display: m.displayValueProcessingKind, unit: m.unit, label: local(m.gameLocalizationKey, m.appLocalizationKey || m.name) };
  }
  function skill(name, s) {
    const key = snake(name);
    return { id: s.skillNumber, key: name, name: local("SKILL_" + key, name), description: local("SKILL_DESC_" + key, ""), icon: key.toLowerCase(), tiers: s.tiers.filter(t => CLASSES.includes(t.shipClass)).map(t => ({ type: t.shipClass, cost: t.tier + 1, column: t.xPosition })), modifiers: (s.modifiers || []).map(modifier), conditions: (s.conditionalModifierGroups || []).map((c,i) => ({ id: String(i), label: local(c.triggerDescription || "SKILL_" + key + "_TRIGGER_DESC", "战斗条件满足时生效"), limit: c.activationLimit, modifiers: c.modifiers.map(modifier) })) };
  }
  const defaultCrew = raw.crew.find(c => c.name === "Default");
  if (!defaultCrew) throw new Error("缺少普通舰长技能数据");
  // ShipBuilder 15.8 omits the tree position of skill 52. WG 15.2 replaced
  // Repair Specialist in the same 2-point, fourth-column position.
  for(const captain of raw.crew){const s=Object.values(captain.skills).find(s=>s.skillNumber===52);if(s && !s.tiers.length){s.tiers=[{tier:1,xPosition:3,shipClass:"AirCarrier"}];s.learnableOn=["AirCarrier"];}}
  const skills = Object.entries(defaultCrew.skills).filter(([,s]) => s.canBeLearned && s.tiers.some(t => CLASSES.includes(t.shipClass))).map(([k,s]) => skill(k,s));
  const commanders = raw.crew.filter(c => c.name !== "Default" && (c.hasSpecialSkills || Object.keys(c.uniqueSkills || {}).length)).map(c => ({
    id: c.index, name: local(c.name.toUpperCase(), c.name), nation: c.nation,
    skills: Object.entries(c.skills).filter(([k,s]) => s.canBeLearned && JSON.stringify(s) !== JSON.stringify(defaultCrew.skills[k])).map(([k,s]) => skill(k,s)),
    talents: Object.entries(c.uniqueSkills || {}).map(([id,t]) => ({ id, name: local(t.translationId, id), description: local(t.translationId + "_DESCRIPTION_BATTLE_GROUP_REGULAR", "达到游戏规定的触发条件后生效"), classes: t.allowedShips, battleGroup: t.battleGroup, trigger: t.trigger?.parameters || {}, modifiers: Object.values(t.skillEffects).flatMap(e => e.modifiers.map(modifier)), levels: [...new Set(Object.values(t.skillEffects).flatMap(e => (e.levels || []).map(l => l.level)))].sort((a,b)=>a-b).map(level => ({ level, modifiers: Object.values(t.skillEffects).flatMap(e => { const l = (e.levels || []).filter(l => l.level <= level).at(-1); return (l ? l.cumulativeModifiers : e.modifiers).map(modifier); }) })) }))
  }));
  const upgrades = raw.upgrades.map(u => ({ id: u.index, name: local("TITLE_"+u.name.toUpperCase(), u.name), description: local("DESC_"+u.name.toUpperCase(), ""), icon: u.name, slot: u.slot, type: u.type, nations: u.allowedNations, tiers: u.shipLevel, classes: u.shipClasses, allow: u.additionalShips, deny: u.blacklistedShips, modifiers: u.modifiers.map(modifier) }));
  const metric = (key,label,base,unit,properties,lower=false) => ({ key,label,base,unit,properties:Array.isArray(properties)?properties:[properties],lower });
  const props = (group,name) => group+"DataContainer."+name;
  const projectile = raw.projectiles || {};
  const aircraft = Object.fromEntries(Object.values(raw.aircraft || {}).map(p=>[p.name,p]));
  function guns(g, prefix = "main", secondary = false) {
    if (!g?.guns?.length) return [];
    const group = secondary ? "SecondaryBattery" : "MainBattery";
    const gun = g.guns[0];
    const rows = [metric(prefix+"Range", secondary?"副炮射程":"主炮射程",g.maxRange/1000,"km",props(group,"Range")), metric(prefix+"Reload",secondary?"副炮装填（首组）":"主炮装填",gun.reload,"s",props(group,"Reload"),true),metric(prefix+"Traverse",secondary?"副炮转速":"炮塔转速",gun.horizontalRotationSpeed,"°/s",props(group,"TraverseSpeed"))];
    rows.push(metric(prefix+"Dispersion",secondary?"副炮散布相对系数":"主炮散布相对系数",100,"%",props(group,"Dispersion.IdealRadius"),true));
    if (!secondary) rows.push(metric("mainCaliber","主炮口径",gun.barrelDiameter*1000,"mm",[]),metric("mainBarrels","主炮炮管",g.guns.reduce((n,x)=>n+x.numBarrels,0),"门",[]));
    for (const name of gun.ammoList || []) {
      const p = projectile[name]; if (!p || !p.damage) continue;
      const ammo = p.shellType || (/_(AP|SAP)(_|$)/.test(name) ? (/_SAP/.test(name)?"SAP":"AP") : "HE");
      const properties = [props("Shell","Damage."+(ammo === "AP"?"Ap":"HESAP."+(secondary?"Secondary":"Main")))];
      if (ammo === "AP" && gun.barrelDiameter >= .19) properties.push(props("Shell","Damage.BigAp"));
      rows.push(metric(prefix+"Damage"+ammo,ammo+"炮弹伤害",p.damage,"",properties));
      if(ammo === "HE") rows.push(metric(prefix+"Fire"+ammo,"HE起火概率",p.fireChance*100,"%",[props("Shell","FireChance."+(secondary?"Secondary":"Main")+".Multiplier"),props("Shell","FireChance."+(secondary?"Secondary":"Main")+(gun.barrelDiameter>.16?".Big.Additive":".Small.Additive")),props("Shell","FireChance."+(secondary?"Secondary":"Main"))]));
    }
    return rows;
  }
  function torpedoes(t) {
    const gun = t?.torpedoLaunchers?.[0]; if (!gun) return [];
    const rows=[metric("torpReload","鱼雷装填",gun.reload,"s",props("TorpedoArmament","Reload"),true)];
    for (const [i,name] of (gun.ammoList || []).entries()) {
      const p=projectile[name]; if (!p) continue;
      const suffix = i ? "（"+(i+1)+"）" : "";
      rows.push(metric("torpRange"+i,"鱼雷射程"+suffix,p.maxRange/1000,"km",[]),metric("torpSpeed"+i,"鱼雷航速"+suffix,p.speed,"节",props("Torpedo","Damage.Ship")),metric("torpDamage"+i,"鱼雷伤害"+suffix,p.damage,"",props("Torpedo","Damage")),metric("torpSpot"+i,"鱼雷被发现距离"+suffix,p.spottingRange,"km",props("Torpedo","Visibility"),true));
    } return rows;
  }
  function hull(h) {
    const rows=[metric("hp","生命值",h.health,"",props("Survivability","Hp.Permanent")),metric("speed","最高航速",h.maxSpeed,"节",props("Maneuverability","Speed")),metric("rudder","转舵时间",h.rudderTime,"s",props("Maneuverability","RudderShiftTime"),true),metric("concealment","水面被发现距离",h.surfaceDetection,"km",props("Concealment","Visibility"),true),metric("airDetection","空中被发现距离",h.airDetection,"km",props("Concealment","Visibility"),true),metric("turnRadius","转向半径",h.turningRadius,"m",[]),metric("fireDuration","起火持续时间",h.fireDuration,"s",props("Survivability","FireDuration"),true),metric("floodDuration","进水持续时间",h.floodingDuration,"s",props("Survivability","FloodDuration"),true)];
    if(h.subBatteryCapacity) rows.push(metric("battery","下潜能力",h.subBatteryCapacity,"s",props("Survivability","DiveCapacity")),metric("batteryRegen","下潜能力恢复",h.subBatteryRegenRate,"/s",props("Survivability","DiveCapacityRecharge")),metric("diveRudder","升降舵转换时间",h.divingPlaneShiftTime,"s",props("Maneuverability","DivingPlaneShiftTime"),true),metric("underwaterSpeed","水下航速",h.maxSpeed*(h.maxSpeedAtBuoyancyStateCoeff?.DeepWater || 1),"节",props("Maneuverability","Speed")));
    rows.push(...guns(h.secondaryModule,"secondary",true));
    const aa = Object.values(h.antiAir || {}).filter(a=>a.constantDps>0);
    if(aa.length) rows.push(metric("aaDps","防空持续伤害（各圈合计，不计命中率）",aa.reduce((n,a)=>n+a.constantDps*10,0),"/s",props("AntiAir","ConstantDamage")),metric("aaRange","防空最大射程",Math.max(...aa.map(a=>a.maxRange))/1000,"km",[]));
    return rows;
  }
  function planeMetrics(p) {
    const subtype={Fighter:"Rocket",DiveBomber:"DiveBomber",TorpedoBomber:"TorpedoBomber",SkipBomber:"SkipBomber"}[p.planeType] || p.planeType;
    const rows=[metric("planeHp","单机生命值",p.maxHealth,"",[props("CvAircraft","Hp"),props("CvAircraft","Hp."+subtype)]),metric("planeSpeed","飞机巡航速度",p.speed,"节",[props("CvAircraft","Speed"),props("CvAircraft","CruisingSpeed."+subtype)]),metric("planeRecovery","飞机整备时间",p.restorationTime,"s",props("CvAircraft","RestorationTime"),true),metric("planeBoost","引擎增压持续时间",p.maxEngineBoostDuration,"s",props("CvAircraft","BoostTime"))];
    const proj=projectile[p.bombName];
    if(proj?.projectileType==="Torpedo") rows.push(metric("planeTorpSpeed","空投鱼雷航速",proj.speed,"节",props("Torpedo","Damage.Plane")),metric("planeTorpDamage","空投鱼雷伤害",proj.damage,"",props("Torpedo","Damage")));
    return rows;
  }
  const ships=raw.ships.filter(s=>CLASSES.includes(s.shipClass) && !["TestShip","Event"].includes(s.shipCategory)).map(s=> {
    const groups=[];
    function add(id,label,dict,toRows) {
      const options=Object.entries(dict || {}).map(([key,value])=>({id:key,name:local("TITLE_"+key.toUpperCase(),key.replace(/_/g," ")),metrics:toRows(value),factor:value.maxRangeModifier,speedFactor:value.speedCoef,compatible:[],supportsDpm:id==="main"&&Boolean(value.guns?.length)&&value.guns.every(g=>g.reload===value.guns[0].reload&&g.barrelDiameter===value.guns[0].barrelDiameter&&JSON.stringify(g.ammoList)===JSON.stringify(value.guns[0].ammoList))}));
      if(options.length) {
        for(const option of options){const component={hull:"Hull",main:"Artillery",fireControl:"Suo",torpedo:"Torpedoes",engine:"Engine"}[id];const upgrade=(s.shipUpgradeInfo?.shipUpgrades || []).find(u=>u.components?.[component]?.includes(option.id)&&u.ucType==={hull:"Hull",main:"Artillery",fireControl:"Suo",torpedo:"Torpedoes",engine:"Engine"}[id]);option.name=local("TITLE_"+(upgrade?.name || option.id).toUpperCase(),label+" · "+option.id.replace(/_/g," "));}
        groups.push({id,label,options});
      }
    }
    add("hull","船体",s.hulls,hull);add("main","主炮",s.mainBatteryModuleList,guns);add("fireControl","射控",s.fireControlList,()=>[]);add("torpedo","鱼雷",s.torpedoModules,torpedoes);add("engine","动力",s.engines,()=>[]);
    add("sonar","声呐",s.pingerGunList,p=>[metric("sonarRange","声呐射程",p.waveDistance/1000,"km",props("PingerGun","Range")),metric("sonarReload","声呐装填",p.waveReloadTime,"s",props("PingerGun","Reload"),true)]);
    for (const [kind,label] of [["Fighter","攻击机"],["DiveBomber","轰炸机"],["TorpedoBomber","鱼雷机"],["SkipBomber","弹跳轰炸机"]]) {
      const options=Object.entries(s.cvPlanes || {}).flatMap(([module,names])=> names.filter(n=>aircraft[n]?.planeType===kind).map(n=>({id:module+":"+n,name:local("TITLE_"+n.toUpperCase(),n),metrics:planeMetrics(aircraft[n])})));
      if(options.length)groups.push({id:"plane"+kind,label,options});
    }
    const cons = {};
    for (const c of s.shipConsumable || []) {
      const a=raw.abilities[c.consumableName+" "+c.consumableVariantName];if(!a)continue;
      const id=a.index;
      const metrics=[metric("consReload"+c.slot,"冷却时间",a.reloadTime,"s",[props("Consumable","Reload.Ship"),props("Consumable","Reload."+s.shipClass),props("Consumable","Reload."+id)],true),metric("consWork"+c.slot,"作用时间",a.workTime,"s",[props("Consumable","WorkTime.Ship"),props("Consumable","WorkTime."+id)]),metric("consCount"+c.slot,"使用次数",a.numConsumables,"次",[props("Consumable","Uses.Ship"),props("Consumable","Uses."+id)])].filter(r=>r.base>0);
      (cons[c.slot] ||= []).push({id:c.consumableName+" "+c.consumableVariantName,name:local("DOCK_CONSUME_TITLE_"+c.consumableName.toUpperCase(),c.consumableName),metrics});
    }
    for(const [slot,options] of Object.entries(cons))groups.push({id:"cons"+slot,label:"消耗品 "+(Number(slot)+1),options});
    const hullUpgrades=(s.shipUpgradeInfo?.shipUpgrades || []).filter(u=>u.ucType==="Hull");
    const hullGroup=groups.find(g=>g.id==="hull");
    if(hullGroup)for(const o of hullGroup.options){const u=hullUpgrades.find(u=>u.components?.Hull?.includes(o.id));o.compatible=u?.components?.Artillery || [];}
    // Research order follows actual predecessor chains, rather than alphabetical module names.
    for(const group of groups){ const uc={hull:"Hull",main:"Artillery",fireControl:"Suo",torpedo:"Torpedoes",engine:"Engine"}[group.id];const chain=(s.shipUpgradeInfo?.shipUpgrades || []).filter(u=>u.ucType===uc);const component={hull:"Hull",main:"Artillery",fireControl:"Suo",torpedo:"Torpedoes",engine:"Engine"}[group.id];const rank=id=>{let u=chain.find(u=>u.components?.[component]?.includes(id)),depth=0,seen=new Set();while(u?.prev&&!seen.has(u.name)){seen.add(u.name);depth++;u=chain.find(x=>x.name===u.prev);}return depth;};group.options.sort((a,b)=>rank(a.id)-rank(b.id));}
    return {id:s.index,gameId:s.id,rawName:s.name,name:glossary.ships?.[s.id]?.title || local("IDS_"+s.index,s.name),english:clean(englishNames.ships?.[s.id] || en["IDS_"+s.name.toUpperCase()] || en["IDS_"+s.index] || s.name),type:s.shipClass,nation:s.shipNation,tier:s.tier,category:s.shipCategory,groups,upgrades:upgrades.filter(u=>u.allow.includes(s.name) || (!u.deny.includes(s.name)&&u.tiers.includes(s.tier)&&u.classes.includes(s.shipClass)&&u.nations.some(n=>n.toLowerCase()===s.shipNation.toLowerCase()))).map(u=>u.id)};
  });
  return {schema:1,version:version.currentVersion.mainVersion,revision:version.currentVersionCode,updatedAt:new Date().toISOString(),source:"https://github.com/WoWs-Builder-Team/DataConverter",skills,commanders,upgrades,ships};
}
module.exports={normalizeData,CLASSES};
