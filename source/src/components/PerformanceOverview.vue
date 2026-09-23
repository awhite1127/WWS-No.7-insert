<script setup lang="ts">
import { computed, ref } from "vue";
import type { OverallStats, PlayerDetails } from "../types";

const props = defineProps<{ player: PlayerDetails }>();
const mode = ref<"random" | "ranked">("random");
const period = ref<"overall" | 1 | 7 | 30 | 90>("overall");

const periodOptions = [
  { value: "overall" as const, label: "总览" },
  { value: 1 as const, label: "1 天" },
  { value: 7 as const, label: "7 天" },
  { value: 30 as const, label: "30 天" },
  { value: 90 as const, label: "90 天" },
];

const recentPeriod = computed(() => period.value === "overall"
  ? null
  : props.player.recent?.periods.find((item) => item.days === period.value) ?? null);

const displayedStats = computed<OverallStats | null>(() => {
  if (period.value === "overall") return props.player.overall;
  const recent = recentPeriod.value;
  if (!recent?.available) return null;
  return {
    battles: recent.battles ?? 0,
    wins: recent.wins ?? 0,
    winRate: recent.winRate ?? 0,
    avgDamage: recent.avgDamage ?? 0,
    avgXp: recent.avgXp ?? 0,
    avgFrags: recent.avgFrags ?? 0,
    survivalRate: recent.survivalRate ?? 0,
  };
});

const remainingDays = computed(() => {
  if (period.value === "overall") return 0;
  return Math.max(0, Math.ceil(period.value - (recentPeriod.value?.actualDays ?? 0)));
});

const winTone = computed(() => {
  const value = displayedStats.value?.winRate ?? 0;
  return value >= 55 ? "good" : value < 48 ? "warn" : "plain";
});

const metrics = computed(() => {
  const stats = displayedStats.value;
  if (!stats) return [];
  return [
    { label: "场次", value: stats.battles.toLocaleString(), hint: "随机战" },
    { label: "胜率", value: `${stats.winRate.toFixed(2)}%`, hint: "随机战", tone: winTone.value },
    { label: "场均伤害", value: Math.round(stats.avgDamage).toLocaleString(), hint: "随机战" },
    { label: "场均经验", value: Math.round(stats.avgXp).toLocaleString(), hint: "随机战" },
    { label: "场均击沉", value: stats.avgFrags.toFixed(2), hint: "随机战" },
    { label: "存活率", value: `${stats.survivalRate.toFixed(1)}%`, hint: "随机战" },
  ];
});

function formatDate(value?: number) {
  if (!value) return "本次查询";
  return new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value));
}
</script>

<template>
  <section class="panel performance-panel">
    <header class="performance-head">
      <div class="performance-profile">
        <div class="performance-avatar">{{ player.nickname.slice(0, 1).toUpperCase() }}</div>
        <div>
          <span class="eyebrow">{{ player.realm.toUpperCase() }} · UID {{ player.accountId }}</span>
          <h2><b v-if="player.clan">[{{ player.clan.tag }}]</b>{{ player.nickname }}</h2>
          <p>{{ player.clan ? player.clan.name : "未加入军团" }}</p>
        </div>
        <span v-if="player.hiddenProfile" class="performance-hidden">战绩已隐藏</span>
      </div>
      <div class="performance-switch" aria-label="切换战斗模式">
        <button :class="{ active: mode === 'random' }" @click="mode = 'random'">随机战</button>
        <button :class="{ active: mode === 'ranked' }" @click="mode = 'ranked'">排位战</button>
      </div>
    </header>

    <template v-if="mode === 'random'">
      <div class="performance-period-bar">
        <div class="performance-periods" aria-label="选择统计周期">
          <button v-for="item in periodOptions" :key="item.value" :class="{ active: period === item.value }" @click="period = item.value">
            {{ item.label }}
          </button>
        </div>
        <span v-if="player.recent">本地记录始于 {{ formatDate(player.recent.trackedSince) }}</span>
      </div>

      <div v-if="displayedStats" class="performance-grid">
        <article v-for="metric in metrics" :key="metric.label" :class="`tone-${metric.tone || 'plain'}`">
          <span>{{ metric.label }}</span>
          <strong>{{ metric.value }}</strong>
          <small>{{ period === 'overall' ? '随机战总览' : `最近 ${period} 天` }}</small>
        </article>
      </div>
      <div v-else-if="player.hiddenProfile" class="performance-empty">
        <strong>无法读取随机战战绩</strong>
        <span>该玩家隐藏了战绩数据。</span>
      </div>
      <div v-else class="performance-empty performance-empty--tracking">
        <strong>{{ period }} 天历史积累中</strong>
        <span>软件会在每次查询时保存累计数据，{{ remainingDays ? `还需约 ${remainingDays} 天形成完整对比` : "当前还没有足够的历史快照" }}。</span>
        <i v-if="player.recent?.storageError">历史记录保存失败：{{ player.recent.storageError }}</i>
      </div>
    </template>

    <template v-else>
      <div v-if="player.ranked.length" class="ranked-strip performance-ranked">
        <article v-for="season in player.ranked.slice(0, 6)" :key="season.seasonId">
          <span>赛季 S{{ season.seasonId }}</span>
          <strong>{{ season.winRate.toFixed(1) }}%</strong>
          <small>{{ season.battles }} 场</small>
          <em>{{ Math.round(season.avgDamage).toLocaleString() }} 场均伤害</em>
        </article>
      </div>
      <div v-else class="performance-empty">
        <strong>暂无排位赛记录</strong>
        <span>当前账号没有可公开读取的排位赛季数据。</span>
      </div>
    </template>
  </section>
</template>
