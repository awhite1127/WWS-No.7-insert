<script setup lang="ts">
import { computed, ref } from "vue";
import type { ShipStats } from "../types";
import NationFlag from "./NationFlag.vue";

type SortKey = "battles" | "winRate" | "avgDamage" | "avgFrags";
const props = defineProps<{ ships: ShipStats[] }>();
const query = ref("");
const typeFilter = ref("");
const nationFilter = ref("");
const tierFilter = ref(0);
const minBattles = ref(0);
const sortKey = ref<SortKey>("battles");
const sortDirection = ref<"desc" | "asc">("desc");

const typeLabels: Record<string, string> = {
  AirCarrier: "航空母舰", Battleship: "战列舰", Cruiser: "巡洋舰",
  Destroyer: "驱逐舰", Submarine: "潜艇",
};
const nationLabels: Record<string, string> = {
  japan: "日本", usa: "美国", ussr: "苏联", germany: "德国", uk: "英国",
  france: "法国", italy: "意大利", pan_asia: "泛亚", pan_europe: "泛欧",
  commonwealth: "英联邦", netherlands: "荷兰", spain: "西班牙", pan_america: "泛美",
};
const types = computed(() => [...new Set(props.ships.map((ship) => ship.type).filter(Boolean))]
  .sort((a, b) => (typeLabels[a] || a).localeCompare(typeLabels[b] || b, "zh-CN")));
const nations = computed(() => [...new Set(props.ships.map((ship) => ship.nation).filter(Boolean))]
  .sort((a, b) => (nationLabels[a] || a).localeCompare(nationLabels[b] || b, "zh-CN")));
const tiers = computed(() => [...new Set(props.ships.map((ship) => ship.tier).filter((tier) => tier > 0))]
  .sort((a, b) => b - a));
const searchIndex = computed(() => props.ships.map((ship) => ({
  ship, text: `${ship.name} ${ship.englishName || ""}`.toLowerCase(),
})));
const rows = computed(() => {
  const text = query.value.trim().toLowerCase();
  const tier = Number(tierFilter.value);
  const minimum = Math.max(0, Number(minBattles.value) || 0);
  return searchIndex.value.filter(({ ship, text: searchable }) =>
    (!text || searchable.includes(text))
    && (!typeFilter.value || ship.type === typeFilter.value)
    && (!nationFilter.value || ship.nation === nationFilter.value)
    && (!tier || ship.tier === tier)
    && ship.battles >= minimum)
  .map(({ ship }) => ship).sort((a, b) => {
    const difference = a[sortKey.value] - b[sortKey.value];
    return (sortDirection.value === "desc" ? -difference : difference) || a.name.localeCompare(b.name, "zh-CN");
  });
});

function changeSort(key: SortKey) {
  if (sortKey.value === key) sortDirection.value = sortDirection.value === "desc" ? "asc" : "desc";
  else { sortKey.value = key; sortDirection.value = "desc"; }
}

function winrateClass(value: number) {
  if (value >= 60) return "metric--excellent";
  if (value >= 55) return "metric--good";
  if (value < 48) return "metric--weak";
  return "";
}
</script>

<template>
  <section class="panel ship-panel">
    <header class="panel__header ship-panel__header">
      <h2>单舰数据</h2>
      <div class="ship-panel__controls" aria-label="单舰高级筛选">
      <input v-model="query" class="ship-search" aria-label="搜索舰船" placeholder="搜索中文或英文舰名" />
      <label>舰种<select v-model="typeFilter"><option value="">全部舰种</option><option v-for="type in types" :key="type" :value="type">{{ typeLabels[type] || type }}</option></select></label>
      <label>国家<select v-model="nationFilter"><option value="">全部国家</option><option v-for="nation in nations" :key="nation" :value="nation">{{ nationLabels[nation] || nation }}</option></select></label>
      <label>等级<select v-model.number="tierFilter"><option :value="0">全部等级</option><option v-for="tier in tiers" :key="tier" :value="tier">{{ tier }} 级</option></select></label>
      <label>最小场次<input v-model.number="minBattles" type="number" min="0" step="1" placeholder="不限" /></label>
      </div>
    </header>
    <div class="data-table">
      <div class="data-table__head">
        <span>舰船</span><span>等级</span>
        <button v-for="column in ([{ key: 'battles', label: '场次' }, { key: 'winRate', label: '胜率' }, { key: 'avgDamage', label: '场均伤害' }, { key: 'avgFrags', label: '场均击沉' }] as const)" :key="column.key" type="button" :class="{ active: sortKey === column.key }" :aria-label="`按${column.label}${sortKey === column.key && sortDirection === 'desc' ? '升序' : '降序'}排序`" @click="changeSort(column.key)">{{ column.label }}<span v-if="sortKey === column.key">{{ sortDirection === 'desc' ? '↓' : '↑' }}</span></button>
      </div>
      <div v-for="ship in rows" :key="ship.shipId" class="data-table__row">
        <span class="ship-name" :title="ship.englishName && ship.englishName !== ship.name ? `${ship.name} / ${ship.englishName}` : ship.name"><NationFlag :nation="ship.nation" :label="nationLabels[ship.nation] || ship.nation || '未知国籍'" /><i class="ship-name__type">{{ ship.type.replace('AirCarrier', 'CV').replace('Battleship', 'BB').replace('Cruiser', 'CA').replace('Destroyer', 'DD').replace('Submarine', 'SS') }}</i><strong>{{ ship.name }}</strong><small v-if="ship.englishName && ship.englishName !== ship.name">/ {{ ship.englishName }}</small></span>
        <span class="muted">T{{ ship.tier }}</span>
        <span>{{ ship.battles.toLocaleString() }}</span>
        <span :class="winrateClass(ship.winRate)">{{ ship.winRate.toFixed(1) }}%</span>
        <span>{{ Math.round(ship.avgDamage).toLocaleString() }}</span>
        <span>{{ ship.avgFrags.toFixed(2) }}</span>
      </div>
      <p v-if="!rows.length" class="ship-filter-empty">没有符合筛选条件的舰船。</p>
    </div>
  </section>
</template>
