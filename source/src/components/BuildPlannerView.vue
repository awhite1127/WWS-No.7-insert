<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref, watch } from "vue";
import { applicableModifiers, calculate, canSelect, classLabels, defaultBuild, modifierText, commanderLabel, commanderKind, commanderProfiles, equipTopModules, plannerShipVisible, nationLabels, normalizeSkills, recommendations, repairModules, restoreBuild, skillTree, spentPoints, tier, toggleSkill } from "../build-planner";
import type { Build, PlannerCatalog, Recommendation, ShipClass, Skill, Upgrade, CommanderKind } from "../build-planner";
const catalog=ref<PlannerCatalog|null>(null),build=ref<Build|null>(null),shipId=ref("PGSB210"),query=ref(""),filter=ref<ShipClass|"">(""),busy=ref(false),message=ref(""),error=ref(""),openSlot=ref<number|null>(null),schemeOpen=ref(false),nationFilter=ref(""),popupStyle=ref<Record<string,string>>({}),tooltipStyle=ref<Record<string,string>>({}),inspect=ref<Skill|Upgrade|null>(null),shareOpen=ref(false),shareText=ref(""),saved=ref<Build[]>([]),activeRecommendation=ref("");
const assetBase=import.meta.env.BASE_URL;
let stopShipDataUpdates:(()=>void)|undefined;
function iconError(event:Event,kind:"skill"|"upgrade"){
  const image=event.target as HTMLImageElement;
  if(image.dataset.fallback===kind)return;
  image.dataset.fallback=kind;
  image.src=assetBase+"planner-icons/fallback-"+kind+".png";
}
const SAVE_KEY="wws.planner.saved.v1",DRAFT_KEY="wws.planner.draft.v1";
const ship=computed(()=>catalog.value?.ships.find(s=>s.id===shipId.value));
const filteredShips=computed(()=>catalog.value?.ships.filter(s=>plannerShipVisible(s)&&(!nationFilter.value||s.nation===nationFilter.value)&&(!filter.value||s.type===filter.value)&&(!query.value||[s.name,s.english,s.id,nationLabels[s.nation]].join(" ").toLowerCase().includes(query.value.trim().toLowerCase()))).sort((a,b)=>b.tier-a.tier||a.name.localeCompare(b.name,"zh-CN"))||[]);
const tree=computed(()=>catalog.value&&ship.value?skillTree(catalog.value,ship.value,build.value?.commanderId):[]);
const spent=computed(()=>build.value&&ship.value?spentPoints(build.value,tree.value,ship.value.type):0);
const available=computed(()=>catalog.value?.upgrades.filter(u=>ship.value?.upgrades.includes(u.id))||[]);
const slots=computed(()=>[...new Set(available.value.map(u=>u.slot))].sort((a,b)=>a-b));
const presets=computed(()=>catalog.value&&ship.value&&build.value?recommendations(catalog.value,ship.value,build.value.mode,build.value):[]);
const stats=computed(()=>catalog.value&&ship.value&&build.value?calculate(catalog.value,ship.value,build.value):{rows:[],other:[]});
const statGroups=computed(()=>[...new Set(stats.value.rows.map(r=>r.group))]);
const commanders=computed(()=>catalog.value?.commanders.filter(c=>c.nation===ship.value?.nation)||[]);
const selectedCommander=computed(()=>commanders.value.find(c=>c.id===build.value?.commanderId));
const talents=computed(()=>selectedCommander.value?.talents.filter(t=>t.classes.includes(ship.value!.type))||[]);
const detailModifiers=computed(()=>inspect.value&&ship.value?applicableModifiers(inspect.value.modifiers,ship.value.type).filter(m=>!inspect.value?.description||!/^[A-Za-z][A-Za-z0-9_]+$/.test(m.label)):[]);
const localBuilds=computed(()=>saved.value.filter(b=>b.shipId===shipId.value));
const displayedRecommendation=computed(()=>presets.value.find(p=>p.id===activeRecommendation.value));
const recommendedSkills=computed(()=>new Set(presets.value.find(p=>p.id===activeRecommendation.value)?.skills||[]));
function schemeName(name:string){return name.split(" · ").at(-1)?.trim()||name;}
function fmt(n:number,unit=""){return n.toLocaleString("zh-CN",{maximumFractionDigits:unit===""||unit==="次"||unit==="门"?0:2});}
function announce(text:string){message.value=text;error.value="";}
function selectedUpgrade(slot:number){return available.value.find(u=>u.slot===slot&&build.value?.upgrades.includes(u.id));}
function selectUpgrade(u:Upgrade|null,slot:number){if(!build.value)return;build.value.upgrades=build.value.upgrades.filter(id=>available.value.find(u=>u.id===id)?.slot!==slot);if(u)build.value.upgrades.push(u.id);openSlot.value=null;activeRecommendation.value="";}
function changeSkill(s:Skill){if(!build.value||!ship.value)return;toggleSkill(s,build.value,tree.value,ship.value.type);activeRecommendation.value="";}
function budgetChanged(){if(!build.value||!ship.value)return;build.value.budget=21;build.value.skills=normalizeSkills(build.value.skills,tree.value,ship.value.type,21);}
function commanderChanged(){if(!build.value)return;build.value.conditions={};build.value.talents={};budgetChanged();}
function applyPreset(p:Recommendation){if(!build.value||!ship.value)return;build.value.skills=normalizeSkills(p.skills,tree.value,ship.value.type,build.value.budget);build.value.upgrades=[...p.upgrades];equipTopModules(ship.value,build.value);Object.assign(build.value.modules,p.moduleChoices);repairModules(ship.value,build.value);build.value.conditions={};build.value.talents={};build.value.hp=100;build.value.name=ship.value.name+" · "+p.name;activeRecommendation.value=p.id;schemeOpen.value=false;announce("已应用推荐，可以继续自由调整。条件效果默认关闭。");}
function reset(){if(!ship.value||!catalog.value)return;build.value=defaultBuild(ship.value,catalog.value.version);activeRecommendation.value="";inspect.value=null;openSlot.value=null;announce("已重置技能和升级品，研发模块使用完全体配置。");}
function persistSaved(next:Build[]){try{localStorage.setItem(SAVE_KEY,JSON.stringify(next));saved.value=next;return true;}catch{error.value="本地存储空间不足，方案未保存。请复制方案代码备份。";return false;}}
function save(){if(!build.value||!catalog.value)return;const snapshot=restoreBuild(JSON.parse(JSON.stringify(build.value)),catalog.value);snapshot.version=catalog.value.version;const next=[snapshot,...saved.value.filter(b=>!(b.shipId===snapshot.shipId&&b.name===snapshot.name))].slice(0,100);if(persistSaved(next))announce("方案已保存到本机。");}
function loadSaved(b:Build){if(!catalog.value)return;const next=prepareBuild(b,catalog.value);nationFilter.value="";filter.value="";query.value="";shipId.value=next.shipId;build.value=next;schemeOpen.value=false;activeRecommendation.value="";announce(b.version===catalog.value.version?"已载入方案。":"方案来自旧数据版本，已校验当前可用技能和升级品，请复核。 ");}
function removeSaved(b:Build){persistSaved(saved.value.filter(x=>x!==b));}
function openShare(){if(!build.value)return;shareText.value=JSON.stringify({...build.value,version:catalog.value?.version});shareOpen.value=true;}
async function copyShare(){try{await navigator.clipboard.writeText(shareText.value);announce("方案代码已复制。");}catch{error.value="无法访问剪贴板，请选中文本手动复制。";}}
function importShare(){try{if(!catalog.value)return;if(shareText.value.length>65536)throw new Error("方案代码过长");const next=prepareBuild(JSON.parse(shareText.value),catalog.value);nationFilter.value="";filter.value="";query.value="";shipId.value=next.shipId;build.value=next;schemeOpen.value=false;activeRecommendation.value="";shareOpen.value=false;announce("方案已导入并校验。");}catch(e){error.value=e instanceof Error?e.message:"无法导入方案";}}
async function load(force=false){busy.value=true;error.value="";try{const data=await window.wws.getPlannerCatalog(force);catalog.value=data;if(build.value){build.value=prepareBuild(build.value,data);shipId.value=build.value.shipId;}else {try{const draft=JSON.parse(localStorage.getItem(DRAFT_KEY)||"null");if(draft){const next=prepareBuild(draft,data);nationFilter.value="";filter.value="";query.value="";shipId.value=next.shipId;build.value=next;schemeOpen.value=false;activeRecommendation.value="";}}catch{/* Invalid drafts do not prevent opening the planner. */}if(!build.value){if(!ship.value||!plannerShipVisible(ship.value))shipId.value=data.ships.find(plannerShipVisible)!.id;build.value=defaultBuild(ship.value!,data.version);}}try{const raw:unknown=JSON.parse(localStorage.getItem(SAVE_KEY)||"[]");saved.value=Array.isArray(raw)?raw.slice(0,100).flatMap(v=>{try{return [restoreBuild(v,data)];}catch{return [];}}):[];}catch{saved.value=[];}if(force)announce("游戏数据已检查，当前版本 "+data.version+"。");}catch(e){error.value="配装数据读取失败："+(e instanceof Error?e.message:String(e));}finally{busy.value=false;}}
watch(shipId,()=>{if(ship.value&&catalog.value){const kind=commanderKind(catalog.value.commanders.find(c=>c.id===build.value?.commanderId));build.value=defaultBuild(ship.value,catalog.value.version);build.value.commanderId=commanderProfiles(catalog.value,ship.value.nation,kind)[0]?.commander.id||"";inspect.value=null;openSlot.value=null;activeRecommendation.value="";}},{flush:"sync"});
watch(build,(b)=>{if(!b)return;try{localStorage.setItem(DRAFT_KEY,JSON.stringify(b));}catch{/* Explicit save reports storage errors; editing remains available. */}},{deep:true});
const nations=computed(()=>[...new Set(catalog.value?.ships.filter(plannerShipVisible).map(s=>s.nation)||[])].sort((a,b)=>(nationLabels[a]||a).localeCompare(nationLabels[b]||b,"zh-CN")));
const captainKind=computed(()=>commanderKind(selectedCommander.value));
const profiles=computed(()=>catalog.value&&ship.value?commanderProfiles(catalog.value,ship.value.nation,captainKind.value):[]);
const specialProfiles=computed(()=>catalog.value&&ship.value?commanderProfiles(catalog.value,ship.value.nation,"special"):[]);
const legendary=computed(()=>commanders.value.find(c=>c.talents.length));
const captainProfile=computed(()=>profiles.value.find(p=>p.ids.includes(build.value?.commanderId||""))?.commander.id||"");
function setCaptain(event:Event){if(!build.value)return;const kind=(event.target as HTMLSelectElement).value as CommanderKind;build.value.commanderId=kind==="normal"?"":commanderProfiles(catalog.value!,ship.value!.nation,kind)[0]?.commander.id||"";commanderChanged();}
function setProfile(event:Event){if(!build.value)return;build.value.commanderId=(event.target as HTMLSelectElement).value;commanderChanged();}
function profileLabel(c:typeof profiles.value[number]){return c.commander.skills.filter(s=>s.tiers.some(t=>t.type===ship.value!.type)).map(s=>s.name).join(" / ")||"其他舰种技能强化";}
function triggerSpace(cost:number){const counts=tree.value.filter(s=>tier(s,ship.value!.type).cost===cost).map(s=>s.conditions.length+(s.id===23||s.id===82?1:0));const count=Math.max(0,...counts);return count?count*19+8:0;}
function enhanced(s:Skill){return Boolean(selectedCommander.value?.skills.some(x=>x.id===s.id));}
function prepareBuild(raw:unknown,data:PlannerCatalog){const b=restoreBuild(raw,data),s=data.ships.find(s=>s.id===b.shipId)!;if(!plannerShipVisible(s))throw new Error("请使用原版舰船；银币舰船配装仅支持十级和超级战舰");const cons=Object.fromEntries(Object.entries(b.modules).filter(([k])=>k.startsWith("cons")));equipTopModules(s,b);Object.assign(b.modules,cons);repairModules(s,b);b.budget=21;b.skills=normalizeSkills(b.skills,skillTree(data,s,b.commanderId),s.type,21);return b;}
function filterChanged(){const first=filteredShips.value[0];if(first&&!filteredShips.value.some(s=>s.id===shipId.value))shipId.value=first.id;closeFloating();}
function closeFloating(){openSlot.value=null;schemeOpen.value=false;inspect.value=null;}
function anchor(event:Event,width:number,height:number){const r=(event.currentTarget as HTMLElement).getBoundingClientRect();return {left:Math.max(8,Math.min(r.left,innerWidth-width-8))+"px",top:Math.max(8,r.bottom+height>innerHeight?Math.max(8,r.top-height):r.bottom+6)+"px",width:Math.min(width,innerWidth-16)+"px",maxHeight:Math.min(height,innerHeight-16)+"px"};}
function openUpgrade(slot:number,event:Event){const same=openSlot.value===slot;closeFloating();if(!same){openSlot.value=slot;popupStyle.value=anchor(event,330,360);}}
function openScheme(event:Event){const same=schemeOpen.value;closeFloating();if(!same){schemeOpen.value=true;popupStyle.value=anchor(event,350,420);}}
let hideTimer:ReturnType<typeof setTimeout>|undefined;
function showTip(item:Skill|Upgrade,event:Event){clearTimeout(hideTimer);inspect.value=item;const r=(event.currentTarget as HTMLElement).getBoundingClientRect(),width=Math.min(330,innerWidth-16);tooltipStyle.value={left:Math.max(8,r.right+width+12<innerWidth?r.right+8:r.left-width-8)+"px",top:Math.max(8,Math.min(r.top,innerHeight-370))+"px",width:width+"px",maxHeight:Math.min(350,innerHeight-16)+"px"};}
function focusTip(item:Skill|Upgrade,event:Event){const target=event.currentTarget as HTMLElement;requestAnimationFrame(()=>{if(document.activeElement===target)showTip(item,{currentTarget:target} as unknown as Event);});}
function hideTip(){hideTimer=setTimeout(()=>inspect.value=null,90);}
function keepTip(){clearTimeout(hideTimer);}
function outside(event:Event){if(!(event.target as Element)?.closest?.("[data-planner-trigger],[data-planner-popup],.planner-tooltip"))closeFloating();}
function keydown(event:KeyboardEvent){if(event.key==="Escape")closeFloating();}
function scrolled(event:Event){if((event.target as Element)?.closest?.("[data-planner-popup],.planner-tooltip"))return;openSlot.value=null;schemeOpen.value=false;const focused=document.activeElement as HTMLElement|null;if(inspect.value&&focused?.matches(".planner-skill")&&focused.getAttribute("aria-label")?.startsWith(inspect.value.name+"，"))showTip(inspect.value,{currentTarget:focused} as unknown as Event);else inspect.value=null;}
function redistribute(){if(!build.value)return;build.value.skills=[];build.value.conditions={};build.value.hp=100;activeRecommendation.value="";}
watch([nationFilter,filter],filterChanged);
watch(()=>build.value?.skills.join(","),()=>{if(!build.value)return;for(const key of Object.keys(build.value.conditions))if(!build.value.skills.includes(Number(key.split(":")[0])))delete build.value.conditions[key];if(!build.value.skills.some(id=>id===23||id===82))build.value.hp=100;});
onMounted(()=>{load();stopShipDataUpdates=window.wws.onShipDataStatus(status=>{if(status.state==='ready'&&status.revision!==catalog.value?.revision)void load();});document.addEventListener("pointerdown",outside);document.addEventListener("keydown",keydown);window.addEventListener("resize",closeFloating);document.addEventListener("scroll",scrolled,true);});
onBeforeUnmount(()=>{stopShipDataUpdates?.();clearTimeout(hideTimer);document.removeEventListener("pointerdown",outside);document.removeEventListener("keydown",keydown);window.removeEventListener("resize",closeFloating);document.removeEventListener("scroll",scrolled,true);});
</script>

<template>
  <section class="planner">
    <div v-if="error" class="planner-notice" role="alert">{{ error }} <button v-if="!catalog" @click="load()">重试</button></div>
    <div v-if="!catalog" class="planner-loading">正在读取舰船配装数据…</div>
    <template v-if="catalog && ship && build">
      <Teleport to="#planner-header-controls"><div class="planner-card planner-controls">
      <div class="planner-search">
        <label><span>国家</span><select v-model="nationFilter" aria-label="筛选国家"><option value="">全部国家</option><option v-for="n in nations" :key="n" :value="n">{{ nationLabels[n] || n }}</option></select></label>
        <label><span>舰种</span><select v-model="filter" aria-label="筛选舰种"><option value="">全部舰种</option><option v-for="(label,key) in classLabels" :key="key" :value="key">{{ label }}</option></select></label>
        <label class="planner-ship-select"><span>详细舰船 · {{ filteredShips.length }}</span><select v-model="shipId" aria-label="选择舰船"><option v-if="!filteredShips.some(s=>s.id===shipId)" :value="shipId">{{ ship.name }}（当前）</option><option v-for="s in filteredShips" :key="s.id" :value="s.id">{{ s.tier===11?'★':s.tier }} · {{ s.name }} · {{ classLabels[s.type] }}</option></select></label>
        <label class="planner-search-input"><span>查找</span><input v-model="query" placeholder="中文名 / 英文名" aria-label="搜索舰船"/></label>
      </div>
        <aside class="planner-presets planner-scheme-row" aria-label="配装方案">
            <button class="planner-scheme" data-planner-trigger aria-label="选择配装方案" aria-haspopup="listbox" :aria-expanded="schemeOpen" @click="openScheme($event)"><small>当前方案</small><strong>{{ schemeName(displayedRecommendation?.name || build.name) }}</strong><span>⌄</span></button>
            <label class="planner-mode">战斗模式<select v-model="build.mode" aria-label="战斗模式" @change="activeRecommendation='' "><option value="random">随机战</option><option value="ranked">排位战</option></select></label>
            <div class="planner-scheme-notes"><details class="planner-recommendation-info"><summary>方案说明</summary><div class="planner-info-body"><p class="planner-footnote">{{ displayedRecommendation?.description || '自由选择技能和升级品，也可以从下拉列表应用推荐方案。' }}</p><p v-if="displayedRecommendation" class="planner-footnote">{{ displayedRecommendation.note }}</p>
            <a v-if="displayedRecommendation?.source" :href="displayedRecommendation.source.url" target="_blank" rel="noopener noreferrer">查看推荐来源 ↗</a></div></details></div>
            <details class="planner-save"><summary>保存与分享 <small>{{ localBuilds.length }} 个本地方案</small></summary><div class="planner-save-body"><input v-model="build.name" maxlength="80" aria-label="方案名称" placeholder="方案名称"/><button class="planner-primary" @click="save">保存当前方案</button><div v-for="b in localBuilds" :key="b.name" class="planner-saved-item"><button @click="loadSaved(b)">{{ b.name }}</button><button aria-label="删除保存方案" @click="removeSaved(b)">×</button></div><button class="planner-share" @click="openShare">导入 / 分享方案代码</button></div></details>
        </aside>
      </div></Teleport>
      <div class="planner-grid">
        <main class="planner-editor">
          <div class="planner-card planner-upgrades"><div class="planner-card-heading"><h3>舰船升级品</h3><div class="planner-upgrade-actions"><button @click="build.upgrades=[];activeRecommendation='';closeFloating()">清空</button><button @click="reset">重置配装</button></div></div>
            <div class="planner-upgrade-slots"><button v-for="slot in slots" :key="slot" data-planner-trigger :class="{selected:selectedUpgrade(slot),expanded:openSlot===slot}" :aria-label="'槽位 '+(slot+1)+' 升级品'" aria-haspopup="listbox" :aria-expanded="openSlot===slot" @click="openUpgrade(slot,$event)"><span class="planner-slot-label">槽位 {{ slot+1 }} <i>⌄</i></span><img v-if="selectedUpgrade(slot)" :src="assetBase+'planner-icons/upgrade-'+selectedUpgrade(slot)!.icon+'.png'" alt="" @error="iconError($event,'upgrade')"/><b v-else>＋</b><small>{{ selectedUpgrade(slot)?.name || '选择升级品' }}</small></button></div>
          </div>
          <div class="planner-card planner-skills"><h3>舰长技能 <small>{{ classLabels[ship.type] }} · 21 点</small></h3>
            <div class="planner-skill-toolbar"><label>舰长类型<select :value="captainKind" aria-label="选择舰长" @change="setCaptain"><option value="normal">普通舰长</option><option value="special" :disabled="!specialProfiles.length">特殊舰长</option><option value="legendary" :disabled="!legendary">{{ legendary?commanderLabel(legendary):'传奇舰长（该国暂无）' }}</option></select></label><details v-if="talents.length" class="planner-talents"><summary>传奇天赋 · {{ talents.length }}</summary><div class="planner-talents-body"><p v-if="build.mode==='ranked'" class="planner-footnote">排位战不计传奇天赋，强化技能仍然有效。</p><label v-for="t in talents" :key="t.id" :title="t.description"><span>{{ t.name }}</span><select v-if="t.levels.length" v-model="build.talents[t.id]" :disabled="build.mode==='ranked'" :aria-label="t.name+'触发等级'"><option :value="0">未触发</option><option v-for="l in t.levels" :key="l.level" :value="l.level">第 {{ l.level }} 阶段</option></select><input v-else type="checkbox" :checked="Boolean(build.talents[t.id])" :disabled="build.mode==='ranked'" :aria-label="t.name+'是否触发'" @change="build.talents[t.id]=($event.target as HTMLInputElement).checked?1:0"/></label></div></details><div class="planner-points"><strong>{{ 21-spent }}</strong><span>剩余点数<small>已用 {{ spent }} / 21</small></span></div><button class="planner-redistribute" @click="redistribute">重新分配</button></div>
            <label v-if="captainKind==='special' && profiles.length>1" class="planner-profile">强化技能配置<select :value="captainProfile" aria-label="特殊舰长强化配置" @change="setProfile"><option v-for="p in profiles" :key="p.commander.id" :value="p.commander.id">{{ profileLabel(p) }}</option></select></label>
            <div v-for="cost in 4" :key="cost" class="planner-skill-row" :style="{'--trigger-space':triggerSpace(cost)+'px'}"><span class="planner-row-cost">{{ cost }}<small>点</small></span><div class="planner-skill-nodes" :style="{'--skill-cols':ship.type==='Submarine'?5:6}"><div v-for="s in tree.filter(s=>tier(s,ship!.type).cost===cost)" :key="s.id" class="planner-skill-cell" :class="{selected:build.skills.includes(s.id)}">
              <button class="planner-skill" :class="{selected:build.skills.includes(s.id),locked:!canSelect(s,build,tree,ship.type),recommended:recommendedSkills.has(s.id),enhanced:enhanced(s)}" :aria-disabled="!canSelect(s,build,tree,ship.type)" :aria-pressed="build.skills.includes(s.id)" :aria-label="s.name+'，'+cost+'点'" @mouseenter="showTip(s,$event)" @mouseleave="hideTip" @focus="focusTip(s,$event)" @blur="hideTip" @click="changeSkill(s)"><img :src="assetBase+'planner-icons/skill-'+s.icon+'.png'" alt="" @error="iconError($event,'skill')"/><span>{{ s.name }}</span><b v-if="build.skills.includes(s.id)">{{ build.skills.indexOf(s.id)+1 }}</b><i v-else-if="recommendedSkills.has(s.id)">◆</i><em v-if="enhanced(s)" class="planner-enhanced-star" aria-label="舰长强化技能" title="舰长强化技能">★</em></button>
              <div v-if="build.skills.includes(s.id)&&(s.conditions.length||s.id===23||s.id===82)" class="planner-skill-triggers"><label v-if="s.id===23||s.id===82">生命值<input v-model.number="build.hp" type="number" min="0" max="100" :aria-label="s.name+'剩余生命值百分比'"/>%</label><label v-for="c in s.conditions" :key="c.id" :title="c.label"><template v-if="s.id===44&&c.id==='0'">潜伤倍数<input v-model.number="build.conditions[s.id+':'+c.id]" type="number" min="0" max="1000" :aria-label="s.name+'潜在伤害倍数'"/></template><template v-else-if="c.limit>1">触发次数<input v-model.number="build.conditions[s.id+':'+c.id]" type="number" min="0" :max="c.limit" :aria-label="s.name+'触发次数'"/></template><template v-else><input type="checkbox" :checked="Boolean(build.conditions[s.id+':'+c.id])" :aria-label="s.name+'是否触发 '+c.id" @change="build.conditions[s.id+':'+c.id]=($event.target as HTMLInputElement).checked?1:0"/>{{ build.conditions[s.id+':'+c.id]?'已触发':'未触发' }}</template></label></div>
            </div></div></div>
            <div class="planner-skill-legend"><span>● 已选</span><span>◆ 推荐</span><span>★ 舰长强化</span><small>按顺序加点，悬停查看说明</small></div>

          </div>
        </main>
        <aside class="planner-parameters"><div class="planner-card"><div class="planner-card-heading"><h3>参数变化</h3><span class="planner-live-dot">即时</span></div><div class="planner-stats-labels"><span>完全体基础 → 当前配装</span><span>变化量</span></div><details v-for="group in statGroups" :key="group" class="planner-stat-group" :open="['船体','主炮','鱼雷','声呐','攻击机','轰炸机','鱼雷机','弹跳轰炸机'].includes(group)"><summary>{{ group }}</summary><div v-for="r in stats.rows.filter(r=>r.group===group)" :key="r.key" class="planner-stat"><span>{{ r.label }} <small>{{ r.unit }}</small></span><div><small>{{ fmt(r.base,r.unit) }} →</small><strong>{{ fmt(r.value,r.unit) }}</strong><b :class="{good:Math.abs(r.delta)>.00001&&(r.lower?r.delta<0:r.delta>0),bad:Math.abs(r.delta)>.00001&&(r.lower?r.delta>0:r.delta<0)}">{{ Math.abs(r.delta)<.00001?'—':(r.delta>0?'+':'')+fmt(r.delta,r.unit) }}</b></div></div></details><p class="planner-footnote">绿色表示改善，红色表示代价。条件效果仅在标记触发后计入。</p><details v-if="stats.other.length" class="planner-other"><summary>其他效果 · {{ stats.other.length }}</summary><ul><li v-for="(m,i) in stats.other" :key="i">{{ modifierText(m) }}</li></ul></details><p class="planner-source">游戏数据 {{ catalog.version }} · 可离线使用</p></div></aside>
      </div>
<div class="planner-editor-footer"><span role="status">{{ message || '完全体模块 · 编辑自动保留草稿' }}</span></div>
      <Teleport to="body">
        <div v-if="openSlot!==null" class="planner-popup planner-upgrade-picker" data-planner-popup :style="popupStyle" role="listbox" aria-label="可安装升级品"><header>槽位 {{ openSlot+1 }} · 升级品 <button @click="closeFloating" aria-label="关闭升级品选择">×</button></header><button role="option" :aria-selected="!selectedUpgrade(openSlot)" @click="selectUpgrade(null,openSlot!)">不安装</button><button v-for="u in available.filter(u=>u.slot===openSlot)" :key="u.id" role="option" :aria-selected="build.upgrades.includes(u.id)" :class="{active:build.upgrades.includes(u.id)}" @mouseenter="showTip(u,$event)" @mouseleave="hideTip" @focus="focusTip(u,$event)" @blur="hideTip" @click="selectUpgrade(u,openSlot!);inspect=null"><img :src="assetBase+'planner-icons/upgrade-'+u.icon+'.png'" alt="" @error="iconError($event,'upgrade')"/><span>{{ u.name }}<small v-if="u.type==='Legendary'">独特升级品</small><small v-else-if="u.type!=='Normal'">特殊升级品</small></span></button></div>
        <div v-if="schemeOpen" class="planner-popup planner-scheme-picker" data-planner-popup :style="popupStyle" role="listbox" aria-label="配装方案列表"><header>推荐方案 <button @click="closeFloating" aria-label="关闭方案选择">×</button></header><button v-for="p in presets" :key="p.id" class="planner-preset" role="option" :aria-selected="activeRecommendation===p.id" @click="applyPreset(p)"><strong>{{ schemeName(p.name) }}</strong><small>{{ p.origin==='community'?'社区参考':'规则参考' }} · {{ p.description }}</small></button><header v-if="localBuilds.length">我的方案</header><button v-for="b in localBuilds" :key="b.name" role="option" @click="loadSaved(b)">{{ b.name }}</button></div>
        <div v-if="inspect" class="planner-tooltip" role="tooltip" :style="tooltipStyle" @mouseenter="keepTip" @mouseleave="hideTip"><h3>{{ inspect.name }}</h3><p v-if="typeof inspect.id==='number' && enhanced(inspect as Skill)" class="planner-tooltip-enhanced">★ 舰长强化技能 · 下列效果使用强化后的数值</p><p v-if="inspect.description">{{ inspect.description }}</p><ul><li v-for="(m,i) in detailModifiers" :key="i">{{ modifierText(m) }}</li></ul><template v-if="'conditions' in inspect"><div v-for="c in inspect.conditions" :key="c.id"><p class="planner-footnote">{{ c.label }}</p><ul><li v-for="(m,i) in applicableModifiers(c.modifiers,ship.type)" :key="i">{{ modifierText(m) }}</li></ul></div><p v-if="inspect.conditions.length" class="planner-footnote">选中技能后，可在图标下标记触发状态。</p></template></div>
      </Teleport>
      <div v-if="shareOpen" class="planner-modal" @click.self="shareOpen=false"><div class="planner-card"><div class="planner-card-heading"><h3>导入 / 分享配装</h3><button @click="shareOpen=false" aria-label="关闭分享窗口">×</button></div><p>复制当前方案代码分享，或粘贴其他方案后导入。</p><textarea v-model="shareText" spellcheck="false" aria-label="配装方案代码"/><div class="planner-modal-actions"><button @click="copyShare">复制代码</button><button class="planner-primary" @click="importShare">导入方案</button></div><p v-if="error" role="alert">{{ error }}</p></div></div>
    </template>
  </section>
</template>
<style scoped>
.planner{height:100%;min-height:0;overflow-y:auto;align-content:start;padding:4px 8px 20px 0;color:var(--ink);font-size:12px;display:grid;gap:14px}.planner *,.planner-popup *,.planner-tooltip *{box-sizing:border-box}.planner button,.planner-popup button{cursor:pointer;font:inherit;color:inherit}.planner button:focus-visible,.planner-popup button:focus-visible{outline:2px solid var(--planner-accent);outline-offset:2px}.planner-card{border:1px solid var(--planner-border);background:var(--planner-card);border-radius:12px;padding:16px;min-width:0}.planner h3,.planner-popup h3,.planner-tooltip h3{margin:0 0 14px;font-size:15px}.planner h3 small{font-size:10px;font-weight:400;color:var(--planner-muted);margin-left:8px}.planner-search{display:grid;grid-template-columns:120px 120px minmax(180px,1fr) minmax(120px,.5fr) auto;gap:12px;align-items:end}.planner label>span,.planner-search label>span{display:block;margin-bottom:5px;color:var(--planner-muted);font-size:11px}.planner input:not([type=checkbox]),.planner select,.planner textarea{width:100%;min-width:0;background:var(--planner-input);color:inherit;border:1px solid var(--planner-border);border-radius:6px;padding:7px;font:inherit}.planner select{height:34px}.planner input[type=checkbox]{accent-color:#d6b459}.planner-update,.planner-redistribute,.planner-card-heading>button,.planner-editor-footer button{border:1px solid var(--planner-border);border-radius:6px;background:transparent;padding:8px}.planner-update small{display:block;font-size:9px;color:#8494a5}.planner-grid{display:grid;grid-template-columns:190px minmax(390px,1fr) 300px;gap:14px;align-items:start;min-width:0}.planner-editor{display:grid;gap:14px;min-width:0}.planner-scheme{position:relative;background:var(--planner-input);border:1px solid var(--planner-border);border-radius:8px;padding:12px 28px 12px 10px;text-align:left;width:100%;color:inherit}.planner-scheme small{display:block;color:var(--planner-muted);margin-bottom:7px}.planner-scheme strong{display:block;font-size:13px;line-height:1.5}.planner-scheme>span{position:absolute;right:10px;top:50%}.planner-mode{display:block;margin-top:16px}.planner-mode select{margin-top:7px}.planner-footnote{font-size:11px;line-height:1.7;color:var(--text-muted,var(--planner-muted));white-space:pre-line}.planner-presets a{font-size:11px;color:var(--planner-accent)}.planner-save{border-top:1px solid var(--planner-border);margin-top:18px;padding-top:14px}.planner-save summary{cursor:pointer;font-size:12px}.planner-save summary small{display:block;color:var(--planner-muted);font-size:10px;margin:6px 0 12px}.planner-save>input{margin:8px 0}.planner-save>button{width:100%;margin-top:8px;padding:8px;border-radius:6px;border:1px solid var(--planner-border);background:transparent}.planner-save>.planner-primary,.planner-primary{background:#b49650!important;color:#101922!important;border:0!important}.planner-saved-item{display:flex;margin-top:7px;gap:5px}.planner-saved-item button{background:transparent;border:1px solid var(--planner-border);border-radius:4px;padding:5px}.planner-saved-item button:first-child{flex:1;overflow:hidden;text-overflow:ellipsis;text-align:left}.planner-card-heading{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;gap:8px}.planner-card-heading h3{margin:0}.planner-card-heading>button{font-size:10px;padding:4px 9px}.planner-upgrade-slots{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:6px}.planner-upgrade-slots button{min-width:0;border:1px solid var(--planner-border);border-radius:8px;background:var(--planner-input);padding:7px 4px;text-align:center;display:flex;flex-direction:column;align-items:center;gap:6px}.planner-upgrade-slots button.selected{border-color:#6e633f}.planner-upgrade-slots button.expanded{border-color:var(--planner-accent)}.planner-slot-label{font-size:9px;color:var(--planner-muted);width:100%;display:flex;justify-content:space-between;padding:0 3px}.planner-slot-label i{font-style:normal}.planner-upgrade-slots img{width:39px;height:39px;object-fit:contain}.planner-upgrade-slots b{height:39px;font-size:28px;font-weight:300;color:#7d91a4}.planner-upgrade-slots small{font-size:9px;line-height:1.4;min-height:26px}.planner-skill-toolbar{display:flex;gap:12px;align-items:center;margin-bottom:16px}.planner-skill-toolbar>label{flex:1;min-width:0;color:var(--planner-muted);font-size:10px}.planner-skill-toolbar select{margin-top:4px}.planner-points{display:flex;gap:8px;align-items:center;flex-shrink:0}.planner-points strong{color:var(--planner-accent);font-size:26px;font-weight:500}.planner-points span{font-size:11px;line-height:1.6}.planner-points small{display:block;color:var(--planner-muted);font-size:9px}.planner-redistribute{flex-shrink:0;font-size:11px!important}.planner-profile{display:flex;align-items:center;gap:10px;font-size:10px;color:#95a6b5;margin-bottom:14px}.planner-profile select{flex:1}.planner-skill-row{display:flex;gap:8px;padding:10px 0;border-top:1px solid var(--planner-border)}.planner-row-cost{width:15px;flex-shrink:0;font-size:14px;color:var(--planner-accent);padding-top:21px}.planner-row-cost small{display:block;font-size:9px}.planner-skill-nodes{display:grid;grid-template-columns:repeat(var(--skill-cols),minmax(0,1fr));gap:7px;flex:1;min-width:0}.planner-skill-cell{min-width:0}.planner-skill{position:relative;border:1px solid var(--planner-border);background:var(--planner-input);border-radius:7px;width:100%;min-height:85px;padding:8px 3px 6px;display:flex;flex-direction:column;align-items:center;gap:6px}.planner-skill img{height:37px;width:37px;object-fit:contain;opacity:.85}.planner-skill>span{font-size:9px;line-height:1.3;min-height:23px}.planner-skill.locked{opacity:.45}.planner-skill.selected{border-color:var(--planner-accent);background:var(--planner-selected)}.planner-skill.selected img{filter:sepia(1) saturate(2)}.planner-skill b,.planner-skill i{position:absolute;right:4px;top:3px;font-size:9px;color:var(--planner-accent);font-style:normal}.planner-skill em{position:absolute;left:2px;top:2px;font-size:8px;color:#79bdc2;font-style:normal}.planner-skill-triggers{display:grid;gap:4px;margin-top:5px}.planner-skill-triggers label{font-size:9px;display:flex;align-items:center;justify-content:center;gap:2px;color:var(--planner-accent);flex-wrap:wrap}.planner-skill-triggers input[type=number]{padding:2px;width:42px;font-size:9px}.planner-skill-triggers input[type=checkbox]{margin:0;width:12px;height:12px}.planner-skill-legend{display:flex;gap:10px;flex-wrap:wrap;font-size:9px;color:var(--planner-accent);padding-top:12px}.planner-skill-legend small{color:#8195a5;margin-left:auto;font-size:9px}.planner-talents{border-top:1px solid var(--planner-border);margin-top:15px;padding-top:12px}.planner-talents h4{margin:0 0 9px;font-size:12px;color:var(--planner-accent)}.planner-talents>label{display:flex;align-items:center;gap:8px;padding:6px 0}.planner-talents>label>span{margin:0;flex:1}.planner-talents select{max-width:110px;height:29px;padding:4px}.planner-editor-footer{display:flex;gap:10px;align-items:center;justify-content:space-between;font-size:10px;color:var(--planner-muted);line-height:1.7}.planner-editor-footer button{white-space:nowrap;font-size:10px}.planner-live-dot{color:#7ec1ad;font-size:10px}.planner-stats-labels{display:flex;justify-content:space-between;color:var(--planner-muted);font-size:9px;margin:15px 0 8px}.planner-stat-group{border-top:1px solid var(--planner-border);padding-top:9px;margin-top:9px}.planner-stat-group summary,.planner-other summary{cursor:pointer;font-size:12px;color:var(--planner-accent)}.planner-stat{padding:7px 0;border-bottom:1px solid var(--planner-border)}.planner-stat>span{font-size:10px;color:var(--planner-muted)}.planner-stat>span small{font-size:9px;color:#6f879b}.planner-stat>div{display:flex;gap:8px;align-items:baseline;margin-top:4px}.planner-stat>div small{font-size:10px;color:var(--planner-muted)}.planner-stat strong{font-size:13px;font-weight:500}.planner-stat b{margin-left:auto;font-size:10px;color:#748896}.planner-stat b.good{color:#73c4a5}.planner-stat b.bad{color:#e58e8e}.planner-other{font-size:10px;line-height:1.7}.planner-other ul{padding-left:16px}.planner-source{font-size:9px;color:var(--planner-muted);margin-top:18px}.planner-popup,.planner-tooltip{position:fixed;z-index:1000;background:var(--planner-card);color:var(--ink);border:1px solid #647063;border-radius:9px;box-shadow:0 12px 40px #0008;overflow-y:auto;padding:6px;font-size:12px}.planner-popup header{display:flex;align-items:center;justify-content:space-between;padding:8px 10px;color:#baa36c;font-size:11px}.planner-popup header button{border:0;background:none;color:inherit}.planner-popup>button{display:flex;width:100%;gap:10px;align-items:center;text-align:left;background:transparent;color:inherit;border:0;border-radius:5px;padding:10px;line-height:1.5}.planner-popup>button:hover,.planner-popup>button:focus,.planner-popup>button.active{background:var(--planner-hover)}.planner-popup img{width:37px;height:37px;object-fit:contain}.planner-popup small{display:block;font-size:10px;color:var(--planner-muted);margin-top:3px}.planner-popup .planner-preset{display:block}.planner-tooltip{z-index:1010;padding:16px;border-color:#8b7952;font-size:11px;line-height:1.7;overflow-wrap:anywhere}.planner-tooltip h3{font-size:14px;margin-bottom:10px;color:#dfc17e}.planner-tooltip p{white-space:pre-line;margin:8px 0}.planner-tooltip ul{padding-left:16px;margin:8px 0}.planner-modal{position:fixed;inset:0;background:#0009;z-index:1100;display:flex;align-items:center;justify-content:center;padding:30px}.planner-modal>.planner-card{width:650px;max-width:100%}.planner-modal textarea{height:240px;resize:vertical}.planner-modal-actions{display:flex;gap:10px;justify-content:flex-end;margin-top:12px}.planner-modal-actions button{border:1px solid #52616c;background:transparent;border-radius:6px;padding:8px 14px}.planner-notice{background:#52302e;border:1px solid #a86a59;padding:10px;border-radius:6px}.planner-loading{padding:40px;text-align:center;color:#92a4b4}
@media(max-width:1350px){.planner-grid{grid-template-columns:160px minmax(360px,1fr) 250px;gap:10px}.planner-card{padding:12px}.planner-skill-nodes{gap:4px}.planner-skill-toolbar{gap:8px}.planner-search{grid-template-columns:100px 100px minmax(160px,1fr) 120px auto}}
@media(max-width:1050px){.planner-grid{grid-template-columns:minmax(0,1fr) 260px}.planner-presets{grid-column:1/-1}.planner-presets>.planner-card{display:grid;grid-template-columns:1fr 1.6fr 1fr;gap:10px;align-items:start}.planner-presets h3{grid-column:1/-1;margin:0}.planner-mode{margin:0}.planner-save{margin:0;padding:0;border:0}.planner-search{grid-template-columns:95px 100px minmax(130px,1fr) auto}.planner-search-input{grid-column:1/4;grid-row:2}.planner-update{grid-column:4;grid-row:1/3}}
@media(max-width:780px){.planner-grid{grid-template-columns:minmax(0,1fr)}.planner-presets>.planner-card{display:block}.planner-mode{margin-top:10px}.planner-search{grid-template-columns:1fr 1fr}.planner-ship-select{grid-column:1/-1}.planner-search-input{grid-column:1;grid-row:auto}.planner-update{grid-column:2;grid-row:auto}.planner-skill-toolbar{gap:7px}.planner-points strong{font-size:22px}.planner-skill-nodes{gap:4px}.planner-skill img{width:30px;height:30px}}

.planner-grid{grid-template-columns:minmax(0,1fr) 290px;gap:14px;align-items:start}.planner-presets{grid-column:1;grid-row:1}.planner-editor{grid-column:1;grid-row:2}.planner-parameters{grid-column:2;grid-row:1/span 2;position:sticky;top:0;max-height:calc(100vh - 255px);overflow-y:auto;min-height:180px}.planner-presets>.planner-card{display:grid;grid-template-columns:minmax(160px,1fr) 115px auto;gap:10px 14px;align-items:center}.planner-presets h3{grid-column:1/-1;margin:0;font-size:13px}.planner-scheme{padding:8px 28px 8px 10px;min-height:59px}.planner-scheme small{margin-bottom:3px;font-size:9px}.planner-scheme strong{font-size:12px;line-height:1.4}.planner-mode{margin:0;font-size:10px;color:#93a3b3}.planner-mode select{margin-top:5px}.planner-save{margin:0;padding:0;border:0}.planner-save summary small{margin:5px 0 0}.planner-save[open]{grid-column:1/-1;grid-row:auto;display:flex;flex-wrap:wrap;gap:8px;align-items:center;border-top:1px solid var(--planner-border);padding-top:10px}.planner-save[open] summary{width:100%}.planner-save[open]>input{width:220px;margin:0}.planner-save[open]>button{width:auto;margin:0}.planner-saved-item{margin:0}.planner-recommendation-info{grid-column:1/3;font-size:10px;color:var(--planner-muted)}.planner-recommendation-info summary{cursor:pointer}.planner-presets a{font-size:10px;justify-self:end;grid-column:3;grid-row:3}.planner-skill-row{padding:7px 0}.planner-row-cost{padding-top:32px}.planner-skill-cell{height:142px;position:relative;display:flex;flex-direction:column;border:1px solid var(--planner-border);background:var(--planner-input);border-radius:8px;overflow:hidden}.planner-skill-cell.selected{border-color:var(--planner-accent);background:var(--planner-selected)}.planner-skill{border:0;border-radius:0;background:transparent;min-height:0;height:94px;flex-shrink:0;padding:10px 4px 4px;gap:6px}.planner-skill.selected{border:0;background:transparent}.planner-skill.locked{opacity:1}.planner-skill.locked>img,.planner-skill.locked>span{opacity:.42}.planner-skill img{width:38px;height:38px}.planner-skill span{font-size:10px;line-height:1.3;min-height:27px}.planner-skill .planner-enhanced-star{left:5px;top:3px;font-size:15px;color:#fff;font-style:normal;line-height:1;text-shadow:0 1px 4px #000;opacity:1}.planner-skill-triggers{height:44px;margin:0 3px;gap:3px;align-content:center;border-top:1px solid #8b784d55;padding-top:3px}.planner-skill-triggers label{font-size:9px;line-height:1.2;gap:2px}.planner-skill-triggers input[type=number]{width:40px;height:19px;padding:1px 2px;appearance:textfield}.planner-skill-triggers input::-webkit-inner-spin-button{appearance:none}.planner-skill-legend{padding-top:9px}.planner-parameters>.planner-card{padding:14px}.planner-stat-group{margin-top:8px;padding-top:8px}.planner-stat{padding:5px 0}
@media(max-width:1350px){.planner-grid{grid-template-columns:minmax(0,1fr) 245px;gap:10px}.planner-card{padding:12px}.planner-presets>.planner-card{grid-template-columns:minmax(130px,1fr) 105px auto;gap:8px}.planner-skill-cell{height:142px}.planner-skill span{font-size:9px}.planner-skill-nodes{gap:5px}}
@media(max-width:1000px){.planner-grid{grid-template-columns:minmax(0,1fr)}.planner-presets,.planner-editor,.planner-parameters{grid-column:1;grid-row:auto}.planner-parameters{position:static;max-height:none;overflow:visible}.planner-search{grid-template-columns:95px 100px minmax(130px,1fr) auto}.planner-search-input{grid-column:1/4;grid-row:2}.planner-update{grid-column:4;grid-row:1/3}}
@media(max-width:650px){.planner-presets>.planner-card{grid-template-columns:minmax(0,1fr) 100px}.planner-presets h3{grid-column:1/-1}.planner-save{grid-column:1/-1}.planner-recommendation-info{grid-column:1}.planner-presets a{grid-column:2;grid-row:auto}.planner-skill-nodes{gap:3px}.planner-skill-cell{height:149px}.planner-skill{height:101px}.planner-skill img{width:29px;height:29px}.planner-skill span{font-size:9px}.planner-search{grid-template-columns:1fr 1fr}.planner-ship-select{grid-column:1/-1}.planner-search-input{grid-column:1;grid-row:auto}.planner-update{grid-column:2;grid-row:auto}}
.planner-skill-cell{height:calc(88px + var(--trigger-space,0px))}.planner-skill{height:88px;padding-top:8px}.planner-skill-triggers{height:var(--trigger-space,0px);flex-shrink:0}.planner-tooltip-enhanced{color:var(--ink);font-size:10px}.planner-skill-cell.selected .planner-skill-triggers{background:var(--planner-selected)}
.planner-save{grid-column:3;grid-row:2}.planner-save[open]{grid-row:auto}.planner-presets>.planner-card>h3{font-size:12px}.planner-presets>.planner-card{padding:12px}.planner-presets a{align-self:start}
@media(max-width:650px){.planner-save{grid-column:1/-1;grid-row:auto}}

.planner-controls{padding:12px 16px}.planner-controls .planner-search{padding:0;border:0;background:transparent;border-radius:0;gap:10px}.planner-controls .planner-scheme-row{display:grid;grid-template-columns:minmax(220px,1fr) 120px auto auto;gap:10px 16px;align-items:center;margin-top:11px;padding-top:11px;border-top:1px solid var(--planner-border)}.planner-controls .planner-scheme{min-height:49px;padding:6px 28px 6px 10px}.planner-controls .planner-scheme small{font-size:9px;margin-bottom:2px}.planner-controls .planner-scheme strong{font-size:12px}.planner-controls .planner-mode{font-size:10px;margin:0}.planner-controls .planner-mode select{margin-top:4px}.planner-controls .planner-scheme-notes{display:flex;gap:12px;flex-wrap:wrap;align-items:center;font-size:10px;min-width:0}.planner-controls .planner-recommendation-info{grid-column:auto}.planner-controls .planner-presets a{grid-column:auto;grid-row:auto;white-space:nowrap}.planner-controls .planner-save{grid-column:auto;grid-row:auto}.planner-controls .planner-save summary small{display:inline;margin-left:5px;font-size:9px}.planner-controls .planner-save[open]{grid-column:1/-1;grid-row:auto}.planner-editor{grid-column:1;grid-row:1}.planner-parameters{grid-column:2;grid-row:1;max-height:calc(100vh - 305px)}
@media(max-width:1200px){.planner-controls .planner-scheme-row{grid-template-columns:minmax(180px,1fr) 105px auto}.planner-controls .planner-scheme-notes{grid-column:1/3;grid-row:2}.planner-controls .planner-save{grid-column:3;grid-row:1}.planner-controls .planner-save[open]{grid-column:1/-1;grid-row:3}}
@media(max-width:1000px){.planner-editor,.planner-parameters{grid-column:1;grid-row:auto}.planner-parameters{max-height:none}}
@media(max-width:650px){.planner-controls{padding:12px}.planner-controls .planner-scheme-row{grid-template-columns:minmax(0,1fr) 100px;gap:8px}.planner-controls .planner-scheme-notes{grid-column:1/-1;grid-row:auto}.planner-controls .planner-save{grid-column:1/-1;grid-row:auto}}

.planner-controls{position:relative;padding:0;border:0;background:transparent;border-radius:0;color:var(--ink);font-size:11px}.planner-controls button{font:inherit;color:inherit;cursor:pointer}.planner-controls input:not([type=checkbox]),.planner-controls select{width:100%;min-width:0;height:27px;background:var(--planner-input);color:inherit;border:1px solid var(--planner-border);border-radius:5px;padding:4px 6px;font:inherit}.planner-controls .planner-search{grid-template-columns:64px 76px minmax(135px,1.5fr) minmax(85px,1fr) 64px;gap:6px;align-items:end}.planner-controls .planner-search label>span{font-size:9px;color:var(--planner-muted);margin-bottom:3px;display:block}.planner-controls .planner-update{padding:4px 2px;height:41px;font-size:9px;border-radius:5px}.planner-controls .planner-update small{font-size:8px}.planner-controls .planner-scheme-row{grid-template-columns:minmax(145px,1fr) 82px auto auto;gap:6px 10px;margin-top:5px;padding-top:5px;border-top:0}.planner-controls .planner-scheme{min-height:29px;height:29px;padding:4px 23px 4px 7px;display:flex;align-items:center;gap:7px;border-radius:5px}.planner-controls .planner-scheme small{margin:0;font-size:9px;color:var(--planner-muted);white-space:nowrap}.planner-controls .planner-scheme strong{font-size:10px;white-space:nowrap;text-overflow:ellipsis;overflow:hidden}.planner-controls .planner-mode{font-size:0}.planner-controls .planner-mode select{height:29px;margin:0;font-size:10px}.planner-controls .planner-scheme-notes,.planner-controls .planner-save{grid-column:auto;grid-row:auto;font-size:10px;position:relative}.planner-controls .planner-save summary small{display:none}.planner-controls .planner-save[open]{grid-column:auto;grid-row:auto;display:block;border:0;padding:0}.planner-info-body,.planner-save-body{position:absolute;top:calc(100% + 12px);right:0;width:340px;max-width:calc(100vw - 24px);padding:14px;background:var(--planner-card);border:1px solid var(--planner-border);border-radius:8px;box-shadow:0 12px 30px #0008;z-index:950;line-height:1.6}.planner-save-body{display:flex;flex-wrap:wrap;gap:8px}.planner-save-body>input{flex:1 0 100%}.planner-save-body>button{padding:7px;border:1px solid var(--planner-border);background:transparent;border-radius:5px}.planner-save-body .planner-saved-item{flex:1 0 100%}.planner-save-body .planner-share{flex:1 0 100%}.planner-parameters{max-height:calc(100vh - 160px)}.planner{gap:8px;padding-top:0}.planner-editor{gap:10px}.planner-talents summary{cursor:pointer;color:var(--planner-accent);font-size:11px}
@media(max-width:1000px){.planner-controls .planner-search{grid-template-columns:64px 76px minmax(100px,1fr) 48px}.planner-controls .planner-search-input{grid-column:1/4;grid-row:2}.planner-controls .planner-update{grid-column:4;grid-row:1/3}.planner-controls .planner-scheme-row{grid-template-columns:minmax(110px,1fr) 75px auto auto}.planner-controls .planner-scheme-notes,.planner-controls .planner-save{grid-column:auto;grid-row:auto}.planner-parameters{max-height:none}}
.planner-upgrade-actions{display:flex;gap:6px}.planner-upgrade-actions button{font:inherit;font-size:10px;border:1px solid var(--planner-border);border-radius:5px;background:transparent;color:inherit;padding:4px 7px;cursor:pointer}

/* Shared typography and aligned desktop columns. */
.planner,.planner-controls,.planner-popup,.planner-tooltip{
  font-family:"Segoe UI","Microsoft YaHei UI",sans-serif;
  font-size:11px;line-height:1.5;font-variant-numeric:tabular-nums;
}
.planner-card{padding:12px}
.planner h3,.planner-card-heading h3{font-size:14px;font-weight:600;line-height:20px;margin:0}
.planner-skills>h3{margin-bottom:8px}
.planner h3 small{font-size:11px;line-height:16px;font-weight:400}
.planner-card-heading{min-height:24px;margin-bottom:8px}
.planner-controls .planner-search label>span,.planner-controls .planner-scheme small,
.planner-slot-label,.planner-source,.planner-skill-legend,.planner-skill-legend small,
.planner-points small,.planner-live-dot,.planner-stats-labels{font-size:10px;line-height:15px}
.planner-controls .planner-scheme strong,.planner-controls .planner-mode select,
.planner-controls .planner-scheme-notes,.planner-controls .planner-save summary,
.planner-controls .planner-update,.planner-upgrade-actions button,.planner-redistribute,
.planner-skill-toolbar>label,.planner-points span,.planner-stat>span,
.planner-stat>div small,.planner-stat b{font-size:11px;line-height:16px}
.planner-controls .planner-update{white-space:nowrap}
.planner-controls .planner-update small{font-size:10px}
.planner-controls .planner-scheme,.planner-controls .planner-mode select{height:30px}
.planner-upgrade-slots button{height:90px;padding:6px 4px;gap:4px}
.planner-upgrade-slots img{width:30px;height:30px;flex-shrink:0}
.planner-upgrade-slots b{height:30px;line-height:30px}
.planner-upgrade-slots small{font-size:11px;line-height:15px;min-height:30px;display:flex;align-items:center;justify-content:center}
.planner-skill-toolbar{margin-bottom:8px;gap:10px}
.planner-skill-toolbar>label{display:flex;align-items:center;gap:8px;white-space:nowrap}
.planner-skill-toolbar>label select{flex:1;min-width:0;margin-top:0}
.planner-skill-toolbar select{height:30px}
.planner-points strong{font-size:26px;line-height:32px}
.planner-skill-row{padding:5px 0;gap:8px}
.planner-skill-nodes{gap:7px}
.planner-row-cost{display:flex;flex-direction:column;justify-content:center;padding:0;font-size:16px;line-height:20px}
.planner-row-cost small{font-size:10px;line-height:15px}
.planner-skill{height:72px;min-height:72px;padding:5px 4px 2px;gap:3px}
.planner-skill img{width:32px;height:32px;flex-shrink:0}
.planner-skill span{font-size:11px;line-height:15px;min-height:30px;display:flex;align-items:center;justify-content:center}
.planner-skill b,.planner-skill i{font-size:10px;line-height:15px}
.planner-skill .planner-enhanced-star{display:block;min-height:0;line-height:1}
.planner-skill-cell{height:calc(72px + var(--trigger-space,0px))}
.planner-skill-triggers{padding:2px 0;height:var(--trigger-space,0px);gap:2px}
.planner-skill-triggers label{font-size:10px;line-height:16px;min-height:17px;flex-wrap:nowrap}
.planner-skill-triggers label:has(input[type=number]){display:grid;grid-template-columns:minmax(0,1fr) 36px auto;gap:2px}
.planner-skill-triggers input[type=number]{width:36px;height:18px;font-size:10px;line-height:16px}
.planner-skill-legend{padding-top:6px;gap:10px}
.planner-editor-footer{font-size:10px;line-height:16px;min-height:16px}
.planner-parameters{position:static;min-height:0;max-height:none;overflow:hidden}
.planner-parameters>.planner-card{padding:12px}
.planner-stat-group summary,.planner-other summary{font-size:12px;line-height:18px}
.planner-stat{padding:6px 0}
.planner-stat>span{display:block}
.planner-stat>span small{font-size:10px;line-height:15px}
.planner-stat>div{margin-top:3px;gap:6px}
.planner-stat strong{font-family:inherit;font-size:13px;line-height:20px;font-weight:600}
.planner-footnote{font-size:11px;line-height:18px}
@media(min-width:1001px){
  .planner{display:flex;flex-direction:column;gap:6px;padding:0;overflow:hidden}
  .planner-grid{flex:1;min-height:0;grid-template-rows:minmax(0,1fr);align-items:stretch;gap:12px}
  .planner-editor{min-height:0;grid-template-rows:auto minmax(0,1fr);gap:10px}
  .planner-skills{display:flex;flex-direction:column;min-height:0;overflow-y:auto}
  .planner-skills>h3,.planner-skill-toolbar,.planner-profile,.planner-skill-legend,.planner-talents{flex-shrink:0}
  .planner-skill-row{flex:1 0 0px;min-height:calc(82px + var(--trigger-space,0px))}
  .planner-skill-cell{height:100%;min-height:calc(72px + var(--trigger-space,0px))}
  .planner-skill{flex:1;justify-content:center}
  .planner-parameters>.planner-card{height:100%;min-height:0;overflow-y:auto;scrollbar-gutter:stable}
}
@media(min-width:1001px) and (max-height:950px){
  .planner-card,.planner-parameters>.planner-card{padding:10px}
  .planner-upgrade-slots button{height:78px;padding:4px;gap:2px}
  .planner-upgrade-slots img{width:26px;height:26px}
  .planner-upgrade-slots b{height:26px;line-height:26px}
  .planner-skill-row{min-height:calc(68px + var(--trigger-space,0px));padding:4px 0}
  .planner-skill-cell{min-height:calc(60px + var(--trigger-space,0px))}
  .planner-skill{height:60px;min-height:60px;padding:3px 3px 1px;gap:2px}
  .planner-skill img{width:26px;height:26px}
  .planner-skill span,.planner-upgrade-slots small{font-size:10px;line-height:14px;min-height:28px}
  .planner-skill-toolbar{margin-bottom:6px}
}
@media(min-width:1001px) and (max-height:760px){
  .planner-card,.planner-parameters>.planner-card{padding:8px}
  .planner h3,.planner-card-heading h3{font-size:13px;line-height:18px}
  .planner-card-heading{min-height:20px;margin-bottom:5px}
  .planner-skills>h3{margin-bottom:4px}
  .planner-editor{gap:6px}
  .planner-upgrade-actions button{padding:2px 6px;line-height:16px}
  .planner-redistribute{padding:4px 8px;line-height:16px}
  .planner-upgrade-slots button{height:66px;padding:3px;gap:1px}
  .planner-upgrade-slots img{width:21px;height:21px}
  .planner-upgrade-slots b{height:21px;line-height:21px}
  .planner-skill-row{min-height:calc(54px + var(--trigger-space,0px));padding:2px 0}
  .planner-skill-cell{min-height:calc(50px + var(--trigger-space,0px))}
  .planner-skill{height:50px;min-height:50px;padding:2px 2px 0;gap:1px}
  .planner-skill img{width:21px;height:21px}
  .planner-skill span{line-height:13px;min-height:26px}
  .planner-skill-toolbar{margin-bottom:4px}
  .planner-skill-legend{padding-top:3px}
}
@media(max-width:1000px){
  .planner-parameters{overflow:visible}
  .planner-skill-triggers label:has(input[type=number]){grid-template-columns:minmax(0,1fr) 32px auto;gap:1px}
  .planner-skill-triggers input[type=number]{width:32px}
}


/* Compact local-data toolbar and captain talent popover. */
.planner-controls .planner-search{grid-template-columns:90px 100px minmax(180px,2fr) minmax(100px,1fr);align-items:center}
.planner-controls .planner-search label{display:flex;align-items:center;gap:5px;min-width:0}
.planner-controls .planner-search label>span{margin:0;white-space:nowrap}
.planner-controls .planner-search .planner-ship-select>span,.planner-controls .planner-search .planner-search-input>span{display:none}
.planner-controls .planner-search select,.planner-controls .planner-search input{height:30px}
.planner-controls .planner-update{height:30px;padding:4px 2px}
.planner-controls .planner-update small{display:none}
.planner-controls .planner-scheme-row{display:flex;gap:10px;align-items:center;margin-top:6px;padding:0}
.planner-controls .planner-scheme{flex:1;max-width:380px;min-width:120px}
.planner-controls .planner-mode{flex:0 0 82px}
.planner-controls .planner-save summary{white-space:nowrap}
.planner-skill-toolbar>label{max-width:420px}
.planner-points{margin-left:auto}
.planner-talents{position:relative;border:0;margin:0;padding:0;flex-shrink:0}
.planner-talents summary{padding:6px 9px;border:1px solid var(--planner-border);border-radius:6px;font-size:11px;white-space:nowrap}
.planner-talents-body{position:absolute;top:calc(100% + 6px);left:0;width:310px;max-width:calc(100vw - 32px);max-height:300px;overflow:auto;padding:12px;background:var(--planner-card);border:1px solid var(--planner-border);border-radius:8px;box-shadow:0 8px 24px #0004;z-index:30}
.planner-talents-body>label{display:flex;align-items:center;gap:10px;padding:6px 0}
.planner-talents-body>label>span{flex:1;margin:0;font-size:11px}
.planner-talents-body select{max-width:110px;height:29px;padding:4px}
.planner-skills:has(.planner-talents[open]){overflow:visible}
.planner-stat b.good{color:var(--green)}
:global(:root[data-theme="light"] .planner-skill.locked>span){opacity:1}
:global(:root[data-theme="light"] .planner-skill img),
:global(:root[data-theme="light"] .planner-upgrade-slots img){filter:brightness(.65)}
:global(:root[data-theme="light"] .planner-skill.locked>img){opacity:.75;filter:brightness(.45)}
:global(:root[data-theme="light"] .planner-skill.selected img){filter:sepia(1) saturate(2) brightness(.4)}
@media(max-width:1000px){
  .planner-controls .planner-search{grid-template-columns:90px 100px minmax(160px,1fr)}
  .planner-controls .planner-search-input{grid-column:1/-1;grid-row:2}
  .planner-controls .planner-update{grid-column:4;grid-row:1/3}
  .planner-skill-toolbar{flex-wrap:wrap}
  .planner-skill-toolbar>label{max-width:none;flex-basis:55%}
  .planner-talents-body{left:auto;right:0}
}

</style>
