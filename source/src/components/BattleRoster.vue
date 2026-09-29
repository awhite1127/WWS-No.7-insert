<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import AppIcon from "./AppIcon.vue";
import { playerMark, togglePlayerMark, type PlayerMarkKind } from "../player-marks";
import type { ArenaInfo, RosterPlayer } from "../types";

const props = defineProps<{
  arena: ArenaInfo | null;
  roster: RosterPlayer[];
  embedded?: boolean;
  logs?: Array<{ time: string; message: string; tone?: string }>;
  refreshing?: boolean;
  realm?: string;
}>();
const emit = defineEmits<{ refresh: [] }>();
const chartMode = ref<"overall" | "ship">("overall");
const contextMenu = ref<{ player: RosterPlayer; x: number; y: number } | null>(null);
const hoveredPoint = ref<{ name: string; ship: string; side: "ally" | "enemy"; rate: number; x: number; y: number } | null>(null);
watch(chartMode, () => { hoveredPoint.value = null; });
function showContextMenu(event: MouseEvent, player: RosterPlayer) {
  event.preventDefault();
  contextMenu.value = {
    player,
    x: Math.max(8, Math.min(event.clientX, window.innerWidth - 185)),
    y: Math.max(8, Math.min(event.clientY, window.innerHeight - 100)),
  };
}
function toggleMark(kind: PlayerMarkKind) {
  if (!contextMenu.value) return;
  togglePlayerMark(props.realm || "asia", contextMenu.value.player.accountId, contextMenu.value.player.name, kind);
  contextMenu.value = null;
}
function closeContextMenu(event: KeyboardEvent | MouseEvent) {
  if (event.type === "keydown" && (event as KeyboardEvent).key !== "Escape") return;
  contextMenu.value = null;
}
onMounted(() => {
  window.addEventListener("click", closeContextMenu);
  window.addEventListener("keydown", closeContextMenu);
});
onUnmounted(() => {
  window.removeEventListener("click", closeContextMenu);
  window.removeEventListener("keydown", closeContextMenu);
});
const shipTypes = ["AirCarrier", "Battleship", "Cruiser", "Destroyer", "Submarine", "Unknown"] as const;
function typeOf(player: RosterPlayer): typeof shipTypes[number] {
  const type = player.shipType || player.currentShip?.type || "Unknown";
  return shipTypes.find((shipType) => shipType === type) || "Unknown";
}
function sorted(side: "ally" | "enemy") {
  return props.roster.filter((player) => player.side === side)
    .sort((a, b) => shipTypes.indexOf(typeOf(a)) - shipTypes.indexOf(typeOf(b))
      || (b.shipTier || b.currentShip?.tier || 0) - (a.shipTier || a.currentShip?.tier || 0)
      || (a.shipName || a.currentShip?.name || "").localeCompare(b.shipName || b.currentShip?.name || "")
      || a.name.localeCompare(b.name));
}
const slots = computed(() => {
  const ally = sorted("ally");
  const enemy = sorted("enemy");
  return Array.from({ length: Math.max(ally.length, enemy.length) }, (_, index) => ({ ally: ally[index] || null, enemy: enemy[index] || null }));
});
const ordered = computed(() => ({
  ally: slots.value.flatMap((slot) => slot.ally ? [slot.ally] : []),
  enemy: slots.value.flatMap((slot) => slot.enemy ? [slot.enemy] : []),
}));
const recentLogs = computed(() => (props.logs || []).slice(-5).reverse());
function metric(player: RosterPlayer, mode: "overall" | "ship") {
  return mode === "overall" ? player.overall : player.currentShip;
}
function percent(value?: number) {
  return Number.isFinite(value) ? Number(value).toFixed(1) + "%" : "—";
}
function winRateColor(value?: number) {
  if (!Number.isFinite(value)) return "#78909f";
  if (Number(value) < 48) return "#f06b6b";
  if (Number(value) < 50) return "#ff9d56";
  if (Number(value) < 52) return "#f3cf5c";
  if (Number(value) < 54) return "#9fda79";
  if (Number(value) < 56) return "#4dbf7a";
  if (Number(value) < 60) return "#61b9f5";
  return "#b485f5";
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
type ChartPoint = { x: number; y: number; value: number; player: RosterPlayer };
function calculatePoints(side: "ally" | "enemy"): Array<ChartPoint | null> {
  const denominator = Math.max(11, slots.value.length - 1);
  return slots.value.map((slot, index) => {
    const player = slot[side];
    if (!player) return null;
    const value = metric(player, chartMode.value)?.winRate;
    if (!Number.isFinite(value)) return null;
    return { x: 42 + index * 316 / denominator, y: 20 + (chartMax.value - Number(value)) * 180 / Math.max(1, chartMax.value - chartMin.value), value: Number(value), player };
  });
}
const chartPoints = computed(() => ({ ally: calculatePoints("ally"), enemy: calculatePoints("enemy") }));
function points(side: "ally" | "enemy") { return chartPoints.value[side]; }
function showChartPoint(event: Event, point: ChartPoint | null, side: "ally" | "enemy") {
  if (!point) return;
  const circle = event.currentTarget as SVGCircleElement;
  const plot = circle.closest(".battle-chart__plot")?.getBoundingClientRect();
  const bounds = circle.getBoundingClientRect();
  if (!plot) return;
  hoveredPoint.value = {
    name: point.player.name,
    ship: point.player.currentShip?.name || point.player.shipName,
    side,
    rate: point.value,
    x: Math.max(82, Math.min(bounds.left + bounds.width / 2 - plot.left, plot.width - 82)),
    y: Math.max(45, bounds.top - plot.top),
  };
}
function calculateSegments(side: "ally" | "enemy") {
  const result: string[] = [];
  let current: string[] = [];
  for (const point of points(side)) {
    if (point) current.push((current.length ? "L" : "M") + point.x.toFixed(1) + " " + point.y.toFixed(1));
    else if (current.length) { result.push(current.join(" ")); current = []; }
  }
  if (current.length) result.push(current.join(" "));
  return result;
}
const chartSegments = computed(() => ({ ally: calculateSegments("ally"), enemy: calculateSegments("enemy") }));
function segments(side: "ally" | "enemy") { return chartSegments.value[side]; }
</script>

<template>
  <div class="battle-roster" :class="{ 'battle-roster--embedded': embedded }">
    <div v-if="arena" class="battle-board">
      <div class="battle-board__roster">
        <div class="battle-board__columns">
          <div class="battle-board__columns--ally"><span>我方 · 舰船 / 玩家</span><span>账号数据</span><span>单舰数据</span></div>
          <div class="battle-board__columns--enemy"><span>敌方 · 舰船 / 玩家</span><span>账号数据</span><span>单舰数据</span></div>
        </div>
        <div v-for="(pair, index) in slots" :key="index" class="battle-pair">
          <div v-for="side in (['ally', 'enemy'] as const)" :key="side" class="battle-entry" :class="['battle-entry--' + side, { 'battle-entry--empty': !pair[side] }]" :style="pair[side] ? { '--win-rate-color': winRateColor(pair[side]!.overall?.winRate), '--ship-win-rate-color': winRateColor(pair[side]!.currentShip?.winRate) } : undefined" @contextmenu="pair[side] && showContextMenu($event, pair[side]!)">
            <template v-if="pair[side]">
              <div class="battle-entry__badges">
                <AppIcon v-if="playerMark(realm || 'asia', pair[side]!.accountId, pair[side]!.name).favorite" name="star" :size="22" class="battle-entry__favorite" aria-label="特别关注" />
                <AppIcon v-if="playerMark(realm || 'asia', pair[side]!.accountId, pair[side]!.name).monkey" name="monkey" :size="23" class="battle-entry__monkey" aria-label="海猴标记" />
                <span v-if="pair[side]!.status === 'loading'" class="battle-entry__status"><span class="ui-spinner" aria-hidden="true"></span>读取中</span>
                <span v-else-if="pair[side]!.status === 'hidden'" class="battle-entry__status">隐藏战绩</span>
                <span v-else-if="pair[side]!.status === 'not-found'" class="battle-entry__status" :title="pair[side]!.error">未找到账号</span>
                <span v-else-if="pair[side]!.status === 'error'" class="battle-entry__status" :title="pair[side]!.error">读取失败</span>
              </div>
              <div class="battle-entry__identity" :title="(pair[side]!.currentShip?.name || pair[side]!.shipName) + ' · ' + (pair[side]!.clan ? `[${pair[side]!.clan!.tag}] ` : '') + pair[side]!.name">
                <strong>{{ pair[side]!.currentShip?.name || pair[side]!.shipName || '未知舰船' }}</strong>
                <small><b v-if="pair[side]!.clan">[{{ pair[side]!.clan!.tag }}]</b>{{ pair[side]!.name }}</small>
              </div>
              <div class="battle-entry__stats battle-entry__stats--overall"><strong>{{ percent(pair[side]!.overall?.winRate) }}</strong><small>{{ number(pair[side]!.overall?.battles) }} 场 · {{ number(pair[side]!.overall?.avgXp) }} 经验</small></div>
              <div class="battle-entry__stats battle-entry__stats--ship"><strong>{{ percent(pair[side]!.currentShip?.winRate) }}</strong><small>{{ number(pair[side]!.currentShip?.battles) }} 场 · {{ number(pair[side]!.currentShip?.avgXp) }} 经验</small></div>
            </template>
            <span v-else class="battle-entry__placeholder">—</span>
          </div>
        </div>
        <div v-if="!slots.length" class="battle-roster__empty">正在读取双方阵容…</div>
      </div>
      <aside class="battle-board__side">
        <section class="battle-chart">
          <header><div><strong>双方胜率走势</strong><small>按左侧舰种排序，逐位对照</small></div><select v-model="chartMode" aria-label="图表数据类型"><option value="overall">账号胜率</option><option value="ship">单舰胜率</option></select></header>
          <div class="battle-chart__summary"><span class="battle-chart__ally">我方 {{ percent(average('ally', chartMode)) }}</span><span class="battle-chart__enemy">敌方 {{ percent(average('enemy', chartMode)) }}</span></div>
          <div class="battle-chart__plot">
            <svg class="battle-chart__svg" viewBox="0 0 380 240" role="img" :aria-label="(chartMode === 'overall' ? '账号' : '单舰') + '胜率对比折线图'">
              <g v-for="(tick, index) in chartTicks" :key="index"><line x1="42" :y1="20 + index * 45" x2="358" :y2="20 + index * 45" class="battle-chart__grid" /><text x="35" :y="24 + index * 45" text-anchor="end">{{ tick.toFixed(0) }}%</text></g>
              <path v-for="(path, index) in segments('ally')" :key="'a' + index" :d="path" class="battle-chart__line battle-chart__line--ally" />
              <path v-for="(path, index) in segments('enemy')" :key="'e' + index" :d="path" class="battle-chart__line battle-chart__line--enemy" />
              <circle v-for="(point, index) in points('ally')" v-show="point" :key="'ac' + index" :cx="point?.x" :cy="point?.y" r="5" class="battle-chart__dot battle-chart__dot--ally" tabindex="0" :aria-label="`我方 ${point?.player.name} ${percent(point?.value)}`" @mouseenter="showChartPoint($event, point, 'ally')" @focus="showChartPoint($event, point, 'ally')" @mouseleave="hoveredPoint = null" @blur="hoveredPoint = null" />
              <circle v-for="(point, index) in points('enemy')" v-show="point" :key="'ec' + index" :cx="point?.x" :cy="point?.y" r="5" class="battle-chart__dot battle-chart__dot--enemy" tabindex="0" :aria-label="`敌方 ${point?.player.name} ${percent(point?.value)}`" @mouseenter="showChartPoint($event, point, 'enemy')" @focus="showChartPoint($event, point, 'enemy')" @mouseleave="hoveredPoint = null" @blur="hoveredPoint = null" />
              <text x="42" y="225">1</text><text x="358" y="225" text-anchor="end">{{ Math.max(12, slots.length) }}</text>
            </svg>
            <div v-if="hoveredPoint" class="battle-chart__tooltip" :style="{ left: `${hoveredPoint.x}px`, top: `${hoveredPoint.y}px` }" role="status">
              <span>{{ hoveredPoint.side === 'ally' ? '我方' : '敌方' }} · {{ hoveredPoint.ship }}</span>
              <strong>{{ hoveredPoint.name }} <b>{{ percent(hoveredPoint.rate) }}</b></strong>
            </div>
          </div>
          <p v-if="!chartValues.length" class="battle-chart__empty">公开战绩读取后显示走势</p>
          <small class="battle-chart__note">仅统计可读取的公开数据；缺失数据不会计为 0%。</small>
        </section>
        <section class="battle-activity">
          <header><strong>读取信息</strong><button v-if="embedded" type="button" :disabled="refreshing" @click="emit('refresh')"><span v-if="refreshing" class="ui-spinner" aria-hidden="true"></span>{{ refreshing ? '刷新中…' : '刷新数据' }}</button></header>
          <div class="battle-activity__list" role="log" aria-live="polite">
            <div v-for="(entry, index) in recentLogs" :key="index"><time>{{ entry.time }}</time><span :class="entry.tone">{{ entry.message }}</span></div>
            <div v-if="!logs?.length"><time>—</time><span>等待对局数据</span></div>
          </div>
        </section>
      </aside>
    </div>
    <div v-if="contextMenu" class="battle-mark-menu" :style="{ left: `${contextMenu.x}px`, top: `${contextMenu.y}px` }" role="menu" :aria-label="`标记 ${contextMenu.player.name}`">
      <div class="battle-mark-menu__name">{{ contextMenu.player.name }}</div>
      <button type="button" role="menuitemcheckbox" :aria-checked="playerMark(realm || 'asia', contextMenu.player.accountId, contextMenu.player.name).favorite" @click="toggleMark('favorite')"><AppIcon name="star" :size="16" />特别关注 <span>{{ playerMark(realm || 'asia', contextMenu.player.accountId, contextMenu.player.name).favorite ? '✓' : '' }}</span></button>
      <button type="button" role="menuitemcheckbox" :aria-checked="playerMark(realm || 'asia', contextMenu.player.accountId, contextMenu.player.name).monkey" @click="toggleMark('monkey')"><AppIcon name="monkey" :size="16" />海猴标记 <span>{{ playerMark(realm || 'asia', contextMenu.player.accountId, contextMenu.player.name).monkey ? '✓' : '' }}</span></button>
    </div>
    <div v-if="!arena" class="battle-roster__empty">进入对局后，双方阵容与公开战绩会自动显示在这里。</div>
  </div>
</template>
