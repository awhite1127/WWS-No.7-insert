<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import AppIcon from "./AppIcon.vue";
import LoadingState from "./LoadingState.vue";
import WgAuthGate from "./WgAuthGate.vue";
import type { AppConfig, SnowflakeAuthStatus, SnowflakeSummary, WgAuthStatus } from "../types";

const props = defineProps<{ realm: AppConfig["realm"]; authStatus: WgAuthStatus }>();
const emit = defineEmits<{ authChanged: [status: SnowflakeAuthStatus]; eventName: [name: string] }>();
const status = ref<SnowflakeAuthStatus>({ ...props.authStatus });
const loading = ref(props.authStatus.authorized);
const action = ref<"refresh" | "logout" | "">("");
const error = ref("");
const summaryView = ref<"overview" | "tiers">("overview");
const plannedCounts = ref<Record<string, number>>({});
const selectedQuantities = ref<Record<string, number>>({});

const summary = computed(() => status.value.summary ?? null);
const plannedSpent = computed(() => summary.value?.event.exchangeRewards.reduce(
  (sum, reward) => sum + reward.price * (plannedCounts.value[reward.id] || 0), 0,
) ?? 0);
const remainingTokens = computed(() => (summary.value?.totalTokens ?? 0) - plannedSpent.value);
type ExchangeReward = SnowflakeSummary["event"]["exchangeRewards"][number];

function updateStatus(next: SnowflakeAuthStatus) {
  status.value = next;
  emit("eventName", next.summary?.event.name || "");
  if (next.error) error.value = next.error;
}
async function load() {
  loading.value = true;
  error.value = "";
  try {
    updateStatus(await window.wws.getSnowflakeStatus());
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : String(reason);
  } finally {
    loading.value = false;
  }
}

async function authorized(auth: WgAuthStatus) {
  status.value = auth;
  emit("authChanged", auth);
  plannedCounts.value = {};
  selectedQuantities.value = {};
  loading.value = true;
  error.value = "";
  try {
    updateStatus(await window.wws.refreshSnowflake());
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
    updateStatus(await window.wws.refreshSnowflake());
    plannedCounts.value = {};
    selectedQuantities.value = {};
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
    plannedCounts.value = {};
    selectedQuantities.value = {};
    emit("eventName", "");
    emit("authChanged", status.value);
  } finally {
    action.value = "";
  }
}

function maxQuantity(reward: ExchangeReward) {
  const limitRemaining = reward.limit === undefined ? Infinity : reward.limit - (plannedCounts.value[reward.id] || 0);
  return Math.max(0, Math.min(Math.floor(remainingTokens.value / reward.price), limitRemaining));
}

function selectedQuantity(reward: ExchangeReward) {
  const maximum = maxQuantity(reward);
  if (!maximum) return 0;
  return Math.max(1, Math.min(selectedQuantities.value[reward.id] || 1, maximum));
}

function setQuantity(reward: ExchangeReward, event: Event) {
  const raw = Number((event.target as HTMLInputElement).value);
  const maximum = maxQuantity(reward);
  selectedQuantities.value = {
    ...selectedQuantities.value,
    [reward.id]: maximum ? Math.max(1, Math.min(Number.isFinite(raw) ? Math.floor(raw) : 1, maximum)) : 0,
  };
  (event.target as HTMLInputElement).value = String(selectedQuantity(reward));
}

function remaining(price: number) {
  return Math.max(0, price - remainingTokens.value);
}

function planReward(reward: ExchangeReward, event: MouseEvent) {
  const count = plannedCounts.value[reward.id] || 0;
  const maximum = maxQuantity(reward);
  if (!maximum) return;
  const input = (event.currentTarget as HTMLElement).parentElement?.querySelector("input");
  const raw = Number(input?.value);
  const quantity = Math.max(1, Math.min(Number.isFinite(raw) ? Math.floor(raw) : 1, maximum));
  plannedCounts.value = { ...plannedCounts.value, [reward.id]: count + quantity };
}

function undoReward(reward: ExchangeReward) {
  const count = plannedCounts.value[reward.id] || 0;
  if (!count) return;
  plannedCounts.value = { ...plannedCounts.value, [reward.id]: 0 };
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
          <div><h2>{{ status.nickname }}</h2><small>UID {{ status.accountId }} · {{ new Date(summary.syncedAt).toLocaleString() }}</small></div>
          <div class="snow-account__actions"><button :disabled="Boolean(action)" @click="refresh"><span v-if="action === 'refresh'" class="ui-spinner" aria-hidden="true"></span><AppIcon v-else name="pulse" :size="15" />{{ action === 'refresh' ? '同步中' : '刷新港口' }}</button><button :disabled="Boolean(action)" @click="logout">退出授权</button></div>
        </header>
        <div class="snow-summary__tabs" role="tablist" aria-label="扫雪奖励视图">
          <button type="button" role="tab" :aria-selected="summaryView === 'overview'" :class="{ active: summaryView === 'overview' }" @click="summaryView = 'overview'">可获得总览</button>
          <button type="button" role="tab" :aria-selected="summaryView === 'tiers'" :class="{ active: summaryView === 'tiers' }" @click="summaryView = 'tiers'">各等级奖励</button>
        </div>
        <div class="snow-summary__views">
          <div class="snow-totals" :class="{ 'is-hidden': summaryView !== 'overview' }" :inert="summaryView !== 'overview'" :aria-hidden="summaryView !== 'overview'">
            <article><span>港口舰船</span><strong>{{ summary.totalShips }}</strong><small>包含全部等级</small></article>
            <article><span>可扫雪舰船</span><strong>{{ summary.eligibleShips }}</strong><small>V级及以上</small></article>
            <article class="snow-total--token"><span>节日代币总计</span><strong>{{ summary.totalTokens.toLocaleString() }}</strong><small>V–X级舰船</small></article>
            <article class="snow-total--steel"><span>钢铁总计</span><strong>{{ summary.totalSteel.toLocaleString() }}</strong><small>超级舰船</small></article>
          </div>
          <div class="snow-tier-grid snow-tier-grid--inside" :class="{ 'is-hidden': summaryView !== 'tiers' }" :inert="summaryView !== 'tiers'" :aria-hidden="summaryView !== 'tiers'">
            <article v-for="row in summary.tiers" :key="row.tier">
              <span>{{ row.label }}</span><strong>{{ row.count }}<small> 艘</small></strong>
              <div><em>单舰 {{ row.rewardPerShip }}</em><b>{{ row.totalReward.toLocaleString() }} {{ row.rewardType === 'steel' ? '钢铁' : '代币' }}</b></div>
            </article>
          </div>
        </div>
        <p v-if="summary?.warning" class="error-message" role="status">{{ summary.warning }}</p>
        <p v-if="error" class="error-message">{{ error }}</p>
      </section>

      <section class="panel snow-exchange">
        <header class="panel__header"><div><span class="eyebrow">EVENT EXCHANGE</span><h2>本期可兑换奖励</h2></div><small>仅供兑换规划，不会实际兑换</small></header>
        <div class="snow-budget">
          <span>可获得代币 <strong>{{ summary.totalTokens.toLocaleString() }}</strong></span>
          <span>已规划使用 <strong>{{ plannedSpent.toLocaleString() }}</strong></span>
          <span>剩余代币 <strong>{{ remainingTokens.toLocaleString() }}</strong></span>
          <button :class="{ 'is-reserved': !plannedSpent }" :disabled="!plannedSpent" :aria-hidden="!plannedSpent" type="button" @click="plannedCounts = {}">重置规划</button>
        </div>
        <div class="snow-reward-grid">
          <article v-for="reward in summary.event.exchangeRewards" :key="reward.id" :class="{ featured: reward.featured, affordable: remainingTokens >= reward.price }">
            <div class="snow-reward__top"><span>{{ reward.category }}</span><i v-if="reward.limit">限购 {{ reward.limit }}</i></div>
            <h3>{{ reward.name }}</h3>
            <strong>{{ reward.price.toLocaleString() }} <small>代币</small></strong>
            <p v-if="maxQuantity(reward)">剩余可规划 {{ maxQuantity(reward) }} 次</p>
            <p v-else-if="reward.limit !== undefined && (plannedCounts[reward.id] || 0) >= reward.limit">已达到限购数量</p>
            <p v-else>当前还差 {{ remaining(reward.price).toLocaleString() }} 枚</p>
            <div class="snow-reward__actions">
              <label class="snow-reward__quantity">数量 <input type="number" min="1" step="1" :max="maxQuantity(reward)" :value="selectedQuantity(reward)" :disabled="!maxQuantity(reward)" :aria-label="`${reward.name}兑换数量`" @input="setQuantity(reward, $event)" @change="setQuantity(reward, $event)" /></label>
              <button type="button" :disabled="!maxQuantity(reward)" @click="planReward(reward, $event)">兑换</button>
              <button :class="{ 'is-reserved': !plannedCounts[reward.id] }" :disabled="!plannedCounts[reward.id]" :aria-hidden="!plannedCounts[reward.id]" type="button" class="snow-reward__undo" @click="undoReward(reward)">撤销规划</button>
              <span :class="{ 'is-reserved': !plannedCounts[reward.id] }" :aria-hidden="!plannedCounts[reward.id]">已规划 {{ plannedCounts[reward.id] || 0 }} 次</span>
            </div>
          </article>
        </div>
      </section>
    </template>

    <section v-else class="panel snow-loading"><span>港口数据暂时不可用。</span><button class="button-secondary" @click="refresh">重新加载</button><p v-if="error" class="error-message">{{ error }}</p></section>
  </section>
</template>
