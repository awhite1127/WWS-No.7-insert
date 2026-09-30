<script setup lang="ts">
import { computed, ref } from "vue";
import type { PlayerDetails } from "../types";
import { trendPoints, type TrendMetric, type TrendMode } from "../stats-trend";
const props = defineProps<{ player: PlayerDetails }>();
const mode = ref<TrendMode>("cumulative");
const selected = ref<TrendMetric[]>(["winRate", "pr", "avgDamage", "avgXp"]);
const hover = ref<number | null>(null);
const metrics: { key: TrendMetric; label: string; color: string }[] = [
  { key: "winRate", label: "胜率", color: "#61d498" }, { key: "pr", label: "个人评分 PR", color: "#e8bd54" },
  { key: "avgDamage", label: "场均伤害", color: "#ff7d84" }, { key: "avgXp", label: "场均经验", color: "#69b5ff" }, { key: "avgFrags", label: "场均击沉", color: "#c39cff" },
];
const points = computed(() => props.player.hiddenProfile ? [] : trendPoints(props.player.history ?? [], mode.value));
const active = computed(() => points.value[hover.value ?? points.value.length - 1]);
const charts = computed(() => selected.value.map(key => {
  const valid = points.value.flatMap(p => p.values?.[key] == null ? [] : [p.values[key]!]);
  const low = valid.length ? Math.min(...valid) : 0, high = valid.length ? Math.max(...valid) : 1;
  const pad = Math.max((high-low)*.15, key==="winRate" || key==="avgFrags" ? .05 : 1);
  const min = Math.max(0, low-pad), max = high+pad;
  const start = points.value[0]?.capturedAt ?? 0, end = points.value.at(-1)?.capturedAt ?? start;
  const x = (index: number) => end === start ? 320 : 64 + (points.value[index]!.capturedAt-start)/(end-start)*512;
  const y = (v: number) => 154-(v-min)/(max-min)*122;
  let connected = false;
  const path = points.value.map((p,i) => { const v=p.values?.[key]; if(v==null){connected=false;return "";} const segment=(connected?"L":"M")+x(i)+","+y(v);connected=true;return segment; }).join(" ");
  return { ...metrics.find(m=>m.key===key)!, min, max, path, x, y, count: valid.length };
}));
function format(key: TrendMetric, value?: number | null) {
  if (value == null || !Number.isFinite(value)) return "—";
  return key === "winRate" ? value.toFixed(2)+"%" : key === "avgFrags" ? value.toFixed(2) : Math.round(value).toLocaleString("zh-CN");
}
function date(value: number, full = false) { return new Intl.DateTimeFormat("zh-CN", full ? { month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hour12:false } : {month:"2-digit",day:"2-digit"}).format(value); }
function move(event: PointerEvent) {
  if(!points.value.length)return;
  const rect=(event.currentTarget as SVGSVGElement).getBoundingClientRect();
  const fraction=Math.max(0,Math.min(1,((event.clientX-rect.left)/rect.width*600-64)/512));
  const first=points.value[0]!.capturedAt,last=points.value.at(-1)!.capturedAt;
  const time=first+fraction*(last-first);
  hover.value=points.value.reduce((best,p,i)=>Math.abs(p.capturedAt-time)<Math.abs(points.value[best]!.capturedAt-time)?i:best,0);
}
function openPrSource() { void window.wws.openRatingSource(); }
const ticks = computed(() => [...new Set([0,Math.floor((points.value.length-1)/2),points.value.length-1])].filter(i=>i>=0&&points.value[i]));
</script>

<template>
  <section class="panel stats-trend" aria-label="个人战绩趋势">
    <header class="stats-trend__header">
      <div><h2>战绩趋势</h2><p>随机战 · 每日最后一次本地查询记录<span v-if="points.length"> · 始于 {{ new Date(points[0]!.capturedAt).toLocaleDateString('zh-CN') }}</span></p></div>
      <div class="stats-trend__controls">
        <div class="stats-trend__tabs" aria-label="趋势统计方式"><button type="button" :class="{active:mode==='cumulative'}" :aria-pressed="mode==='cumulative'" @click="mode='cumulative';hover=null">累计趋势</button><button type="button" :class="{active:mode==='interval'}" :aria-pressed="mode==='interval'" @click="mode='interval';hover=null">区间表现</button></div>
      </div>
    </header>
    <div class="stats-trend__grid">
      <article v-for="(chart,index) in charts" :key="index" class="stats-trend__chart" :class="'stats-trend__chart--'+chart.key" :style="{'--trend-color':chart.color}">
        <div class="stats-trend__chart-head"><select v-model="selected[index]" :aria-label="'趋势图 '+(index+1)+' 指标'"><option v-for="metric in metrics" :key="metric.key" :value="metric.key">{{ metric.label }}</option></select><strong>{{ format(chart.key, active?.values?.[chart.key]) }}</strong></div>
        <svg v-if="chart.count" viewBox="0 0 600 184" role="img" :aria-label="chart.label+'，'+chart.count+' 个实际记录点'" @pointermove="move" @pointerleave="hover=null">
          <g v-for="ratio in [0,.5,1]" :key="ratio"><line x1="64" x2="576" :y1="32+ratio*122" :y2="32+ratio*122" class="stats-trend__gridline"/><text x="55" :y="36+ratio*122" text-anchor="end">{{ format(chart.key,chart.max-ratio*(chart.max-chart.min)) }}</text></g>
          <path :d="chart.path" fill="none" stroke="var(--trend-color)" stroke-width="2.5"/>
          <template v-for="(point,i) in points" :key="point.capturedAt"><circle v-if="point.values?.[chart.key]!=null" :cx="chart.x(i)" :cy="chart.y(point.values[chart.key]!)" :r="hover===i?5:3" fill="var(--panel-solid)" stroke="var(--trend-color)" stroke-width="2" tabindex="0" :aria-label="date(point.capturedAt,true)+' '+chart.label+' '+format(chart.key,point.values[chart.key])" @focus="hover=i" @blur="hover=null"/></template>
          <text v-for="i in ticks" :key="i" :x="chart.x(i)" y="177" text-anchor="middle">{{ date(points[i]!.capturedAt) }}</text>
        </svg>
        <div v-else class="stats-trend__empty"><strong>{{ player.hiddenProfile ? '战绩已隐藏' : chart.key==='pr' ? 'PR 记录积累中' : mode==='interval' ? '尚无可比较的战绩记录' : '尚无历史记录' }}</strong><span>{{ chart.key==='pr' ? '需要舰船期望值及两次记录才能比较区间 PR。' : '查询或刷新后自动记录，已有记录不会补造。' }}</span></div>
        <div class="stats-trend__sample"><template v-if="active && active.values?.[chart.key]!=null"><span>{{ active.from ? date(active.from)+' → ' : '' }}{{ date(active.capturedAt,true) }}</span><span>{{ active.battles.toLocaleString() }} 场<template v-if="chart.key==='pr' && active.prCoverage!==null"> · PR 覆盖 {{ (active.prCoverage*100).toFixed(1) }}%</template></span></template><span v-else>—</span></div>
      </article>
    </div>
    <footer class="stats-trend__footer"><span>{{ mode==='cumulative' ? '累计趋势展示查询时的账号总指标；首次记录前的历史留空。' : '区间表现为相邻记录之间的新增战绩；跨多天时显示整个区间，无新增场次时留空。' }}<template v-if="points.at(-1)?.prVersion"> PR 期望值版本 {{ new Date(Number(points.at(-1)!.prVersion)*1000).toLocaleDateString('zh-CN') }}。</template><template v-if="player.recent?.storageError"> 本地记录保存失败，本次数据可能无法保留。</template></span><a href="https://wows-numbers.com/personal/rating/" target="_blank" rel="noopener noreferrer" @click.prevent="openPrSource">PR：WoWS Numbers ↗</a></footer>
  </section>
</template>

<style scoped>
.stats-trend { height: 504px; display:flex; flex-direction:column; padding:16px 18px; gap:12px; flex-shrink:0; overflow:hidden; }
.stats-trend__header { display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap; flex-shrink:0; }
.stats-trend h2 { margin:0; font-size:18px; }.stats-trend__header p { margin:4px 0 0; font-size:11px; color:var(--muted-strong); }
.stats-trend__controls { display:flex; gap:10px; flex-wrap:wrap; }.stats-trend__tabs { display:flex; gap:3px; border:1px solid var(--line); padding:3px; border-radius:7px; }
.stats-trend__tabs button { padding:6px 10px; border:0; border-radius:4px; background:transparent; color:var(--muted-strong); cursor:pointer; font-size:11px; white-space:nowrap; }.stats-trend__tabs button.active { color:var(--cyan); background:color-mix(in srgb,var(--cyan) 12%,transparent); }
.stats-trend__grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); grid-template-rows:repeat(2,minmax(0,1fr)); gap:10px 18px; min-height:0; flex:1; overflow:auto; scrollbar-gutter:stable; }
.stats-trend__chart { min-width:0; min-height:0; display:flex; flex-direction:column; }.stats-trend__chart-head { display:flex; justify-content:space-between; align-items:center; gap:8px; }.stats-trend__chart-head select { min-width:0; width:145px; max-width:65%; padding:4px 8px; height:28px; font-size:12px; color:var(--ink); background:var(--panel-solid); border:1px solid var(--line-strong); border-radius:5px; }.stats-trend__chart-head strong { color:var(--trend-color); font-size:16px; white-space:nowrap; font-variant-numeric:tabular-nums; }
.stats-trend svg { width:100%; min-height:0; flex:1; overflow:visible; }.stats-trend svg text { fill:var(--muted-strong); font-size:12px; font-variant-numeric:tabular-nums; }.stats-trend__gridline { stroke:var(--line-strong); stroke-width:1; }.stats-trend circle:focus { outline:none; stroke:var(--ink); stroke-width:3; }
.stats-trend__empty { flex:1; min-height:0; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:7px; text-align:center; color:var(--muted-strong); font-size:11px; padding:8px; }.stats-trend__empty strong { font-size:13px; }
.stats-trend__sample { display:flex; justify-content:space-between; gap:6px; min-height:18px; font-size:10px; color:var(--muted-strong); font-variant-numeric:tabular-nums; white-space:nowrap; }
.stats-trend__footer { display:flex; justify-content:space-between; gap:12px; font-size:10px; line-height:1.5; color:var(--muted-strong); flex-shrink:0; }.stats-trend__footer a { color:var(--cyan); white-space:nowrap; }
@media(max-width:1100px) { .stats-trend { height:540px; }.stats-trend__sample { flex-wrap:wrap; gap:0; min-height:30px; } }
@media(max-width:760px) { .stats-trend { height:540px; padding:14px; }.stats-trend__grid { grid-template-columns:minmax(0,1fr); grid-template-rows:none; grid-auto-rows:190px; }.stats-trend__footer { flex-wrap:wrap; } }
:global(:root[data-theme="light"]) .stats-trend__chart--winRate { --trend-color:#168b62 !important; }
:global(:root[data-theme="light"]) .stats-trend__chart--pr { --trend-color:#997009 !important; }
:global(:root[data-theme="light"]) .stats-trend__chart--avgDamage { --trend-color:#c34353 !important; }
:global(:root[data-theme="light"]) .stats-trend__chart--avgXp { --trend-color:#246fae !important; }
:global(:root[data-theme="light"]) .stats-trend__chart--avgFrags { --trend-color:#765bd0 !important; }
</style>
