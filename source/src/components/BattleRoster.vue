<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import AppIcon from "./AppIcon.vue";
import { summarizeBattleTeams } from "../battle-summary";
import { automaticPlayerMark, playerMark, togglePlayerMark, type PlayerMarkKind } from "../player-marks";
import type { ArenaInfo, RosterPlayer } from "../types";

const props = defineProps<{
  arena: ArenaInfo | null;
  roster: RosterPlayer[];
  embedded?: boolean;
  realm?: string;
}>();
const emit = defineEmits<{ openPlayer: [player: RosterPlayer] }>();
const contextMenu = ref<{ player: RosterPlayer; x: number; y: number } | null>(null);
function markFor(player: RosterPlayer) {
  return playerMark(props.realm || "asia", player.accountId, player.name, player.overall?.winRate);
}
function showContextMenu(event: MouseEvent, player: RosterPlayer) {
  event.preventDefault();
  const card = (event.currentTarget as HTMLElement).getBoundingClientRect();
  contextMenu.value = {
    player,
    x: Math.max(8, Math.min(event.clientX + 6, window.innerWidth - 183)),
    y: Math.max(8, Math.min(card.top, window.innerHeight - 150)),
  };
}
function queryPlayer() {
  const selected = contextMenu.value?.player;
  contextMenu.value = null;
  if (selected) emit("openPlayer", selected);
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
const teamWinRates = computed(() => summarizeBattleTeams(props.roster));
const lowerWinRateSide = computed<"ally" | "enemy" | null>(() => {
  const { ally, enemy } = teamWinRates.value;
  if (ally.value === null || enemy.value === null || ally.value === enemy.value) return null;
  return ally.value < enemy.value ? "ally" : "enemy";
});
function percent(value?: number) {
  return Number.isFinite(value) ? Number(value).toFixed(1) + "%" : "—";
}
function winRateColor(value?: number) {
  if (!Number.isFinite(value)) return "#78909f";
  if (Number(value) < 48) return "#e84d58";
  if (Number(value) < 50) return "#ef7837";
  if (Number(value) < 52) return "#d9af24";
  if (Number(value) < 54) return "#86bd3f";
  if (Number(value) < 56) return "#24b46a";
  if (Number(value) < 60) return "#3196dc";
  return "#9963d9";
}
function number(value?: number) {
  return Number.isFinite(value) ? Math.round(Number(value)).toLocaleString() : "—";
}
function tierLabel(value?: number) {
  return Number.isInteger(value) && Number(value) > 0 && Number(value) <= 11
    ? ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI"][Number(value)]
    : "";
}
</script>

<template>
  <div class="battle-roster" :class="{ 'battle-roster--embedded': embedded }">
    <div v-if="arena" class="battle-board">
      <div class="battle-board__roster">
        <div class="battle-comparison" aria-label="双方公开玩家的平均账号胜率对比">
          <div class="battle-comparison__side battle-comparison__side--ally">
            <span>我方平均胜率</span>
            <strong class="battle-comparison__rate" :class="{ 'battle-comparison__rate--lower': lowerWinRateSide === 'ally' }" :title="`${teamWinRates.ally.available}/${teamWinRates.ally.total} 名玩家有公开数据`">{{ percent(teamWinRates.ally.value ?? undefined) }}</strong>
          </div>
          <b class="battle-comparison__vs">VS</b>
          <div class="battle-comparison__side battle-comparison__side--enemy">
            <strong class="battle-comparison__rate" :class="{ 'battle-comparison__rate--lower': lowerWinRateSide === 'enemy' }" :title="`${teamWinRates.enemy.available}/${teamWinRates.enemy.total} 名玩家有公开数据`">{{ percent(teamWinRates.enemy.value ?? undefined) }}</strong>
            <span>敌方平均胜率</span>
          </div>
        </div>
        <div class="battle-board__columns">
          <div class="battle-board__columns--ally"><span>舰船 / 玩家</span><span title="场次 / 胜率 / 场均经验">账号</span><span title="场次 / 胜率 / 场均伤害">单舰</span></div>
          <div class="battle-board__columns--enemy"><span>舰船 / 玩家</span><span title="场次 / 胜率 / 场均经验">账号</span><span title="场次 / 胜率 / 场均伤害">单舰</span></div>
        </div>
        <div v-for="(pair, index) in slots" :key="index" class="battle-pair">
          <div v-for="side in (['ally', 'enemy'] as const)" :key="side" class="battle-entry" :class="['battle-entry--' + side, { 'battle-entry--empty': !pair[side], 'battle-entry--loading': pair[side]?.status === 'loading' }]" :style="pair[side] ? { '--win-rate-color': winRateColor(pair[side]!.overall?.winRate) } : undefined" @contextmenu="pair[side] && showContextMenu($event, pair[side]!)">
            <template v-if="pair[side]">
              <div class="battle-entry__identity" :title="(pair[side]!.currentShip?.name || pair[side]!.shipName) + ' · ' + (pair[side]!.clan ? `[${pair[side]!.clan!.tag}] ` : '') + pair[side]!.name">
                <div class="battle-entry__ship-line">
                  <strong><span class="battle-entry__tier">{{ tierLabel(pair[side]!.shipTier || pair[side]!.currentShip?.tier) }}</span> {{ pair[side]!.currentShip?.name || pair[side]!.shipName || '未知舰船' }}</strong>
                </div>
                <div class="battle-entry__player-line">
                  <small class="battle-entry__player-name"><span class="battle-entry__name-text"><b v-if="pair[side]!.clan">[{{ pair[side]!.clan!.tag }}]</b>{{ pair[side]!.name }}</span><span class="battle-entry__karma" :title="pair[side]!.karmaStatus === 'ok' ? '游戏内业力 · 来源 WoWS Karma（In-Game），可能存在同步延迟' : pair[side]!.karmaStatus === 'loading' || pair[side]!.status === 'loading' ? '正在读取游戏内业力' : '游戏内业力暂不可用 · 来源 WoWS Karma'">{{ pair[side]!.karmaStatus === 'ok' ? pair[side]!.gameKarma : pair[side]!.karmaStatus === 'loading' || pair[side]!.status === 'loading' ? '…' : '—' }}</span></small>
                  <span v-if="pair[side]!.status === 'loading'" class="battle-entry__status"><span class="ui-spinner" aria-hidden="true"></span>读取中</span>
                  <span v-else-if="pair[side]!.status === 'hidden'" class="battle-entry__status">隐藏战绩</span>
                  <span v-else-if="pair[side]!.status === 'not-found'" class="battle-entry__status" :title="pair[side]!.error">未找到账号</span>
                  <span v-else-if="pair[side]!.status === 'error'" class="battle-entry__status" :title="pair[side]!.error">读取失败</span>
                </div>
                <span v-if="markFor(pair[side]!).favorite || markFor(pair[side]!).monkey" class="battle-entry__badges" :title="markFor(pair[side]!).favorite ? '特别关注' : '海猴标记'">
                  <AppIcon v-if="markFor(pair[side]!).favorite" name="star" :size="26" class="battle-entry__favorite" aria-label="特别关注" />
                  <AppIcon v-else name="monkey" :size="26" :stroke-width="2.1" class="battle-entry__monkey" aria-label="海猴标记" />
                </span>
              </div>
              <div class="battle-entry__stat-column battle-entry__stat-column--overall">
                <template v-if="pair[side]!.status === 'loading'"><span class="battle-entry__skeleton"></span><span class="battle-entry__stat-separator">/</span><span class="battle-entry__skeleton"></span><span class="battle-entry__stat-separator">/</span><span class="battle-entry__skeleton"></span></template>
                <template v-else>
                  <span :title="`账号场次：${number(pair[side]!.overall?.battles)}`">{{ number(pair[side]!.overall?.battles) }}</span><span class="battle-entry__stat-separator" aria-hidden="true">/</span>
                  <strong :title="`账号胜率：${percent(pair[side]!.overall?.winRate)}`">{{ percent(pair[side]!.overall?.winRate) }}</strong><span class="battle-entry__stat-separator" aria-hidden="true">/</span>
                  <span :title="`账号场均经验：${number(pair[side]!.overall?.avgXp)}`">{{ number(pair[side]!.overall?.avgXp) }}</span>
                </template>
              </div>
              <div class="battle-entry__stat-column battle-entry__stat-column--ship">
                <template v-if="pair[side]!.status === 'loading'"><span class="battle-entry__skeleton"></span><span class="battle-entry__stat-separator">/</span><span class="battle-entry__skeleton"></span><span class="battle-entry__stat-separator">/</span><span class="battle-entry__skeleton"></span></template>
                <template v-else>
                  <span :title="`单舰场次：${number(pair[side]!.currentShip?.battles)}`">{{ number(pair[side]!.currentShip?.battles) }}</span><span class="battle-entry__stat-separator" aria-hidden="true">/</span>
                  <strong :title="`单舰胜率：${percent(pair[side]!.currentShip?.winRate)}`">{{ percent(pair[side]!.currentShip?.winRate) }}</strong><span class="battle-entry__stat-separator" aria-hidden="true">/</span>
                  <span :title="`单舰场均伤害：${number(pair[side]!.currentShip?.avgDamage)}`">{{ number(pair[side]!.currentShip?.avgDamage) }}</span>
                </template>
              </div>
            </template>
            <span v-else class="battle-entry__placeholder">—</span>
          </div>
        </div>
        <div v-if="!slots.length" class="battle-roster__empty">正在读取双方阵容…</div>
      </div>
    </div>
    <Teleport to="body">
      <div v-if="contextMenu" class="battle-mark-menu" :style="{ left: `${contextMenu.x}px`, top: `${contextMenu.y}px` }" role="menu" :aria-label="`操作 ${contextMenu.player.name}`">
        <div class="battle-mark-menu__name">{{ contextMenu.player.name }}</div>
        <button type="button" class="battle-mark-menu__query" role="menuitem" @click="queryPlayer"><AppIcon name="user" :size="16" />查询战绩</button>
        <button type="button" class="battle-mark-menu__favorite" role="menuitemcheckbox" :aria-checked="markFor(contextMenu.player).favorite" :disabled="automaticPlayerMark(contextMenu.player.overall?.winRate) !== null" :title="automaticPlayerMark(contextMenu.player.overall?.winRate) ? '按账号胜率自动标记' : '切换特别关注'" @click="toggleMark('favorite')"><AppIcon name="star" :size="16" />特别关注 <span>{{ markFor(contextMenu.player).favorite ? '✓' : '' }}</span></button>
        <button type="button" class="battle-mark-menu__monkey" role="menuitemcheckbox" :aria-checked="markFor(contextMenu.player).monkey" :disabled="automaticPlayerMark(contextMenu.player.overall?.winRate) !== null" :title="automaticPlayerMark(contextMenu.player.overall?.winRate) ? '按账号胜率自动标记' : '切换海猴标记'" @click="toggleMark('monkey')"><AppIcon name="monkey" :size="16" />海猴标记 <span>{{ markFor(contextMenu.player).monkey ? '✓' : '' }}</span></button>
      </div>
    </Teleport>
    <div v-if="!arena" class="battle-roster__empty">进入对局后，双方阵容与公开战绩会自动显示在这里。</div>
  </div>
</template>
