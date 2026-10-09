<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";
import BattleRoster from "./BattleRoster.vue";
import type { AppConfig, ArenaInfo, RosterPlayer } from "../types";

const arena = ref<ArenaInfo | null>(null);
const roster = ref<RosterPlayer[]>([]);
const realm = ref("asia");
const visible = ref(false);
const battleMode = ref<AppConfig["overlayBattleMode"]>("random");
let disposed = false;
let cleanups: Array<() => void> = [];
onMounted(async () => {
  let arenaRevision = 0, rosterRevision = 0, visibilityRevision = 0, configRevision = 0;
  cleanups = [
    window.wws.onArenaUpdate(value => { arenaRevision++; arena.value = value; if (value?.realm) realm.value = value.realm; }),
    window.wws.onRosterStats(value => { rosterRevision++; roster.value = value; }),
    window.wws.onConfigChanged(value => {
      configRevision++; realm.value = value.realm; battleMode.value = value.overlayBattleMode;
      document.documentElement.dataset.theme = value.theme;
    }),
    window.wws.onOverlayStatus(status => {
      if (typeof status.visible === "boolean") { visibilityRevision++; visible.value = status.visible; }
    }),
  ];
  const [config, current] = await Promise.all([window.wws.getConfig(), window.wws.getArenaState()]);
  if (disposed) return;
  if (!configRevision) {
    battleMode.value = config.overlayBattleMode;
    realm.value = (arenaRevision ? arena.value?.realm : current.arena?.realm) || config.realm;
    document.documentElement.dataset.theme = config.theme;
  }
  if (!arenaRevision) arena.value = current.arena;
  if (!rosterRevision) roster.value = current.roster;
  if (!visibilityRevision) visible.value = Boolean(current.visible);
});
onUnmounted(() => { disposed = true; cleanups.forEach(cleanup => cleanup()); });
</script>

<template>
  <main class="overlay-shell" :data-resting="!visible">
    <BattleRoster :arena="arena" :roster="roster" :realm="arena?.realm || realm" :battle-mode="battleMode" />
  </main>
</template>
