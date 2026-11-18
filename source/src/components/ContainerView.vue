<script setup lang="ts">
import { computed, ref, watch } from "vue";
import AppIcon from "./AppIcon.vue";
import LoadingState from "./LoadingState.vue";
import { createContainerSimulator, type SimulatedReward } from "../container-simulator";
import type { AppConfig, ChristmasPortShips, ContainerDetails, ContainerSummary, WgAuthStatus } from "../types";

const props = defineProps<{ realm: AppConfig["realm"]; authStatus: WgAuthStatus }>();
const query = ref("");
const containers = ref<ContainerSummary[]>([]);
const selectedId = ref("");
const details = ref<ContainerDetails | null>(null);
const simulator = computed(() => details.value && createContainerSimulator(details.value));
const simulation = ref<{ count: number; rewards: SimulatedReward[] } | null>(null);
const listLoading = ref(false);
const detailLoading = ref(false);
const error = ref("");
const port = ref<ChristmasPortShips | null>(null);
const ownedShipIds = computed(() => new Set(port.value?.realm === props.realm ? port.value.shipIds : []));
let requestId = 0;

const filtered = computed(() => {
  const text = query.value.trim().toLocaleLowerCase();
  if (!text) return containers.value;
  return containers.value.filter((item) =>
    item.title.toLocaleLowerCase().includes(text)
    || item.englishName.toLocaleLowerCase().includes(text)
    || item.id.includes(text));
});

function percent(value: number | null) {
  return value == null ? "—" : `${value.toLocaleString("zh-CN", { maximumFractionDigits: 2 })}%`;
}

function errorMessage(reason: unknown) {
  return reason instanceof Error ? reason.message : String(reason);
}

function openOfficialSource() {
  void window.wws.openContainerSource(props.realm);
}

function simulate(count: number) {
  if (simulator.value) simulation.value = { count, rewards: simulator.value(count) };
}

async function selectContainer(item: ContainerSummary) {
  selectedId.value = item.id;
  details.value = null;
  simulation.value = null;
  detailLoading.value = true;
  error.value = "";
  const currentRequest = ++requestId;
  try {
    const result = await window.wws.containerDetails(item.id, props.realm);
    if (currentRequest === requestId) details.value = result;
  } catch (reason) {
    if (currentRequest === requestId) error.value = `读取箱子详情失败：${errorMessage(reason)}`;
  } finally {
    if (currentRequest === requestId) detailLoading.value = false;
  }
}

async function loadContainers() {
  const currentRequest = ++requestId;
  listLoading.value = true;
  detailLoading.value = false;
  containers.value = [];
  selectedId.value = "";
  details.value = null;
  simulation.value = null;
  error.value = "";
  try {
    const result = await window.wws.listContainers(props.realm);
    if (currentRequest === requestId) containers.value = result;
  } catch (reason) {
    if (currentRequest === requestId) error.value = `读取箱子目录失败：${errorMessage(reason)}`;
  } finally {
    if (currentRequest === requestId) listLoading.value = false;
  }
}

watch(() => props.realm, () => void loadContainers(), { immediate: true });
watch(() => [props.authStatus.authorized, props.authStatus.accountId, props.realm], async () => {
  port.value = null;
  if (!props.authStatus.authorized || props.authStatus.realm !== props.realm) return;
  try { port.value = await window.wws.getChristmasPortShips(); } catch { /* Box details remain available if port access fails. */ }
}, { immediate: true });
</script>

<template>
  <section class="container-explorer">
    <div class="container-explorer__layout">
      <section class="container-picker panel">
        <div class="container-picker__heading"><strong>补给箱目录</strong><span>{{ containers.length }} 种</span></div>
        <label class="container-picker__search"><AppIcon name="search" :size="17" /><input v-model="query" type="search" placeholder="搜索中文、英文名称或编号" aria-label="搜索补给箱" /></label>
        <LoadingState v-if="listLoading" compact label="正在读取补给箱目录" detail="正在整理官方箱子资料" />
        <div v-else-if="!filtered.length" class="container-picker__message">{{ containers.length ? '没有找到匹配的箱子' : '箱子目录暂不可用' }}</div>
        <div v-else class="container-picker__list" role="listbox" aria-label="补给箱列表">
          <button v-for="item in filtered" :key="item.id" type="button" role="option" :aria-selected="selectedId === item.id" :class="{ active: selectedId === item.id }" @click="selectContainer(item)">
            <strong>{{ item.title }}</strong><small v-if="item.englishName !== item.title">{{ item.englishName }}</small>
          </button>
        </div>
      </section>
      <section class="container-detail panel">
        <LoadingState v-if="detailLoading" class="container-detail__empty" label="正在读取奖励与概率…" detail="正在整理奖励分组与官方掉落概率" />
        <div v-else-if="error" class="container-detail__empty container-detail__empty--error"><strong>{{ error }}</strong><button v-if="selectedId" type="button" @click="selectContainer(containers.find((item) => item.id === selectedId)!)">重试</button><button v-else type="button" @click="loadContainers">重试</button></div>
        <div v-else-if="details" class="container-detail__content">
          <header><div><span class="eyebrow">官方掉落资料</span><h2>{{ details.title }}</h2><small>箱子编号 {{ details.id }}</small></div><button type="button" @click="openOfficialSource">查看官网说明 ↗</button></header>
          <p class="container-detail__note">概率按官网当前公布的数据展示。奖励组概率表示抽中该组的机会；组内各物品未公布单独概率时不会推算。{{ port?.realm === realm ? `已对照 ${port.nickname} 的港口舰船。` : '' }}</p>
          <section class="container-simulator" aria-label="模拟开箱">
            <div class="container-simulator__actions">
              <h3>模拟开箱</h3>
              <button v-for="count in [1, 10, 100]" :key="count" type="button" class="button-secondary" :disabled="!simulator" @click="simulate(count)">开 {{ count }} 个</button>
            </div>
            <p>{{ simulator ? '按公开掉落率模拟。组内权重未完整公布时采用等权抽取。每箱独立抽取，模拟范围为基础掉落率。' : '此箱子的奖励槽位缺少完整掉落率，暂无法模拟。' }}</p>
            <div v-if="simulation" class="container-simulator__results" aria-live="polite">
              <strong>本次开启 {{ simulation.count }} 个</strong>
              <ul><li v-for="reward in simulation.rewards" :key="reward.key"><span>{{ reward.name }}</span><b>× {{ reward.amount.toLocaleString('zh-CN') }}</b></li></ul>
            </div>
          </section>
          <article v-for="slot in details.slots" :key="slot.number" class="container-slot">
            <h3>奖励槽位 {{ slot.number }} <small v-if="slot.title">{{ slot.title }}</small></h3>
            <details v-for="(group, index) in slot.groups" :key="index" class="container-group" :open="group.rewards.length <= 15">
              <summary><span><strong>{{ group.title }}</strong><small>{{ group.rewards.length }} 种可能奖励</small></span><b v-if="group.probability != null">{{ percent(group.probability) }} 组概率</b></summary>
              <div v-if="group.guaranteedAfter" class="container-group__guarantee">官方保底计数：{{ group.guaranteedAfter }}</div>
              <div class="container-rewards">
                <div v-for="(reward, rewardIndex) in group.rewards" :key="`${reward.type}-${reward.id}-${rewardIndex}`" class="container-reward">
                  <span><strong>{{ reward.name }} <i v-if="reward.type === 'ship' && reward.id && ownedShipIds.has(Number(reward.id))" class="container-reward__owned">✓ 已拥有</i></strong><small v-if="reward.amount > 1">数量 {{ reward.amount.toLocaleString('zh-CN') }}</small></span>
                  <b v-if="reward.probability != null">{{ percent(reward.probability) }}</b>
                  <em v-else-if="group.probability != null && group.rewards.length === 1">{{ percent(group.probability) }}</em>
                  <em v-else>组内未单独公布</em>
                </div>
              </div>
            </details>
          </article>
        </div>
        <div v-else class="container-detail__empty"><AppIcon name="database" :size="28" /><strong>选择左侧箱子查看奖励</strong><span>支持中文或英文名称搜索</span></div>
      </section>
    </div>
  </section>
</template>

<style scoped>
.container-simulator { display: grid; gap: 8px; margin: 12px 0; padding: 12px; border: 1px solid var(--line); border-radius: 8px; }
.container-simulator__actions { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.container-simulator__actions h3 { margin: 0 auto 0 0; font-size: 14px; }
.container-simulator__actions button { min-height: 30px; padding: 0 10px; font-size: 11px; }
.container-simulator > p { margin: 0; color: var(--muted); font-size: 11px; }
.container-simulator__results { font-size: 12px; }
.container-simulator__results ul { display: grid; gap: 4px; max-height: 180px; overflow: auto; margin: 6px 0 0; padding: 0; list-style: none; }
.container-simulator__results li { display: flex; justify-content: space-between; gap: 10px; padding: 5px 8px; background: var(--panel-solid); }
.container-simulator__results li b { flex: none; }
</style>
