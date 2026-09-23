<script setup lang="ts">
import { computed, ref } from "vue";
import type { ShipStats } from "../types";

const props = defineProps<{ ships: ShipStats[] }>();
const query = ref("");
const sort = ref<"battles" | "winRate" | "avgDamage">("battles");

const rows = computed(() =>
  props.ships
    .filter((ship) => ship.name.toLowerCase().includes(query.value.trim().toLowerCase()))
    .slice()
    .sort((a: ShipStats, b: ShipStats) => b[sort.value] - a[sort.value])
    .slice(0, 150),
);

function winrateClass(value: number) {
  if (value >= 60) return "metric--excellent";
  if (value >= 55) return "metric--good";
  if (value < 48) return "metric--weak";
  return "";
}
</script>

<template>
  <section class="panel ship-panel">
    <header class="panel__header">
      <div>
        <span class="eyebrow">单舰数据</span>
        <h2>{{ ships.length }} 艘舰船</h2>
      </div>
      <div class="table-tools">
        <input v-model="query" placeholder="搜索舰船" />
        <select v-model="sort">
          <option value="battles">按场次</option>
          <option value="winRate">按胜率</option>
          <option value="avgDamage">按伤害</option>
        </select>
      </div>
    </header>
    <div class="data-table">
      <div class="data-table__head">
        <span>舰船</span><span>等级</span><span>场次</span><span>胜率</span><span>场均伤害</span><span>场均击沉</span>
      </div>
      <div v-for="ship in rows" :key="ship.shipId" class="data-table__row">
        <span class="ship-name"><i>{{ ship.type.replace('AirCarrier', 'CV').replace('Battleship', 'BB').replace('Cruiser', 'CA').replace('Destroyer', 'DD').replace('Submarine', 'SS') }}</i>{{ ship.name }}</span>
        <span class="muted">T{{ ship.tier }}</span>
        <span>{{ ship.battles.toLocaleString() }}</span>
        <span :class="winrateClass(ship.winRate)">{{ ship.winRate.toFixed(1) }}%</span>
        <span>{{ Math.round(ship.avgDamage).toLocaleString() }}</span>
        <span>{{ ship.avgFrags.toFixed(2) }}</span>
      </div>
    </div>
  </section>
</template>
