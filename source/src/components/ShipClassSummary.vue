<script setup lang="ts">
import type { PlayerDetails } from "../types";
import { prGrade } from "../pr-grade";
const props = defineProps<{ player: PlayerDetails; owned?: boolean }>();
function winrateClass(value: number | null) {
  if (value === null) return "";
  if (value >= 60) return "metric--excellent";
  if (value >= 55) return "metric--good";
  if (value < 48) return "metric--weak";
  return "";
}
function number(value: number | null | undefined, digits = 0) { return value == null ? "—" : digits ? value.toFixed(digits) : Math.round(value).toLocaleString("zh-CN"); }
</script>

<template>
  <section class="panel ship-classes" aria-label="我的舰种">
    <header><h2>{{ owned ? '我的舰种' : '舰种战绩' }}</h2><div class="ship-classes__tools"><span>随机战 · 按场次加权汇总</span><slot name="tools" /></div></header>
    <div v-if="player.hiddenProfile" class="ship-classes__empty">该玩家隐藏了战绩，无法读取舰种数据。</div>
    <div v-else class="ship-classes__table">
      <div class="ship-classes__row ship-classes__head"><span>舰种</span><span>场次</span><span>胜率</span><span>场均伤害</span><span>场均经验</span><span>场均击沉</span><span>个人评分 PR</span></div>
      <div v-for="row in player.shipClasses || []" :key="row.type" class="ship-classes__row" :data-type="row.type">
        <span class="ship-classes__name"><b>{{ row.code }}</b><strong>{{ row.label }}</strong></span>
        <span>{{ number(row.battles) }}</span><span :class="winrateClass(row.winRate)">{{ number(row.winRate,2) }}{{ row.winRate === null ? '' : '%' }}</span>
        <span>{{ number(row.avgDamage) }}</span><span>{{ number(row.avgXp) }}</span><span>{{ number(row.avgFrags,2) }}</span>
        <span class="ship-classes__pr" :title="prGrade(row.pr).label" :style="{color:prGrade(row.pr).color}"><strong>{{ number(row.pr) }}</strong></span>
      </div>
      <p v-if="!player.shipClasses?.length" class="ship-classes__empty">舰种数据暂不可用，请刷新战绩。</p>
    </div>
    <footer>CL 汇总 WG 的巡洋舰分类。PR 按该舰种内各舰船的实际数据与期望值计算，缺失期望值的场次不计入评分。</footer>
  </section>
</template>

<style scoped>
.ship-classes { flex:none; overflow:hidden; padding:10px 14px 8px; }
.ship-classes header { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:6px; }
.ship-classes h2 { margin:0; font-size:17px; }.ship-classes__tools > span { color:var(--muted-strong); font-size:12px; }
.ship-classes__table { overflow-x:auto; }.ship-classes__row { display:grid; grid-template-columns:minmax(110px,1.2fr) repeat(2,minmax(70px,.7fr)) minmax(90px,.9fr) repeat(2,minmax(75px,.8fr)) minmax(95px,.9fr); align-items:center; gap:8px; padding:4px 8px; min-width:650px; min-height:30px; border-bottom:1px solid var(--line); font-size:14px; font-variant-numeric:tabular-nums; }
.ship-classes__row > span:not(:first-child) { text-align:right; white-space:nowrap; }.ship-classes__head { min-height:24px; padding-block:4px; font-size:12px; color:var(--muted-strong); background:color-mix(in srgb,var(--cyan) 4%,transparent); }
.ship-classes__name { display:flex; gap:10px; align-items:center; white-space:nowrap; }.ship-classes__name b { color:var(--cyan); font-size:14px; min-width:23px; }.ship-classes__name strong { font-size:14px; }
.ship-classes__pr strong { font-size:17px; }
.ship-classes footer { margin-top:5px; color:var(--muted-strong); font-size:11px; line-height:1.5; }.ship-classes__empty { color:var(--muted-strong); padding:16px; font-size:14px; }
.ship-classes__tools { display:flex; align-items:center; justify-content:flex-end; gap:8px; min-width:0; }
.ship-classes__tools :deep(.button-secondary) { padding:5px 9px; min-height:30px; font-size:12px; }
@media (max-width:1100px) { .ship-classes__tools > span { display:none; } }
</style>

