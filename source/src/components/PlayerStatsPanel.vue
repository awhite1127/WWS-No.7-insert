<script setup lang="ts">
import { nextTick, ref, watch } from "vue";
import PerformanceOverview from "./PerformanceOverview.vue";
import StatsTrend from "./StatsTrend.vue";
import ShipClassSummary from "./ShipClassSummary.vue";
import ShipTable from "./ShipTable.vue";
import type { PlayerDetails } from "../types";
const props = defineProps<{ player: PlayerDetails; authorized?: boolean; markable?: boolean; refreshing?: boolean; page: "overview" | "ships" }>();
const emit = defineEmits<{ refresh: []; "update:page": [page: "overview" | "ships"] }>();
const content = ref<HTMLElement | null>(null);
watch(() => `${props.player.realm}:${props.player.accountId}`, () => emit("update:page", "overview"));
watch(() => props.page, async () => { await nextTick(); if (content.value) content.value.scrollTop = 0; });
</script>

<template>
  <section class="result-area stats-panel" :aria-busy="refreshing">
    <div ref="content" class="stats-panel__content" :class="'stats-panel__content--'+page">
      <slot name="notice" />
      <PerformanceOverview v-show="page==='overview'" :player="player" :authorized="authorized" :markable="markable" :refreshing="refreshing" @refresh="emit('refresh')"><template #tools><slot name="tools" /></template></PerformanceOverview>
      <div v-show="page==='overview'" id="stats-page-overview" class="stats-panel__page" role="tabpanel" aria-labelledby="stats-tab-overview"><StatsTrend :key="player.realm+player.accountId" :player="player" /></div>
      <div v-show="page==='ships'" id="stats-page-ships" class="stats-panel__page" role="tabpanel" aria-labelledby="stats-tab-ships"><ShipClassSummary :player="player" :owned="authorized"><template #tools><slot name="tools" /><button v-if="authorized" type="button" class="button-secondary" :disabled="refreshing" @click="emit('refresh')">{{ refreshing ? '正在刷新…' : '刷新战绩' }}</button></template></ShipClassSummary><ShipTable :ships="player.hiddenProfile ? [] : player.ships" /></div>
    </div>
  </section>
</template>

<style scoped>
.stats-panel { display:flex; flex-direction:column; gap:10px; height:100%; min-height:0; overflow:hidden; }
.stats-panel__content { display:flex; flex-direction:column; gap:12px; flex:1; min-height:0; overflow-y:auto; scrollbar-gutter:stable; }
.stats-panel__content > :deep(.performance-panel) { flex:none; }
.stats-panel__page { display:flex; flex-direction:column; flex:none; gap:12px; }
.stats-panel__page :deep(.stats-trend) { height:clamp(380px,calc(100vh - 410px),600px); }
.stats-panel__page :deep(.ship-panel) { display:flex; flex-direction:column; min-height:280px; height:clamp(280px,calc(100vh - 530px),540px); overflow:hidden; }
.stats-panel__page :deep(.data-table) { flex:1; min-height:0; max-height:none; }
.stats-panel__content--overview > #stats-page-overview { flex:1 0 370px; min-height:370px; }
#stats-page-overview :deep(.stats-trend) { height:100%; min-height:370px; flex:1; }
.stats-panel__content--ships > #stats-page-ships { flex:1 0 auto; gap:10px; }
#stats-page-ships :deep(.ship-panel) { height:auto; flex:1 0 280px; }
</style>
