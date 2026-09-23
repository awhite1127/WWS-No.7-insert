<script setup lang="ts">
import { computed, ref, watch } from "vue";
import AppIcon from "./AppIcon.vue";
import type { AppConfig, ContainerDetails, ContainerSummary } from "../types";

const props = defineProps<{ realm: AppConfig["realm"] }>();
const query = ref("");
const containers = ref<ContainerSummary[]>([]);
const selectedId = ref("");
const details = ref<ContainerDetails | null>(null);
const listLoading = ref(false);
const detailLoading = ref(false);
const error = ref("");
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

async function selectContainer(item: ContainerSummary) {
  selectedId.value = item.id;
  details.value = null;
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
</script>

<template>
  <section class="container-explorer">
    <div class="container-explorer__layout">
      <section class="container-picker panel">
        <div class="container-picker__heading"><strong>补给箱目录</strong><span>{{ containers.length }} 种</span></div>
        <label class="container-picker__search"><AppIcon name="search" :size="17" /><input v-model="query" type="search" placeholder="搜索中文、英文名称或编号" aria-label="搜索补给箱" /></label>
        <div v-if="listLoading" class="container-picker__message">正在读取官网箱子目录…</div>
        <div v-else-if="!filtered.length" class="container-picker__message">{{ containers.length ? '没有找到匹配的箱子' : '箱子目录暂不可用' }}</div>
        <div v-else class="container-picker__list" role="listbox" aria-label="补给箱列表">
          <button v-for="item in filtered" :key="item.id" type="button" role="option" :aria-selected="selectedId === item.id" :class="{ active: selectedId === item.id }" @click="selectContainer(item)">
            <strong>{{ item.title }}</strong><small v-if="item.englishName !== item.title">{{ item.englishName }}</small>
          </button>
        </div>
      </section>
      <section class="container-detail panel">
        <div v-if="detailLoading" class="container-detail__empty"><AppIcon name="database" :size="28" /><strong>正在读取奖励与概率…</strong></div>
        <div v-else-if="error" class="container-detail__empty container-detail__empty--error"><strong>{{ error }}</strong><button v-if="selectedId" type="button" @click="selectContainer(containers.find((item) => item.id === selectedId)!)">重试</button><button v-else type="button" @click="loadContainers">重试</button></div>
        <div v-else-if="details" class="container-detail__content">
          <header><div><span class="eyebrow">官方掉落资料</span><h2>{{ details.title }}</h2><small>箱子编号 {{ details.id }}</small></div><button type="button" @click="openOfficialSource">查看官网说明 ↗</button></header>
          <p class="container-detail__note">概率按官网当前公布的数据展示。奖励组概率表示抽中该组的机会；组内各物品未公布单独概率时不会推算。</p>
          <article v-for="slot in details.slots" :key="slot.number" class="container-slot">
            <h3>奖励槽位 {{ slot.number }} <small v-if="slot.title">{{ slot.title }}</small></h3>
            <details v-for="(group, index) in slot.groups" :key="index" class="container-group" :open="group.rewards.length <= 15">
              <summary><span><strong>{{ group.title }}</strong><small>{{ group.rewards.length }} 种可能奖励</small></span><b v-if="group.probability != null">{{ percent(group.probability) }} 组概率</b></summary>
              <div v-if="group.guaranteedAfter" class="container-group__guarantee">官方保底计数：{{ group.guaranteedAfter }}</div>
              <div class="container-rewards">
                <div v-for="(reward, rewardIndex) in group.rewards" :key="`${reward.type}-${reward.id}-${rewardIndex}`" class="container-reward">
                  <span><strong>{{ reward.name }}</strong><small v-if="reward.amount > 1">数量 {{ reward.amount.toLocaleString('zh-CN') }}</small></span>
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
