<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import AppIcon from "./AppIcon.vue";
import LoadingState from "./LoadingState.vue";
import WgAuthGate from "./WgAuthGate.vue";
import type { AppConfig, SnowflakeAuthStatus, WgAuthStatus } from "../types";

const props = defineProps<{ realm: AppConfig["realm"]; authStatus: WgAuthStatus }>();
const emit = defineEmits<{ authChanged: [status: SnowflakeAuthStatus] }>();
const status = ref<SnowflakeAuthStatus>({ ...props.authStatus });
const loading = ref(props.authStatus.authorized);
const action = ref<"refresh" | "logout" | "">("");
const error = ref("");

const summary = computed(() => status.value.summary ?? null);
async function load() {
  loading.value = true;
  error.value = "";
  try {
    status.value = await window.wws.getSnowflakeStatus();
    if (status.value.error) error.value = status.value.error;
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : String(reason);
  } finally {
    loading.value = false;
  }
}

async function authorized(auth: WgAuthStatus) {
  status.value = auth;
  emit("authChanged", auth);
  loading.value = true;
  error.value = "";
  try {
    status.value = await window.wws.refreshSnowflake();
    if (status.value.error) error.value = status.value.error;
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : String(reason);
  } finally {
    loading.value = false;
  }
}

async function refresh() {
  action.value = "refresh";
  error.value = "";
  try {
    status.value = await window.wws.refreshSnowflake();
    if (status.value.error) error.value = status.value.error;
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : String(reason);
  } finally {
    action.value = "";
  }
}

async function logout() {
  action.value = "logout";
  try {
    await window.wws.logoutSnowflake();
    status.value = { authorized: false };
    emit("authChanged", status.value);
  } finally {
    action.value = "";
  }
}

function affordable(price: number, limit?: number) {
  const count = Math.floor((summary.value?.totalTokens ?? 0) / price);
  return Math.max(0, limit ? Math.min(count, limit) : count);
}

function remaining(price: number) {
  return Math.max(0, price - (summary.value?.totalTokens ?? 0));
}

onMounted(() => {
  if (props.authStatus.authorized) void load();
  else loading.value = false;
});
</script>

<template>
  <section class="snow-page">
    <LoadingState v-if="loading" class="panel stats-loading" label="正在读取港口舰船…" detail="正在同步舰船数量并计算各等级可获得奖励" />

    <WgAuthGate v-else-if="!status.authorized" :realm="realm" feature-name="扫雪" headline="算算你能获得什么！" @authorized="authorized" />

    <template v-else-if="summary">
      <section class="panel snow-summary">
        <header class="snow-account">
          <div><span class="eyebrow">{{ summary.event.name }} · {{ status.realm?.toUpperCase() }}</span><h2>{{ status.nickname }}</h2><small>UID {{ status.accountId }} · {{ new Date(summary.syncedAt).toLocaleString() }}</small></div>
          <div class="snow-account__actions"><button :disabled="Boolean(action)" @click="refresh"><AppIcon name="pulse" :size="15" />{{ action === 'refresh' ? '同步中' : '刷新港口' }}</button><button :disabled="Boolean(action)" @click="logout">退出授权</button></div>
        </header>
        <div class="snow-totals">
          <article><span>港口舰船</span><strong>{{ summary.totalShips }}</strong><small>包含全部等级</small></article>
          <article><span>可扫雪舰船</span><strong>{{ summary.eligibleShips }}</strong><small>V级及以上</small></article>
          <article class="snow-total--token"><span>节日代币总计</span><strong>{{ summary.totalTokens.toLocaleString() }}</strong><small>V–X级舰船</small></article>
          <article class="snow-total--steel"><span>钢铁总计</span><strong>{{ summary.totalSteel.toLocaleString() }}</strong><small>超级舰船</small></article>
        </div>
        <p v-if="error" class="error-message">{{ error }}</p>
      </section>

      <section class="panel snow-tiers">
        <header class="panel__header"><div><span class="eyebrow">FLEET BREAKDOWN</span><h2>各等级奖励</h2></div><small>按当前港口舰船计算</small></header>
        <div class="snow-tier-grid">
          <article v-for="row in summary.tiers" :key="row.tier">
            <span>{{ row.label }}</span><strong>{{ row.count }}<small> 艘</small></strong>
            <div><em>单舰 {{ row.rewardPerShip }}</em><b>{{ row.totalReward.toLocaleString() }} {{ row.rewardType === 'steel' ? '钢铁' : '代币' }}</b></div>
          </article>
        </div>
      </section>

      <section class="panel snow-exchange">
        <header class="panel__header"><div><span class="eyebrow">EVENT EXCHANGE</span><h2>本期可兑换奖励</h2></div><small>以 {{ summary.totalTokens.toLocaleString() }} 枚代币计算</small></header>
        <div class="snow-reward-grid">
          <article v-for="reward in summary.event.exchangeRewards" :key="reward.id" :class="{ featured: reward.featured, affordable: summary.totalTokens >= reward.price }">
            <div class="snow-reward__top"><span>{{ reward.category }}</span><i v-if="reward.limit">限购 {{ reward.limit }}</i></div>
            <h3>{{ reward.name }}</h3>
            <strong>{{ reward.price.toLocaleString() }} <small>代币</small></strong>
            <p v-if="summary.totalTokens >= reward.price">最多可兑换 {{ affordable(reward.price, reward.limit) }} 次</p>
            <p v-else>还差 {{ remaining(reward.price).toLocaleString() }} 枚</p>
          </article>
        </div>
      </section>
    </template>

    <section v-else class="panel snow-loading"><span>港口数据暂时不可用。</span><button class="button-secondary" @click="refresh">重新加载</button><p v-if="error" class="error-message">{{ error }}</p></section>
  </section>
</template>
