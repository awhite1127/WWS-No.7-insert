<script setup lang="ts">
import { computed, ref } from "vue";
import type { ArenaInfo, RosterPlayer } from "../types";

const props = defineProps<{
  arena: ArenaInfo | null;
  roster: RosterPlayer[];
  embedded?: boolean;
  logs?: Array<{ time: string; message: string; tone?: string }>;
  refreshing?: boolean;
}>();
const emit = defineEmits<{ refresh: [] }>();
const chartMode = ref<"overall" | "ship">("overall");
const classes = [
  ["AirCarrier", "航空母舰"], ["Battleship", "战列舰"], ["Cruiser", "巡洋舰"],
  ["Destroyer", "驱逐舰"], ["Submarine", "潜艇"], ["Unknown", "舰种待确认"],
] as const;
function typeOf(player: RosterPlayer) {
  const type = player.shipType || player.currentShip?.type || "Unknown";
  return classes.some(([key]) => key === type) ? type : "Unknown";
}
function sorted(side: "ally" | "enemy", type: string) {
  return props.roster.filter((player) => player.side === side && typeOf(player) === type)
    .sort((a, b) => (b.shipTier || b.currentShip?.tier || 0) - (a.shipTier || a.currentShip?.tier || 0)
      || (a.shipName || a.currentShip?.name || "").localeCompare(b.shipName || b.currentShip?.name || "")
      || a.name.localeCompare(b.name));
}
const groups = computed(() => classes.map(([key, label]) => {
  const ally = sorted("ally", key);
  const enemy = sorted("enemy", key);
  return { key, label, ally, enemy, rows: Array.from({ length: Math.max(ally.length, enemy.length) }, (_, index) => ({
    ally: ally[index] || null, enemy: enemy[index] || null,
  })) };
}).filter((group) => group.rows.length));
const ordered = computed(() => ({
  ally: groups.value.flatMap((group) => group.ally),
  enemy: groups.value.flatMap((group) => group.enemy),
}));
const slots = computed(() => groups.value.flatMap((group) => group.rows));
function metric(player: RosterPlayer, mode: "overall" | "ship") {
  return mode === "overall" ? player.overall : player.currentShip;
}
function percent(value?: number) {
  return Number.isFinite(value) ? Number(value).toFixed(1) + "%" : "—";
}
function number(value?: number) {
  return Number.isFinite(value) ? Math.round(Number(value)).toLocaleString() : "—";
}
function average(side: "ally" | "enemy", mode: "overall" | "ship") {
  const values = ordered.value[side].map((player) => metric(player, mode)?.winRate).filter((value): value is number => Number.isFinite(value));
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : undefined;
}
const chartValues = computed(() => (["ally", "enemy"] as const).flatMap((side) =>
  ordered.value[side].map((player) => metric(player, chartMode.value)?.winRate)
    .filter((value): value is number => Number.isFinite(value))));
const chartMin = computed(() => chartValues.value.length ? Math.max(0, Math.floor((Math.min(...chartValues.value) - 5) / 5) * 5) : 30);
const chartMax = computed(() => chartValues.value.length ? Math.min(100, Math.ceil((Math.max(...chartValues.value) + 5) / 5) * 5) : 70);
const chartTicks = computed(() => Array.from({ length: 5 }, (_, index) => chartMax.value - index * (chartMax.value - chartMin.value) / 4));
function points(side: "ally" | "enemy") {
  const denominator = Math.max(11, slots.value.length - 1);
  return slots.value.map((slot, index) => {
    const player = slot[side];
    if (!player) return null;
    const value = metric(player, chartMode.value)?.winRate;
    if (!Number.isFinite(value)) return null;
    return { x: 42 + index * 316 / denominator, y: 20 + (chartMax.value - Number(value)) * 180 / Math.max(1, chartMax.value - chartMin.value), value: Number(value), player };
  });
}
function segments(side: "ally" | "enemy") {
  const result: string[] = [];
  let current: string[] = [];
  for (const point of points(side)) {
    if (point) current.push((current.length ? "L" : "M") + point.x.toFixed(1) + " " + point.y.toFixed(1));
    else if (current.length) { result.push(current.join(" ")); current = []; }
  }
  if (current.length) result.push(current.join(" "));
  return result;
}
</script>

<template>
  <div class="battle-roster" :class="{ 'battle-roster--embedded': embedded }">
    <div v-if="arena" class="battle-board">
      <div class="battle-board__roster">
        <div class="battle-board__teams">
          <div class="battle-team-heading battle-team-heading--ally"><span>我方</span><strong>{{ ordered.ally.length }} / 12</strong><small>账号均胜 {{ percent(average('ally', 'overall')) }}</small></div>
          <div class="battle-team-heading battle-team-heading--enemy"><span>敌方</span><strong>{{ ordered.enemy.length }} / 12</strong><small>账号均胜 {{ percent(average('enemy', 'overall')) }}</small></div>
        </div>
        <div class="battle-board__columns">
          <div><span>玩家 / 舰船</span><span>账号数据</span><span>单舰数据</span></div>
          <div><span>玩家 / 舰船</span><span>账号数据</span><span>单舰数据</span></div>
        </div>
        <div v-for="group in groups" :key="group.key" class="battle-class">
          <div class="battle-class__heading"><span>{{ group.label }}</span><small>我方 {{ group.ally.length }} · 敌方 {{ group.enemy.length }}</small></div>
          <div v-for="(pair, index) in group.rows" :key="group.key + index" class="battle-pair">
            <div v-for="side in (['ally', 'enemy'] as const)" :key="side" class="battle-entry" :class="['battle-entry--' + side, { 'battle-entry--empty': !pair[side] }]">
              <template v-if="pair[side]">
                <div class="battle-entry__identity" :title="pair[side]!.name + ' · ' + (pair[side]!.currentShip?.name || pair[side]!.shipName)">
                  <strong><b v-if="pair[side]!.clan">[{{ pair[side]!.clan!.tag }}]</b>{{ pair[side]!.name }}</strong>
                  <small>{{ pair[side]!.currentShip?.name || pair[side]!.shipName || '未知舰船' }}</small>
                </div>
                <div class="battle-entry__stats"><strong>{{ percent(pair[side]!.overall?.winRate) }}</strong><small>{{ number(pair[side]!.overall?.battles) }} 场 · {{ number(pair[side]!.overall?.avgXp) }} 经验</small></div>
                <div class="battle-entry__stats"><strong>{{ percent(pair[side]!.currentShip?.winRate) }}</strong><small>{{ number(pair[side]!.currentShip?.battles) }} 场 · {{ number(pair[side]!.currentShip?.avgXp) }} 经验</small></div>
                <span v-if="pair[side]!.status === 'loading'" class="battle-entry__status">读取中</span>
              </template>
              <span v-else class="battle-entry__placeholder">—</span>
            </div>
          </div>
        </div>
        <div v-if="!groups.length" class="battle-roster__empty">正在读取双方阵容…</div>
      </div>
      <aside class="battle-board__side">
        <section class="battle-chart">
          <header><div><strong>双方胜率走势</strong><small>按左侧舰种排序，逐位对照</small></div><select v-model="chartMode" aria-label="图表数据类型"><option value="overall">账号胜率</option><option value="ship">单舰胜率</option></select></header>
          <div class="battle-chart__summary"><span class="battle-chart__ally">我方 {{ percent(average('ally', chartMode)) }}</span><span class="battle-chart__enemy">敌方 {{ percent(average('enemy', chartMode)) }}</span></div>
          <svg class="battle-chart__svg" viewBox="0 0 380 240" role="img" :aria-label="(chartMode === 'overall' ? '账号' : '单舰') + '胜率对比折线图'">
            <g v-for="(tick, index) in chartTicks" :key="index"><line x1="42" :y1="20 + index * 45" x2="358" :y2="20 + index * 45" class="battle-chart__grid" /><text x="35" :y="24 + index * 45" text-anchor="end">{{ tick.toFixed(0) }}%</text></g>
            <path v-for="(path, index) in segments('ally')" :key="'a' + index" :d="path" class="battle-chart__line battle-chart__line--ally" />
            <path v-for="(path, index) in segments('enemy')" :key="'e' + index" :d="path" class="battle-chart__line battle-chart__line--enemy" />
            <circle v-for="(point, index) in points('ally')" v-show="point" :key="'ac' + index" :cx="point?.x" :cy="point?.y" r="3.5" class="battle-chart__dot battle-chart__dot--ally"><title>{{ point?.player.name }} {{ percent(point?.value) }}</title></circle>
            <circle v-for="(point, index) in points('enemy')" v-show="point" :key="'ec' + index" :cx="point?.x" :cy="point?.y" r="3.5" class="battle-chart__dot battle-chart__dot--enemy"><title>{{ point?.player.name }} {{ percent(point?.value) }}</title></circle>
            <text x="42" y="225">1</text><text x="358" y="225" text-anchor="end">{{ Math.max(12, slots.length) }}</text>
          </svg>
          <p v-if="!chartValues.length" class="battle-chart__empty">公开战绩读取后显示走势</p>
          <small class="battle-chart__note">仅统计可读取的公开数据；缺失数据不会计为 0%。</small>
        </section>
        <section class="battle-activity">
          <header><strong>读取信息</strong><button v-if="embedded" type="button" :disabled="refreshing" @click="emit('refresh')">{{ refreshing ? '刷新中…' : '刷新数据' }}</button></header>
          <div class="battle-activity__list" role="log" aria-live="polite">
            <div v-for="(entry, index) in logs || []" :key="index"><time>{{ entry.time }}</time><span :class="entry.tone">{{ entry.message }}</span></div>
            <div v-if="!logs?.length"><time>—</time><span>等待对局数据</span></div>
          </div>
        </section>
      </aside>
    </div>
    <div v-else class="battle-roster__empty">进入对局后，双方阵容与公开战绩会自动显示在这里。</div>
  </div>
</template>
