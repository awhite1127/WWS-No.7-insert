"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs/promises"),os=require("node:os"),path=require("node:path");
const c=JSON.parse(require("node:zlib").gunzipSync(require("node:fs").readFileSync(path.join(__dirname,"../public/planner-catalog.json.gz"))).toString("utf8"));
const {defaultBuild,skillTree,tier,normalizeSkills,toggleSkill,calculate,recommendations,restoreBuild,moduleOptions,repairModules,spentPoints,commanderKind,commanderProfiles,plannerShipVisible,equipTopModules,commanderLabel}=require("../src/build-planner.ts");
const {createPlannerService}=require("../electron/planner-service.cjs");
const ship=id=>c.ships.find(s=>s.id===id);
const value=(s,b,key)=>calculate(c,s,b).rows.find(r=>r.key.endsWith('.'+key))?.value;
const close=(a,b)=>assert.ok(Math.abs(a-b)<.000001,`${a} != ${b}`);
test("all five classes have complete skill trees, valid modules and real upgrade slots",()=>{
 for(const type of ['Battleship','Cruiser','Destroyer','AirCarrier','Submarine']){
  const ships=c.ships.filter(s=>s.type===type);assert.ok(ships.length>0);
  assert.equal(skillTree(c,ships[0]).length,type==='Submarine'?20:24);
  for(const s of ships){const b=defaultBuild(s,c.version);assert.ok(s.groups.some(g=>g.id==='hull'));for(const g of s.groups)assert.ok(moduleOptions(s,b,g).some(o=>o.id===b.modules[g.id]));for(const id of s.upgrades)assert.ok(c.upgrades.some(u=>u.id===id));}
 }
});
test("ship specific unique upgrades stay on their compatible ship",()=>{
 assert.ok(ship('PJSB018').upgrades.includes('PCM046'));assert.ok(!ship('PGSB210').upgrades.includes('PCM046'));
});
test("skill prerequisite, removal cascade and point budget cannot leave an illegal tree",()=>{
 const s=ship('PJSB018'),tree=skillTree(c,s),b=defaultBuild(s,c.version);b.budget=10;
 assert.deepEqual(normalizeSkills([12],tree,s.type,10),[]);
 b.skills=normalizeSkills([12,23,3,21],tree,s.type,10);assert.equal(b.skills.length,4);
 toggleSkill(tree.find(s=>s.id===21),b,tree,s.type);assert.deepEqual(b.skills,[]);
 b.skills=normalizeSkills([21,3,23,12,14],tree,s.type,10);assert.equal(b.skills.reduce((n,id)=>n+tier(tree.find(s=>s.id===id),s.type).cost,0),10);
});
test("concealment bonuses stack multiplicatively and do not alter base figures",()=>{
 const s=ship('PJSB018'),b=defaultBuild(s,c.version);b.skills=[12];b.upgrades=['PCM027'];
 close(value(s,b,'concealment'),17.46*.9*.9);assert.equal(calculate(c,s,b).rows.find(r=>r.key==='hull.concealment').base,17.46);
});
test("cruiser and destroyer survivability expert use distinct tier bonuses",()=>{
 for(const type of ['Cruiser','Destroyer']){const s=c.ships.find(s=>s.type===type&&s.tier===10),b=defaultBuild(s,c.version),base=value(s,b,'hp');b.skills=[25];close(value(s,b,'hp'),base+10*(type==='Cruiser'?450:350));}
});
test("adrenaline rush follows HP and combines with main battery upgrade",()=>{
 const s=ship('PJSB018'),b=defaultBuild(s,c.version);b.skills=[23];b.upgrades=['PCM013'];b.hp=50;close(value(s,b,'mainReload'),30*.88*.9);b.hp=100;close(value(s,b,'mainReload'),30*.88);
});
test("secondary range, reload and manual aiming condition respond independently",()=>{
 const s=ship('PGSB210'),b=defaultBuild(s,c.version);b.skills=[40,26];b.upgrades=['PCM012'];close(value(s,b,'secondaryRange'),8.3*1.2*1.2);
 const before=value(s,b,'secondaryDispersion');b.conditions['26:0']=1;close(value(s,b,'secondaryDispersion'),before*.5);
});
test("carrier aircraft groups are populated and survivability is per aircraft",()=>{
 const s=ship('PJSA110'),b=defaultBuild(s,c.version);assert.ok(s.groups.filter(g=>g.id.startsWith('plane')).length>=3);const base=value(s,b,'planeHp');assert.ok(base>100);b.skills=[56];close(value(s,b,'planeHp'),base+250);
});
test("submarine dive capacity and sonar exist and respond to their upgrades",()=>{
 const s=c.ships.find(s=>s.type==='Submarine'&&s.tier===10),b=defaultBuild(s,c.version);assert.ok(value(s,b,'battery')>0);assert.ok(value(s,b,'sonarRange')>0);const before=value(s,b,'batteryRegen');b.upgrades=['PCM082'];close(value(s,b,'batteryRegen'),before*1.1);const capacity=value(s,b,'battery');b.upgrades=['PCM086'];close(value(s,b,'battery'),capacity*1.15);
});
test("special commander enhanced skills differ and talents are off in ranked",()=>{
 const s=ship('PGSB210'),b=defaultBuild(s,c.version);b.commanderId='PGW103';const commander=c.commanders.find(x=>x.id===b.commanderId);assert.ok(commander);const base=value(s,b,'mainReload');const talent=commander.talents.find(t=>t.modifiers.some(m=>m.name==='GMShotDelay'));b.talents[talent.id]=1;close(value(s,b,'mainReload'),base*.925);b.mode='ranked';close(value(s,b,'mainReload'),base);
});
test("every recommended build is legal at all common leveling budgets",()=>{
 for(const s of c.ships){const tree=skillTree(c,s);for(const p of recommendations(c,s,'random'))for(const budget of [10,14,17,21]){const picks=normalizeSkills(p.skills,tree,s.type,budget);assert.ok(picks.length);assert.ok(picks.reduce((n,id)=>n+tier(tree.find(s=>s.id===id),s.type).cost,0)<=budget);const slots=p.upgrades.map(id=>{assert.ok(s.upgrades.includes(id));return c.upgrades.find(u=>u.id===id).slot;});assert.equal(slots.length,new Set(slots).size);}}
});
test("import sanitizes incompatible commander, duplicate slots, budget and modules",()=>{
 const b=restoreBuild({schema:1,shipId:'PJSB018',budget:99,hp:-10,commanderId:'PGW103',skills:[12,9999],upgrades:['PCM046','PCM013','PCM057'],modules:{hull:'invalid'},name:'x'},c);assert.equal(b.budget,21);assert.equal(b.hp,0);assert.equal(b.commanderId,'');assert.deepEqual(b.skills,[]);assert.equal(b.upgrades.length,1);assert.equal(b.upgrades[0],'PCM046');assert.ok(ship(b.shipId).groups[0].options.some(o=>o.id===b.modules.hull));assert.throws(()=>restoreBuild({schema:1,shipId:'bogus'},c));
});
test("changing hull repairs incompatible main battery selection",()=>{
 const s=c.ships.find(s=>s.groups.find(g=>g.id==='hull')?.options.some(o=>o.compatible?.length));const b=defaultBuild(s,c.version);b.modules.main='bogus';repairModules(s,b);assert.ok(moduleOptions(s,b,s.groups.find(g=>g.id==='main')).some(o=>o.id===b.modules.main));
});
test("HE fire chance adds percentage points and heavy HE/SAP changes damage",()=>{
 const s=c.ships.find(s=>s.type==='Cruiser'&&s.tier===10&&s.groups.some(g=>g.id==='main'&&g.options.some(o=>o.metrics.some(m=>m.key==='mainDamageHE')))),b=defaultBuild(s,c.version);
 const damage=value(s,b,'mainDamageHE'),fire=value(s,b,'mainFireHE');b.skills=[8,47];close(value(s,b,'mainDamageHE'),damage*1.1);close(value(s,b,'mainFireHE'),fire+1);
});
test("forced same-version update checks coalesce without downloading all data",async()=>{
 let calls=0;const service=createPlannerService({cacheFile:path.join(os.tmpdir(),'wws-no-planner-cache-'+Date.now()+'.json'),fetcher:async()=>{calls++;return {ok:true,text:async()=>JSON.stringify({currentVersionCode:c.revision})};}});
 await Promise.all([service.get(true),service.get(true)]);assert.equal(calls,1);
});
test("catalog is lazy, offline capable, and retains the usable snapshot after update failure",async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'wws-planner-'));try{await fs.writeFile(path.join(dir,'cache.json'),'invalid');let calls=0;const service=createPlannerService({cacheFile:path.join(dir,'cache.json'),fetcher:async()=>{calls++;throw new Error('offline');}});const data=await service.get();assert.equal(data.ships.length,c.ships.length);assert.equal(calls,0);await assert.rejects(service.get(true),/offline/);assert.equal((await service.get()).version,c.version);}finally{await fs.rm(dir,{recursive:true,force:true});}
});

test("bundled catalog icons exist so all classes work offline",async()=>{
 for(const [kind,entries] of [["skill",c.skills],["upgrade",c.upgrades]]){
  for(const entry of entries)await fs.access(path.join(__dirname,"../public/planner-icons",kind+"-"+entry.icon+".png"));
  await fs.access(path.join(__dirname,"../public/planner-icons/fallback-"+kind+".png"));
 }
});

const byName=name=>c.ships.find(s=>s.english===name);
const preset=(name,id)=>recommendations(c,byName(name),'random').find(r=>r.id===id);
test("community battleship recipes distinguish Schlieffen, Libertad and Yamato",()=>{
 assert.deepEqual(preset('Schlieffen','schlieffen').skills,[8,33,23,12,42,40,26]);
 assert.deepEqual(preset('Libertad','libertad').skills,[18,61,23,12,14,40,26]);
 for(const [name,id] of [['Schlieffen','schlieffen'],['Libertad','libertad']])for(const mode of ['random','ranked'])assert.deepEqual(recommendations(c,byName(name),mode).map(r=>r.id),[id]);
 const yamato=preset('Yamato','yamato');assert.ok(yamato.skills.includes(44));assert.ok(yamato.skills.includes(42));
 assert.ok(!recommendations(c,byName('Yamato'),'random').some(r=>r.id==='secondary'));
 const nagato=preset('Nagato','yamato');assert.ok(nagato.skills.includes(2));assert.ok(!nagato.skills.includes(44));
});
test("destroyer branches retain the ten point core and switch at Akizuki",()=>{
 const s=byName('Shimakaze'),p=preset('Shimakaze','shimakaze');
 assert.deepEqual(normalizeSkills(p.skills,skillTree(c,s),s.type,10),[18,20,25,12]);
 assert.ok(!p.skills.includes(1));assert.ok(preset('Harugumo','harugumo').skills.includes(9));
 assert.ok(preset('Harugumo','harugumo-ifhe').skills.includes(33));
 assert.ok(preset('Hatsuharu','shimakaze'));assert.ok(!recommendations(c,byName('Hatsuharu'),'random').some(r=>r.id==='harugumo'));
});
test("AP and SAP cruisers avoid useless fire skills and radar recipe chooses radar",()=>{
 const s=byName('Minotaur'),radar=preset('Minotaur','minotaur-radar'),smoke=preset('Minotaur','minotaur-smoke');
 assert.ok(radar.skills.includes(34));assert.ok(Object.values(radar.moduleChoices).some(id=>id.includes('RLSSearch')));
 assert.ok(Object.values(smoke.moduleChoices).some(id=>id.includes('SmokeGenerator')));
 for(const p of recommendations(c,s,'random'))for(const id of [8,47,38,21])assert.ok(!p.skills.includes(id));
 for(const p of recommendations(c,byName('Venezia'),'random'))assert.ok(!p.skills.includes(8));
 const des=preset('Des Moines','des-moines');assert.ok(des.upgrades.includes('PCM042'));
});
test("CV adaptations use current costs and do not give HE or skip bombers AP/dive skills",()=>{
 for(const name of ['Midway','Kaga','Admiral Nakhimov','Audacious'])for(const p of recommendations(c,byName(name),'random'))assert.ok(!p.skills.includes(48));
 for(const p of recommendations(c,byName('Admiral Nakhimov'),'random'))assert.ok(!p.skills.includes(54));
 assert.ok(preset('Manfred von Richthofen','km-cv').skills.includes(48));
 assert.ok(preset('Thrasher','thrasher').skills.includes(77));assert.ok(!preset('U-2501','u2501').skills.includes(77));
});
test("source references stay explicit and random recipes are not labelled ranked recommendations",()=>{
 let covered=0;
 for(const s of c.ships){
  const plans=recommendations(c,s,'random');if(plans.some(r=>r.origin==='community'))covered++;
  for(const r of plans){assert.equal(spentPoints({...defaultBuild(s,c.version),skills:r.skills},skillTree(c,s),s.type),21);if(r.origin==='community'){assert.ok(r.source.url.startsWith('https://www.wowbuilds.com/guide/'));assert.equal(r.source.updated,'2026-08-26');}}
  for(const r of recommendations(c,s,'ranked')){assert.equal(r.origin,'rule');assert.equal(r.source,undefined);assert.match(r.note,/尚未/);}
 }
 assert.ok(covered>=150);
});


test("planner excludes copy variants and filters tech tree tiers while retaining original premiums",()=>{
 for(const id of ["PZSC720","PGSB928","PGSB598","PGSC890","PJSC890","PJSB700"]){const s=c.ships.find(s=>s.id===id);assert.ok(s);assert.ok(!plannerShipVisible(s),s.name);}
 for(const name of ["Schlieffen","Libertad","Tirpitz","Hindenburg","HSF Harekaze"]){assert.ok(plannerShipVisible(byName(name)),name);}
 assert.ok(plannerShipVisible(c.ships.find(s=>s.category==="TechTree"&&s.tier===10)));
 assert.ok(plannerShipVisible(c.ships.find(s=>s.category==="TechTree"&&s.tier===11)));
 assert.ok(c.ships.some(s=>s.category==="Premium"&&s.tier<10&&plannerShipVisible(s)));
 assert.ok(!plannerShipVisible(c.ships.find(s=>s.category==="TechTree"&&s.tier===9)));
});
test("captain profiles preserve different national enhancements and talent ownership",()=>{
 assert.equal(commanderKind(),"normal");
 const us=commanderProfiles(c,"Usa","special");assert.equal(us.length,2);
 assert.equal(us.reduce((n,p)=>n+p.ids.length,0),c.commanders.filter(x=>x.nation==="Usa"&&!x.talents.length).length);
 assert.ok(us.every(p=>!p.commander.talents.length));
 for(const nation of new Set(c.commanders.map(x=>x.nation))){const profiles=commanderProfiles(c,nation,"legendary");assert.ok(profiles.every(p=>p.commander.nation===nation&&p.commander.talents.length));}
 assert.equal(commanderLabel(c.commanders.find(x=>x.id==="PJW018")),"山本五十六");
});
test("default best modules use radar where available and practical torpedo options",()=>{
 const dm=ship("PASC020"),b=defaultBuild(dm,c.version);assert.ok(Object.values(b.modules).some(id=>id.includes("RLSSearch")));
 const shima=c.ships.find(s=>s.english==="Shimakaze"),sb=defaultBuild(shima,c.version);
 assert.equal(shima.groups.find(g=>g.id==="torpedo").options.find(o=>o.id===sb.modules.torpedo).metrics.find(m=>m.key.startsWith("torpRange")).base,12);
 const hull=dm.groups.find(g=>g.id==="hull");b.modules.hull=hull.options[0].id;equipTopModules(dm,b);assert.equal(b.modules.hull,hull.options.at(-1).id);
});


test("user battleship survival recipes match the supplied 21 point trees and strict AA range threshold",()=>{
 const base=ship("PJSB018");
 assert.deepEqual(recommendations(c,base,"random").find(p=>p.id==="survival").skills,[21,3,23,44,14,12,42]);
 for(const range of [5.7,5.8,6]){const s=structuredClone(base);for(const o of s.groups.find(g=>g.id==="hull").options)o.metrics.find(m=>m.key==="aaRange").base=range;
  const preset=recommendations(c,s,"random").find(p=>p.id==="aa-survival");assert.equal(Boolean(preset),range>5.8);
  if(preset){assert.deepEqual(preset.skills,[21,3,61,23,44,12,14,35]);const b=defaultBuild(s,c.version);b.skills=preset.skills;assert.equal(spentPoints(b,skillTree(c,s),s.type),21);}
 }
});
test("consumable stat headings track equipped radar and smoke by actual name",()=>{
 const s=ship("PBSC110"),b=defaultBuild(s,c.version);
 for(const keyword of ["RLSSearch","SmokeGenerator"]){const group=s.groups.find(g=>g.options.some(o=>o.id.includes(keyword))),o=group.options.find(o=>o.id.includes(keyword));b.modules[group.id]=o.id;
 const rows=calculate(c,s,b).rows.filter(r=>r.key.startsWith(group.id+"."));assert.ok(rows.length);assert.ok(rows.every(r=>r.group===o.name));assert.ok(!rows.some(r=>/^消耗品 \d/.test(r.group)));}
});
