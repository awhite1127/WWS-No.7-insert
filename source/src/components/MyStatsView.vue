<script setup lang="ts">
import { ref, watch } from "vue";
import LoadingState from "./LoadingState.vue";
import PerformanceOverview from "./PerformanceOverview.vue";
import ShipTable from "./ShipTable.vue";
import WgAuthGate from "./WgAuthGate.vue";
import type { AppConfig, PlayerDetails, WgAuthStatus } from "../types";

const props = defineProps<{ authStatus: WgAuthStatus; realm: AppConfig["realm"] }>();
const emit = defineEmits<{ authorized: [status: WgAuthStatus] }>();
const player = ref<PlayerDetails | null>(null);
const loading = ref(false);
const error = ref("");

async function load() {
  if (loading.value) return;
  if (!props.authStatus.authorized) {
    player.value = null;
    return;
  }
  loading.value = true;
  error.value = "";
  try {
    player.value = await window.wws.getMyStats();
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : String(reason);
  } finally {
    loading.value = false;
  }
}

function authorized(status: WgAuthStatus) {
  emit("authorized", status);
  void load();
}

watch(() => props.authStatus.authorized, () => void load(), { immediate: true });
</script>

<template>
  <WgAuthGate v-if="!authStatus.authorized" :realm="realm" feature-name="我的战绩" @authorized="authorized" />
  <LoadingState v-else-if="loading && !player" class="panel stats-loading" label="正在读取你的随机战战绩…" detail="正在同步账号总览、历史快照与舰船数据" />
  <section v-else-if="player" class="result-area my-stats-page" :aria-busy="loading">
    <div v-if="error" class="refresh-error" role="alert">{{ error }} · 当前显示上次读取的战绩</div>
    <PerformanceOverview :player="player" authorized :refreshing="loading" @refresh="load" />
    <ShipTable :ships="player.ships" />
  </section>
  <section v-else class="panel snow-loading"><span>{{ error || '战绩暂时不可用' }}</span><button class="button-secondary" @click="load">重新加载</button></section>
</template>
