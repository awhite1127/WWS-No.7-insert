<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";
import BattleRoster from "./BattleRoster.vue";
import type { ArenaInfo, RosterPlayer } from "../types";

const arena = ref<ArenaInfo | null>(null);
const roster = ref<RosterPlayer[]>([]);
const realm = ref("asia");
let cleanArena: (() => void) | null = null;
let cleanRoster: (() => void) | null = null;

onMounted(async () => {
  realm.value = (await window.wws.getConfig()).realm;
  const current = await window.wws.getArenaState();
  arena.value = current.arena;
  roster.value = current.roster;
  cleanArena = window.wws.onArenaUpdate((value) => (arena.value = value));
  cleanRoster = window.wws.onRosterStats((value) => (roster.value = value));
});
onUnmounted(() => {
  cleanArena?.();
  cleanRoster?.();
});

</script>

<template>
  <main class="overlay-shell">
    <BattleRoster :arena="arena" :roster="roster" :realm="realm" />
  </main>
</template>
