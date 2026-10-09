export type ShipClass = "Battleship" | "Cruiser" | "Destroyer" | "AirCarrier" | "Submarine";
export interface Modifier { name: string; value: number; properties: string[]; mode: string; display?: string; label: string; unit?: string }
export interface Metric { key: string; label: string; base: number; unit: string; properties: string[]; lower: boolean }
export interface ModuleOption { id: string; name: string; metrics: Metric[]; compatible?: string[]; factor?: number; supportsDpm?: boolean; speedFactor?: number }
export interface ModuleGroup { id: string; label: string; options: ModuleOption[] }
export interface Skill { id: number; key: string; name: string; description: string; icon: string; tiers: { type: ShipClass; cost: number; column: number }[]; modifiers: Modifier[]; conditions: { id: string; label: string; limit: number; modifiers: Modifier[] }[] }
export interface Upgrade { id: string; name: string; description: string; icon: string; slot: number; type: string; modifiers: Modifier[] }
export interface Commander { id: string; name: string; nation: string; skills: Skill[]; talents: {id: string; name: string; description: string; classes: string[]; battleGroup: string; modifiers: Modifier[]; levels: { level: number; modifiers: Modifier[] }[] }[] }
export interface PlannerShip { id: string; gameId: number; rawName: string; name: string; english: string; type: ShipClass; nation: string; tier: number; category: string; groups: ModuleGroup[]; upgrades: string[] }
export interface PlannerCatalog { schema: number; version: string; revision: number; updatedAt: string; source: string; ships: PlannerShip[]; skills: Skill[]; upgrades: Upgrade[]; commanders: Commander[] }
export interface Build { schema: 1; shipId: string; name: string; version: string; budget: number; commanderId: string; mode: "random" | "ranked"; modules: Record<string,string>; upgrades: string[]; skills: number[]; hp: number; conditions: Record<string,number>; talents: Record<string,number> }
export const classLabels: Record<ShipClass,string> = { Battleship:"战列舰", Cruiser:"巡洋舰", Destroyer:"驱逐舰", AirCarrier:"航空母舰", Submarine:"潜艇" };
export const nationLabels: Record<string,string> = {Japan:"日本",Usa:"美国",USA:"美国",Germany:"德国",Russia:"苏联",France:"法国",UnitedKingdom:"英国",Italy:"意大利",Europe:"欧洲",PanAsia:"泛亚",PanAmerica:"泛美",Commonwealth:"英联邦",Netherlands:"荷兰",Spain:"西班牙"};
export function skillTree(catalog: PlannerCatalog, ship: PlannerShip, commanderId = "") {
  const overrides = catalog.commanders.find(c=>c.id===commanderId && c.nation===ship.nation)?.skills || [];
  return catalog.skills.map(s=>overrides.find(o=>o.id===s.id)||s).filter(s=>s.tiers.some(t=>t.type===ship.type)).sort((a,b)=>{const x=tier(a,ship.type),y=tier(b,ship.type);return x.cost-y.cost||x.column-y.column;});
}
export function tier(s: Skill, type: ShipClass) { return s.tiers.find(t=>t.type===type)!; }
export type CommanderKind="normal"|"special"|"legendary";
// Verified Chinese usages in WG zh-sg localization: PCQC006_YAMAMOTO_TITLE,
// SA_ZHENBING, PRSC210_DESCR and TALENT_PHW100_2_21. Other names remain
// the official localized name rather than an unverified transliteration.
export function commanderLabel(c:Commander){return ({PJW018:"山本五十六",PZW426:"萨镇冰",PRW406:"尼古拉·库兹涅佐夫",PHW100:"Conrad Helfrich"} as Record<string,string>)[c.id]||c.name;}
export function commanderKind(commander?:Commander):CommanderKind { return !commander?"normal":commander.talents.length?"legendary":"special"; }
export function commanderProfiles(c:PlannerCatalog,nation:string,kind:CommanderKind){
  const grouped=new Map<string,{commander:Commander;names:string[];ids:string[]}>();
  for(const commander of c.commanders.filter(c=>c.nation===nation&&commanderKind(c)===kind)){
    const signature=JSON.stringify([commander.skills.map(s=>({id:s.id,modifiers:s.modifiers,conditions:s.conditions})),commander.talents]);
    const group=grouped.get(signature);if(group){group.names.push(commander.name);group.ids.push(commander.id);}else grouped.set(signature,{commander,names:[commander.name],ids:[commander.id]});
  }
  return [...grouped.values()];
}
// Cosmetic/collaboration variants share an original hull; keep the original entry.
// Named variants have no consistent localization prefix, so use their stable IDs.
export function plannerShipVisible(ship:PlannerShip){
  const duplicate=/_(Black|Colorful|CLR|Azur|AZUR|MC)_/.test(ship.rawName)||/^(AL |ARP )/.test(ship.english)||/ CLR$/.test(ship.english.replace(/\s/g," "))||["PZSC720","PGSB928"].includes(ship.id);
  return !duplicate&&(ship.category!=="TechTree"||ship.tier===10||ship.tier===11);
}
export function equipTopModules(ship:PlannerShip,build:Build){
  for(const g of ship.groups){
    let best=g.options.at(-1)!;
    if(g.id.startsWith("cons")){for(const keyword of ["RLSSearch","SonarSearch","SmokeGenerator","SpeedBooster","Spotter","Fighter"]){const match=g.options.find(o=>o.id.includes(keyword));if(match){best=match;break;}}}
    if(g.id==="torpedo"&&/Shimakaze|Yamagiri/.test(ship.english)){best=g.options.find(o=>o.metrics.some(m=>m.key.startsWith("torpRange")&&Math.abs(m.base-12)<.01))||best;}
    build.modules[g.id]=best.id;
  }
  repairModules(ship,build);
}
export function defaultBuild(ship: PlannerShip, version: string): Build {
  const build: Build = {schema:1,shipId:ship.id,name:"我的配装",version,budget:21,commanderId:"",mode:"random",modules:Object.fromEntries(ship.groups.map(g=>[g.id,g.options.at(-1)!.id])),upgrades:[],skills:[],hp:100,conditions:{},talents:{}};
  equipTopModules(ship,build); return build;
}
export function moduleOptions(ship: PlannerShip, build: Build, group: ModuleGroup) {
  if(group.id!=="main")return group.options;
  const hull = ship.groups.find(g=>g.id==="hull")?.options.find(o=>o.id===build.modules.hull);
  return hull?.compatible?.length ? group.options.filter(o=>hull.compatible!.includes(o.id)) : group.options;
}
export function repairModules(ship: PlannerShip, build: Build) {
  for(const g of ship.groups){ const options=moduleOptions(ship,build,g);if(!options.some(o=>o.id===build.modules[g.id]))build.modules[g.id]=options.at(-1)?.id || g.options[0].id; }
}
export function normalizeSkills(ids: number[], tree: Skill[], type: ShipClass, budget: number) {
  const valid: number[]=[]; let points=0;
  // Revisit deferred choices so imported unordered lists still receive prerequisite validation.
  let pending=[...new Set(ids)]; let progress=true;
  while(progress){progress=false;const deferred:number[]=[];for(const id of pending){const s=tree.find(s=>s.id===id);if(!s)continue;const cost=tier(s,type).cost;if(cost>1&&!valid.some(i=>tier(tree.find(s=>s.id===i)!,type).cost===cost-1)){deferred.push(id);continue;}if(points+cost>budget)continue;valid.push(id);points+=cost;progress=true;}pending=deferred;}
  return valid;
}
export function canSelect(skill: Skill, build: Build, tree: Skill[], type: ShipClass) {
  if(build.skills.includes(skill.id))return true;
  const cost=tier(skill,type).cost;
  return spentPoints(build,tree,type)+cost<=build.budget&&(cost===1||build.skills.some(id=>tree.some(s=>s.id===id&&tier(s,type).cost===cost-1)));
}
export function spentPoints(build: Build, tree: Skill[], type: ShipClass) { return build.skills.reduce((n,id)=>n+(tree.find(s=>s.id===id)?.tiers.find(t=>t.type===type)?.cost||0),0); }
export function toggleSkill(skill: Skill, build: Build, tree: Skill[], type: ShipClass) {
  if(build.skills.includes(skill.id))build.skills=normalizeSkills(build.skills.filter(id=>id!==skill.id),tree,type,build.budget);
  else if(canSelect(skill,build,tree,type))build.skills.push(skill.id);
}
export function applicableModifiers(mods: Modifier[], type: ShipClass) {
  return mods.filter(m=>!/(Cruiser|Destroyer|Battleship|AirCarrier|Submarine|Auxiliary)$/.test(m.name)||m.name.endsWith("_"+type));
}
export function modifierText(m: Modifier) {
  let amount: string;
  if(m.mode==="NegativeMultiplier")amount="每损失 1% 生命值："+m.value+"%";
  else if(m.mode==="AddPercentage")amount="+"+Number((m.value*100).toFixed(2))+" 个百分点";
  else if(["DecimalRoundedPercentage","InverseNegativePercentage","RawOrPercentage"].includes(m.display || "") && m.unit==="Percent")amount=((m.value-1)*100>=0?"+":"")+Number(((m.value-1)*100).toFixed(2))+"%";
  else amount=(m.value>0?"+":"")+Number(m.value.toFixed(3))+(m.unit==="Percent"?"%":m.unit==="Seconds"?" s":"");
  return m.label+" "+amount;
}
export function selectedModifiers(c: PlannerCatalog, ship: PlannerShip, build: Build) {
  const mods: Modifier[]=[];const tree=skillTree(c,ship,build.commanderId);
  for(const id of build.upgrades) {const u=c.upgrades.find(u=>u.id===id&&ship.upgrades.includes(id));if(u)mods.push(...u.modifiers);}
  for(const id of build.skills){const s=tree.find(s=>s.id===id);if(!s)continue;mods.push(...s.modifiers.map(m=>m.name==="lastChanceReloadCoefficient"?{...m,value:m.value*(100-build.hp)}:m));for(const group of s.conditions){const count=build.conditions[id+":"+group.id] || 0;if(count>0){const times=group.limit===1?1:Math.min(1000,count);for(const m of group.modifiers){mods.push({...m,value:m.mode==="Multiplier"?Math.pow(m.value,times):m.value*times});}}}}
  const commander=c.commanders.find(c=>c.id===build.commanderId&&c.nation===ship.nation);
  if(build.mode!=="ranked")for(const t of commander?.talents || []){if(!t.classes.includes(ship.type))continue;const level=build.talents[t.id] || 0;if(level>0)mods.push(...(t.levels.find(l=>l.level===level)?.modifiers || t.modifiers));}
  return applicableModifiers(mods,ship.type);
}
function apply(base: number, mods: Modifier[], properties: string[], key: string) {
  let result=base;
  for(const property of properties){const matches=mods.filter(m=>m.properties.includes(property));let multiplier=1,add=0;for(const m of matches){if(m.mode==="Multiplier")multiplier*=m.value;else if(m.mode==="RawAdd"||m.mode==="AddPercentage")add+=m.value*(m.mode==="AddPercentage"&&key.includes("Fire")?100:1);else if(m.mode==="SubtractPercentage")add-=m.value;else if(m.mode==="NegativeMultiplier")multiplier*=1+(key==="aaDps"?1:-1)*m.value/100;}result=result*multiplier+add;}
  return Math.max(0,result);
}
export function calculate(c: PlannerCatalog, ship: PlannerShip, build: Build) {
  const mods=selectedModifiers(c,ship,build); const picked=ship.groups.map(g=>({group:g,option:g.options.find(o=>o.id===build.modules[g.id]) || g.options.at(-1)!}));
  const caliber=picked.find(p=>p.group.id==="main")?.option.metrics.find(m=>m.key==="mainCaliber")?.base || 0;
  const rows=picked.flatMap(({group,option})=>option.metrics.map(metric=>{
    const properties=[...metric.properties];let base=metric.base;
    if(metric.key==="mainRange")base*=picked.find(p=>p.group.id==="fireControl")?.option.factor || 1;
    if(metric.key==="speed"||metric.key==="underwaterSpeed")base*=1+(picked.find(p=>p.group.id==="engine")?.option.speedFactor || 0);
    if(["concealment","airDetection"].includes(metric.key)&&caliber>=149)properties.push("ConcealmentDataContainer.Visibility.Big");
    let value=base;
    if(metric.key==="hp")value+=mods.filter(m=>m.name==="healthPerLevel_"+ship.type).reduce((n,m)=>n+m.value*ship.tier,0);
    value=apply(value,mods,properties,metric.key);
    if(metric.key==="planeHp")value+=mods.filter(m=>m.properties.includes("CvAircraftDataContainer.HpPerTier")).reduce((n,m)=>n+m.value*ship.tier,0);
    if(metric.key==="speed"&&ship.type==="Submarine")value=apply(value,mods,["ManeuverabilityDataContainer.PropellerShaftSpeed"],metric.key);
    return {...metric,key:group.id+"."+metric.key,group:group.id.startsWith("cons")?option.name:group.label,properties,base,value,delta:value-base};
  }));
  const barrels=rows.find(r=>r.key==="main.mainBarrels"),reload=rows.find(r=>r.key==="main.mainReload");
  if(barrels&&reload&&reload.value>0&&picked.find(p=>p.group.id==="main")?.option.supportsDpm)for(const ammo of ["AP","HE","SAP"]){const damage=rows.find(r=>r.key==="main.mainDamage"+ammo);if(damage)rows.push({key:"main.dpm"+ammo,label:ammo+"理论每分钟伤害",base:damage.base*barrels.base*60/reload.base,value:damage.value*barrels.value*60/reload.value,delta:damage.value*barrels.value*60/reload.value-damage.base*barrels.base*60/reload.base,unit:"",lower:false,properties:[],group:"主炮"});}
  const covered=new Set(rows.flatMap(r=>r.properties));covered.add("SurvivabilityDataContainer.Hp");covered.add("CvAircraftDataContainer.HpPerTier");
  const other=mods.filter(m=>!m.properties.some(p=>covered.has(p))&&!(m.mode==="Multiplier"&&m.value===1)&&m.value!==0);
  return {rows,other};
}
export interface Recommendation {
  id: string; name: string; description: string; skills: number[]; upgrades: string[]; note: string;
  origin: "community" | "rule"; source?: { url: string; updated: string }; moduleChoices?: Record<string,string>;
}
interface Recipe {
  id: string; name: string; description: string; skills: number[]; style: "survival" | "main" | "secondary" | "torpedo" | "utility";
  ships?: string; type?: ShipClass; page?: string; minTier?: number; maxTier?: number; caliber?: number; consumable?: "SmokeGenerator" | "RLSSearch"; preferConsumable?: "RLSSearch";
}
const GUIDE_ROOT="https://www.wowbuilds.com/guide/tech-tree-branches-analogous-premiums-and-t10-ships/";
// Skill IDs and pick orders were checked against the linked Gameplay Helpers diagrams.
// CV diagrams still use retired skills/old costs; their recipes below are adaptations to 15.8.
const communityRecipes: Recipe[] = [
  {id:"yamato",name:"日系主炮 · 隐蔽防火",type:"Battleship",style:"survival",ships:"Kawachi|Myogi|Ishizuchi|Kongo|Fuso|Ise|Mutsu|Nagato|Ashitaka|Hyuga|Amagi|Kii|Izumo|Bajie|Hizen|Musashi|Iwami|Yamato|Shikishima|Satsuma",page:"battleships/ijn-bbs-yamato-line",skills:[18,3,23,14,12,42,44],description:"优先防火与肾上腺素，随后隐蔽和维修；低级专属舰长改用基本存活性。"},
  {id:"schlieffen",name:"德系战巡 · 副炮穿深",type:"Battleship",style:"secondary",ships:"Zieten|Prinz Rupprecht|Schlieffen",page:"battleships/km-bcs-schlieffen-line",skills:[8,33,23,12,42,40,26],description:"保留隐蔽和维修专家，惯性引信强化副炮穿深；引信会降低基础点火率。"},
  {id:"libertad",name:"泛美战列 · 副炮生存",type:"Battleship",style:"secondary",ships:"Ipiranga|Los Andes|Libertad",page:"battleships/panamerican-bbs-libertad-line",skills:[18,61,23,12,14,40,26],description:"隐蔽加速、防火和副炮射程，避免套用施里芬的惯性引信配置。"},
  {id:"preussen",name:"德系战列 · 主炮生存",type:"Battleship",style:"survival",ships:"Nassau|Konig Albert|Kaiser|Konig|Bayern|Prinz Eitel Friedrich|Gneisenau|Scharnhorst|Bismarck|Tirpitz|Friedrich der Grosse|Pommern|Preussen|Grosser Kurfurst|Hannover",page:"battleships/km-bbs-preussen-line",skills:[18,35,23,14,12,42,44],description:"以防火、隐蔽和维修为核心；该线副炮方案作为休闲备选，不默认当最优方案。"},
  {id:"shimakaze",name:"日系雷驱 · 隐蔽定位",type:"Destroyer",style:"torpedo",ships:"Umikaze|Wakatake|Tachibana|Isokaze|Mutsuki|Minekaze|Kamikaze|Fujin|Fubuki|Hatsuharu|Shinonome|Akatsuki|Shiratsuyu|Yudachi|Kagero|Yukikaze|Asashio|Yugumo|Minegumo|Shimakaze|Yamagiri",page:"destroyers/ijn-torpedoboat-dds-shimakaze-line",skills:[18,20,25,12,23,34,4,3],description:"前十点保证背水、生存与隐蔽，后续鱼雷装填和无线电定位；不以炮驱技能填满点数。"},
  {id:"harugumo",name:"日系炮驱 · 烟雾输出",type:"Destroyer",style:"main",ships:"Harekaze|Akizuki|Kitakaze|Harugumo",minTier:8,caliber:100,page:"destroyers/ijn-gunboat-dds-harugumo-line",skills:[18,20,25,12,23,9,1,13],description:"八级以上炮驱使用射程与装填；低级分支仍按雷驱配置。"},
  {id:"harugumo-ifhe",name:"日系炮驱 · 惯性引信备选",type:"Destroyer",style:"main",ships:"Harekaze|Akizuki|Kitakaze|Harugumo",minTier:8,caliber:100,page:"destroyers/ijn-gunboat-dds-harugumo-line",skills:[18,20,25,12,23,9,33,13],description:"以主炮装填技能换取惯性引信，侧重穿透 32 mm 装甲；牺牲点火率。"},
  {id:"gearing",name:"美系驱逐 · 炮雷均衡",type:"Destroyer",style:"main",ships:"Sampson|Wickes|Smith|Clemson|Nicholas|Hill|Farragut|Mahan|Sims|Benson|Fletcher|Gearing|Joshua Humphreys",page:"destroyers/usn-universaltype-dds-gearing-line",skills:[18,20,25,12,23,1,4,6],description:"前十点生存隐蔽，兼顾炮击与鱼雷；短射程鱼雷的低级船优先炮击。"},
  {id:"gearing-torp",name:"美系驱逐 · 高级雷击",type:"Destroyer",style:"torpedo",ships:"Monaghan|Fletcher|Benham|Gearing|Somers|Joshua Humphreys",minTier:6,page:"destroyers/usn-universaltype-dds-gearing-line",skills:[18,20,25,12,23,4,24,6,13],description:"装填、鱼雷航速与消耗品强化，适合有远程鱼雷的美系高级船。"},
  {id:"delny",name:"苏系炮驱 · 常规炮击",type:"Destroyer",style:"main",ships:"Storozhevoi|Izyaslav|Derzki|Podvoisky|Okhotnik|Gnevny|Gremyashchy|Minsk|Leningrad|Kiev|Udaloi|Tashkent|Delny|Khabarovsk|Zorkiy",page:"destroyers/vmf-soviet-gunboat-dds-delny-line",skills:[18,20,25,12,23,9,1,13],description:"射程优先并保留隐蔽；安装维修小组时把装填技能换为监督者。"},
  {id:"delny-open",name:"苏系炮驱 · 明水输出",type:"Destroyer",style:"main",ships:"Delny|Khabarovsk|Zorkiy",minTier:10,page:"destroyers/vmf-soviet-gunboat-dds-delny-line",skills:[18,20,25,9,17,23,64,13],description:"放弃隐蔽专家，强化射程与无畏斗士；适合熟悉明水走位的玩家。"},
  {id:"daring",name:"英系驱逐 · 消耗品争点",type:"Destroyer",style:"utility",ships:"Medea|Valkyrie|Wakeful|Acasta|Icarus|Jervis|Lightning|Cossack|Jutland|Somme|Daring",page:"destroyers/rn-dds-daring-line",skills:[13,20,25,12,23,17,1,6],description:"短烟、水听与监督者维持争点能力；不推荐无效的鱼雷航速或纯雷击技能堆叠。"},
  {id:"des-moines",preferConsumable:"RLSSearch",name:"美系重巡 · 雷达主炮",type:"Cruiser",style:"main",ships:"Pensacola|New Orleans|Indianapolis|Baltimore|Wichita|Anchorage|Rochester|Buffalo|Tulsa|Des Moines|Salem|Annapolis",page:"cruisers/usn-cas-des-moines-line",skills:[21,6,17,12,23,25,63,13],description:"优先装备雷达与监督者；无维修的练线船提前学习肾上腺素。"},
  {id:"worcester",preferConsumable:"RLSSearch",name:"美系轻巡 · 雷达支援",type:"Cruiser",style:"utility",ships:"Chester|St. Louis|Charleston|Phoenix|Omaha|Marblehead|Rattlehead|Dallas|Helena|Boise|Cleveland|AL Montpelier|Seattle|Worcester|Jacksonville",page:"cruisers/usn-cls-worcester-line",skills:[13,6,17,12,23,25,63,21],description:"消耗品强化、隐蔽与顶尖炮手；雷达不可用时会改用适用的二级技能。"},
  {id:"worcester-low",name:"美系六七级轻巡 · 穿深",type:"Cruiser",style:"main",ships:"Dallas|Helena|Boise",minTier:6,maxTier:7,page:"cruisers/usn-cls-worcester-line",skills:[13,8,23,12,17,25,33,21],description:"专属六七级舰长的引信备选，强化穿深；不作为高等级雷达轻巡的默认方案。"},
  {id:"hindenburg",name:"德系重巡 · 隐蔽输出",type:"Cruiser",style:"main",ships:"Yorck|Admiral Hipper|Prinz Eugen|Roon|Hindenburg|Clausewitz",page:"cruisers/km-hindenburg-cas-line",skills:[21,43,17,12,23,25,63,13],description:"保留隐蔽和生存，侦察机可用时强化射控；不默认采用高风险灯塔流。"},
  {id:"venezia",name:"意系巡洋 · SAP 主炮",type:"Cruiser",style:"main",ships:"Nino Bixio|Taranto|Alberto di Giussano|Montecuccoli|Genova|Trento|Zara|Gorizia|Amalfi|Brindisi|Venezia|Piemonte",page:"cruisers/italian-casvenezia-line",skills:[21,43,17,12,23,25,63,3],description:"装填切弹、隐蔽与顶尖炮手；不加入对 SAP 无效的点火技能。"},
  {id:"minotaur-smoke",name:"英系轻巡 · 烟雾主炮",type:"Cruiser",style:"main",ships:"Weymouth|Caledon|Danae|Emerald|Leander|Orion 44|Mysore|Fiji|Edinburgh|Tiger 59|Neptune|Minotaur|Edgar",consumable:"SmokeGenerator",page:"cruisers/rn-cls-minotaur-line",skills:[19,6,23,12,17,25,63,13],description:"应用时选择烟雾，强化消耗品与生存；纯 AP 配置不学习点火或重型 HE。"},
  {id:"minotaur-radar",name:"英系轻巡 · 雷达定位",type:"Cruiser",style:"utility",ships:"Edinburgh|Tiger 59|Neptune|Minotaur|Edgar",consumable:"RLSSearch",page:"cruisers/rn-cls-minotaur-line",skills:[19,6,23,12,17,25,34,13],description:"应用时切换雷达，以无线电定位代替顶尖炮手；偏向高风险反驱逐玩法。"},
  {id:"ijn-cv",name:"日系航母 · AP 与续航",type:"AirCarrier",style:"main",ships:"Ryujo|Shokaku|Hakuryu|Sekiryu",page:"aircraft-carriers/ijn-cvs",skills:[29,16,56,10,53,48,59,11],description:"强化飞机生存、AP 与鱼雷；依据当前技能点成本适配旧版指南。"},
  {id:"kaga",name:"加贺 · 鱼雷与续航",type:"AirCarrier",style:"torpedo",ships:"Kaga",page:"aircraft-carriers/ijn-cvs",skills:[29,16,56,10,53,59,57,11,32],description:"按实际 HE 轰炸机移除 AP 技能，侧重飞机续航和鱼雷；旧维修技能不沿用。"},
  {id:"usn-cv",name:"美系航母 · 轰炸续航",type:"AirCarrier",style:"main",ships:"Langley|Ranger|Lexington|Midway|Enterprise|Saipan",page:"aircraft-carriers/usn-cvs",skills:[29,16,10,56,54,53,11,15],description:"以轰炸机、生存与瞄准为核心；旧图技能已按当前表重排，不配置无效的 AP 加成。"},
  {id:"km-cv",name:"德系航母 · AP 攻击",type:"AirCarrier",style:"main",ships:"Rhein|Weser|August von Parseval|Manfred von Richthofen|Graf Zeppelin",page:"aircraft-carriers/km-cvs",skills:[29,16,10,56,48,53,54,11],description:"AP 弹药强化结合飞机生存；按当前技能成本重新安排后续点数。"},
  {id:"vmf-cv",name:"苏系航母 · 攻击中队",type:"AirCarrier",style:"torpedo",ships:"Komsomolets|Serov|Pobeda|Admiral Nakhimov|Chkalov",page:"aircraft-carriers/vmf-cvs",skills:[29,16,56,10,59,53,15,11],description:"跳弹机不套用俯冲轰炸机控制技能，HE 攻击机不配置 AP 弹药加成。"},
  {id:"rn-cv",name:"英系航母 · HE 轰炸",type:"AirCarrier",style:"main",ships:"Hermes|Furious|Ark Royal|Implacable|Audacious",page:"aircraft-carriers/rn-cvs",skills:[29,16,10,56,53,54,46,11],description:"强化 HE 轰炸和飞机生存；排除不适用的 AP 技能，不沿用旧维修技能。"},
  {id:"u2501",name:"德系潜艇 · 蓄电续航",type:"Submarine",style:"survival",ships:"U-69|U-190|U-2501",page:"submarines/german-sub-line-u2501-line",skills:[60,75,76,17,78,82,79,74],description:"监督者与消耗品专员强化后备蓄电池，配合电量、机动和肾上腺素。"},
  {id:"balao",name:"美系潜艇 · 均衡续航",type:"Submarine",style:"survival",ships:"Cachalot|Salmon|Balao|Gato",page:"submarines/us-sub-line-gato-line",skills:[74,75,76,78,79,17,82,60],description:"机动、戒备、消耗品与电量优先，避免默认堆叠依赖双标记的攻击技能。"},
  {id:"thrasher",name:"英系潜艇 · 电量效率",type:"Submarine",style:"survival",ships:"Undine|Sturdy|Thrasher",page:"submarines/rn-sub-line-thrasher-line",skills:[60,75,76,77,78,82,79],description:"同时强化蓄电池容量与效率，消耗品专员提供后续支援。"},
];
function normalizedShipName(name:string){return name.normalize("NFKD").replace(/[\u0300-\u036f]/g,"").replace(/ B$/i,"").replace(/[^a-z0-9]/gi,"").toLowerCase();}
export function recommendations(c: PlannerCatalog, ship: PlannerShip, mode: Build["mode"], build?:Build): Recommendation[] {
  const option=(g:ModuleGroup)=>g.options.find(o=>o.id===build?.modules[g.id])||g.options.at(-1)!;
  const main=ship.groups.find(g=>g.id==="main"),metrics=main?option(main).metrics:[];
  const hasHE=metrics.some(m=>m.key==="mainDamageHE"),hasSAP=metrics.some(m=>m.key==="mainDamageSAP");
  const torp=ship.groups.find(g=>g.id==="torpedo"),hasTorp=Boolean(torp);
  const longTorp=torp&&option(torp).metrics.some(m=>m.key.startsWith("torpRange")&&m.base>=8);
  const consumed=ship.groups.filter(g=>g.id.startsWith("cons")).map(g=>option(g).id).join(" ");
  const repair=consumed.includes("RegenCrew"),enhancedConsumables=/SonarSearch|RLSSearch|SmokeGenerator|SpeedBooster/.test(consumed),spotter=/Spotter/.test(consumed);
  const shipName=normalizedShipName(ship.english);
  const matched=communityRecipes.filter(r=>r.type===ship.type&&(!r.caliber||metrics.some(m=>m.key==="mainCaliber"&&m.base===r.caliber))&&ship.tier>=(r.minTier||1)&&ship.tier<=(r.maxTier||11)&&r.ships!.split("|").some(n=>normalizedShipName(n)===shipName));
  const generic:Recipe[]=[];
  if(ship.type==="Battleship") {
    generic.push({id:"survival",name:"通用生存流",style:"survival",description:"火炮装填手、齿轮润滑、肾上腺素与改进型维修，配合防火、隐蔽和紧急维修。",skills:[21,3,23,44,14,12,42]});
    const hull=ship.groups.find(g=>g.id==="hull"),aaRange=hull?option(hull).metrics.find(m=>m.key==="aaRange")?.base||0:0;
    if(aaRange>5.8)generic.push({id:"aa-survival",name:"防空生存流",style:"survival",description:"防空最大射程大于 5.8 km 时提供；以防火、隐蔽与改进型维修为核心，加入隐蔽加速及对空防御和反潜作战专家。",skills:[21,3,61,23,44,12,14,35]});
    generic.push({id:"main",name:"通用 · 机动生存",style:"main",description:"以隐蔽加速换取转炮技能，侧重转场；不额外叠加有代价的炮弹技能。",skills:[18,61,23,12,14,42,ship.tier<=7?2:44]});
    if(ship.nation==="Germany"&&ship.tier>=7&&ship.groups.some(g=>g.options.some(o=>o.metrics.some(m=>m.key==="secondaryRange"))))generic.push({id:"secondary",name:"备选 · 副炮近战",style:"secondary",description:"休闲副炮配置，保留维修与防火；不强制采用施里芬专属的惯性引信。",skills:[18,3,23,14,42,40,26]});
  } else if(ship.type==="Cruiser") {
    generic.push({id:"survival",name:"通用 · 隐蔽生存",style:"survival",description:"生存、隐蔽与消耗品优先，不套用有口径门槛的炮弹技能。",skills:[20,28,23,12,17,25,63,19]});
    generic.push({id:"main",name:"通用 · 主炮输出",style:"main",description:"隐蔽、肾上腺素与顶尖炮手；纯 AP 舰船改用敌袭预警。",skills:[hasHE||hasSAP?21:19,28,23,12,63,25,17,13]});
    if(enhancedConsumables)generic.push({id:"utility",name:"通用 · 定位支援",style:"utility",description:"强化实际装备的消耗品与无线电定位。",skills:[13,6,23,12,17,25,34,19]});
    if(longTorp)generic.push({id:"torpedo",name:"备选 · 远程鱼雷",style:"torpedo",description:"仅对有远程鱼雷的船提供，不代表适合放弃主炮作战。",skills:[24,4,23,12,30,25,34,20]});
  } else if(ship.type==="Destroyer") {
    generic.push({id:"survival",name:"通用 · 隐蔽争点",style:"survival",description:"前十点采用预防、背水、生存与隐蔽；后续兼顾实际武器。",skills:[18,20,25,12,23,1,hasTorp?4:17,enhancedConsumables?6:hasTorp?24:hasHE?8:39]});
    generic.push({id:"main",name:"通用 · 炮击输出",style:"main",description:"保留隐蔽和生存，再选择射程与装填。",skills:[18,20,25,12,23,9,1,13]});
    if(longTorp)generic.push({id:"torpedo",name:"通用 · 隐蔽雷击",style:"torpedo",description:"鱼雷装填与定位优先，不向短射程船默认推荐纯雷击配置。",skills:[18,20,25,12,23,34,4,3]});
  } else if(ship.type==="AirCarrier") {
    const damageSkill=ship.groups.some(g=>g.id==="planeDiveBomber")?54:ship.groups.some(g=>g.id==="planeTorpedoBomber")?59:45;
    generic.push({id:"survival",name:"通用 · 飞机续航",style:"survival",description:"依据实际机种选择轰炸或鱼雷技能，不默认选 AP 弹药或旧维修技能。",skills:[29,16,10,56,53,damageSkill,15,11]});
  } else {
    generic.push({id:"survival",name:"通用 · 均衡续航",style:"survival",description:"电量、戒备、机动与消耗品优先；未知船型使用规则参考。",skills:[74,75,76,78,79,17,82,60]});
    generic.push({id:"torpedo",name:"备选 · 双标记攻击",style:"torpedo",description:"依赖声呐双标记条件，作为可自由调整的攻击备选。",skills:[68,75,76,73,78,82,79]});
  }
  const available=c.upgrades.filter(u=>ship.upgrades.includes(u.id));
  const result:Recommendation[]=[];
  const exclusive=ship.id==="PGSB210"?"schlieffen":ship.id==="PVSB010"?"libertad":"";
  const recipes=exclusive?matched.filter(r=>r.id===exclusive):[...matched,...generic];
  for(const r of recipes) {
    const choices:Record<string,string>={};
    const intended=r.consumable||r.preferConsumable;
    if(intended){const group=ship.groups.find(g=>g.id.startsWith("cons")&&g.options.some(o=>o.id.includes(intended)));if(!group&&r.consumable)continue;if(group)choices[group.id]=group.options.find(o=>o.id.includes(intended))!.id;}
    let skills=[...r.skills];
    if(r.id==="yamato"||r.id==="preussen")skills=skills.map(id=>id===44&&ship.tier<=7?2:id);
    if(r.id==="delny"&&repair)skills=skills.map(id=>id===1?17:id);
    if(ship.type==="Cruiser") {
      if(!repair){const si=skills.indexOf(17),ar=skills.indexOf(23);if(si>=0&&ar>si)[skills[si],skills[ar]]=[skills[ar],skills[si]];}
      if(skills.includes(43)&&!spotter)skills=skills.map(id=>id===43?28:id);
      if(skills.includes(6)&&!enhancedConsumables&&!r.consumable)skills=skills.map(id=>id===6?28:id);
      if(!hasHE&&!hasSAP)skills=skills.map(id=>id===21?19:id);
      if(r.id==="venezia"&&ship.tier<=8)skills=skills.map(id=>id===3?20:id);
    }
    const effectiveConsumed=ship.groups.filter(g=>g.id.startsWith("cons")).map(g=>choices[g.id]||option(g).id).join(" ");
    const prefs:Record<number,string[]>={0:["PCM030","PCM031"],1:["PCM020","PCM069"],2:r.style==="secondary"?["PCM012"]:r.style==="torpedo"?["PCM070","PCM033"]:["PCM033","PCM028","PCM091"],3:r.style==="survival"?["PCM023","PCM025","PCM024"]:["PCM024","PCM025","PCM090"],4:["PCM027","PCM009","PCM088"],5:r.style==="secondary"?["PCM074","PCM013"]:r.style==="torpedo"?["PCM014","PCM089"]:["PCM013","PCM016","PCM015"]};
    if(ship.type==="Destroyer")prefs[1]=["PCM069"];
    if((ship.type==="Cruiser"||ship.type==="Battleship")&&effectiveConsumed.includes("SonarSearch"))prefs[1]=["PCM041","PCM020","PCM069"];
    if(ship.type==="Cruiser"&&effectiveConsumed.includes("RLSSearch"))prefs[1]=["PCM042","PCM041","PCM069"];
    if(ship.type==="Submarine"){prefs[0]=["PCM084"];prefs[1]=["PCM085","PCM069"];prefs[2]=["PCM082"];prefs[3]=["PCM090"];prefs[4]=["PCM101","PCM091","PCM102"];prefs[5]=["PCM086"];}
    if(ship.type==="AirCarrier"){prefs[0]=["PCM003"];prefs[1]=["PCM068"];prefs[2]=["PCM066","PCM067","PCM065","PCM092"];prefs[3]=["PCM093","PCM064","PCM063","PCM081"];prefs[4]=["PCM009","PCM073"];prefs[5]=["PCM016","PCM017"];}
    const upgrades=[...new Set(available.map(u=>u.slot))].map(slot=>prefs[slot]?.map(id=>available.find(u=>u.id===id&&u.slot===slot)).find(Boolean)?.id).filter((id):id is string=>Boolean(id));
    result.push({id:r.id,name:r.name,description:r.description,skills:normalizeSkills(skills,skillTree(c,ship),ship.type,21),upgrades,moduleChoices:choices,origin:r.page?"community":"rule",source:r.page?{url:GUIDE_ROOT+r.page,updated:"2026-08-26"}:undefined,note:r.page?"社区线路参考 · 来源更新 2026-08-26 · 已按当前技能表和舰船装备适配。":ship.type==="Battleship"&&["survival","aa-survival"].includes(r.id)?"按用户提供的 21 点方案整理 · 可自由调整。":"通用规则参考 · 非该船专属方案，可自由调整。"});
  }
  if(exclusive)return result.map(r=>({...r,origin:"rule",source:undefined,note:"按用户提供的 21 点副炮方案整理 · 可自由调整。"+(mode==="ranked"?"尚未按当期排位地图和赛制审核。":"")}));
  // These references are for random battles. Ranked must not inherit the same preset unchanged.
  if(mode==="ranked")return result.filter(r=>r.origin==="rule").map(r=>({...r,note:"排位规则参考 · 尚未按当期地图和赛制审核；社区随机战方案不直接套用。"}));
  return result;
}
export function restoreBuild(input: unknown, c: PlannerCatalog): Build {
  if(!input||typeof input!=="object")throw new Error("方案格式不正确");
  const v=input as Partial<Build>;const ship=c.ships.find(s=>s.id===v.shipId);if(!ship||v.schema!==1)throw new Error("方案舰船不存在或格式不兼容");
  const b=defaultBuild(ship,c.version);b.version=typeof v.version==="string"?v.version.slice(0,32):c.version;b.name=typeof v.name==="string"?v.name.slice(0,80):b.name;b.budget=Number.isInteger(v.budget)?Math.max(0,Math.min(21,v.budget!)):21;b.hp=Number.isFinite(v.hp)?Math.max(0,Math.min(100,v.hp!)):100;b.mode=v.mode==="ranked"?"ranked":"random";
  b.commanderId=c.commanders.some(x=>x.id===v.commanderId&&x.nation===ship.nation)?v.commanderId!:"";
  for(const g of ship.groups)if(typeof v.modules?.[g.id]==="string")b.modules[g.id]=v.modules[g.id];repairModules(ship,b);
  const used=new Set<number>();b.upgrades=(Array.isArray(v.upgrades)?v.upgrades:[]).filter((id):id is string=>{const u=c.upgrades.find(u=>u.id===id&&ship.upgrades.includes(id));if(!u||used.has(u.slot))return false;used.add(u.slot);return true;});
  b.skills=normalizeSkills(Array.isArray(v.skills)?v.skills:[],skillTree(c,ship,b.commanderId),ship.type,b.budget);
  for(const s of skillTree(c,ship,b.commanderId))for(const g of s.conditions){const key=s.id+":"+g.id;const count=v.conditions?.[key];if(Number.isFinite(count))b.conditions[key]=Math.max(0,Math.min(g.limit>0?g.limit:1000,count!));}
  for(const t of c.commanders.find(x=>x.id===b.commanderId)?.talents || []){const level=v.talents?.[t.id];if(level===1||t.levels.some(l=>l.level===level))b.talents[t.id]=level!;}
  return b;
}
