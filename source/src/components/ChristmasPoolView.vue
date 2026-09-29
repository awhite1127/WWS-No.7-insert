<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import catalog from "../../data/christmas-pools.json";
import AppIcon from "./AppIcon.vue";
import type { AppConfig, ChristmasPortShips, WgAuthStatus } from "../types";

const props = defineProps<{ realm: AppConfig["realm"]; authStatus: WgAuthStatus }>();
const emit = defineEmits<{ authorized: [status: WgAuthStatus] }>();
const search = ref("");
const tier = ref("all");
const type = ref("all");
const nation = ref("all");
const ownership = ref("all");
const port = ref<ChristmasPortShips | null>(null);
const loading = ref(false);
const error = ref("");
const pool = computed(() => catalog.pools[0]);
const portMatchesRealm = computed(() => port.value?.realm === props.realm);
const owned = computed(() => new Set(portMatchesRealm.value ? port.value?.shipIds || [] : []));
const ownedCount = computed(() => portMatchesRealm.value ? pool.value.ships.filter((ship) => owned.value.has(ship.id)).length : null);
const nations = computed(() => [...new Set(pool.value.ships.map((ship) => ship.nation))].sort());
const types = computed(() => [...new Set(pool.value.ships.map((ship) => ship.type))].sort());
const typeNames: Record<string, string> = { battleship: "战列舰", cruiser: "巡洋舰", destroyer: "驱逐舰", aircarrier: "航空母舰", submarine: "潜艇" };
const nationNames: Record<string, string> = { usa: "美国", japan: "日本", ussr: "苏联", uk: "英国", germany: "德国", france: "法国", italy: "意大利", europe: "欧洲", pan_asia: "泛亚", pan_america: "泛美", commonwealth: "英联邦", netherlands: "荷兰", spain: "西班牙" };
const visibleShips = computed(() => {
  const needle = search.value.trim().toLocaleLowerCase().replace(/\s+/g, " ");
  return pool.value.ships.filter((ship) => {
    if (tier.value !== "all" && ship.tier !== Number(tier.value)) return false;
    if (type.value !== "all" && ship.type !== type.value) return false;
    if (nation.value !== "all" && ship.nation !== nation.value) return false;
    if (portMatchesRealm.value && ownership.value === "owned" && !owned.value.has(ship.id)) return false;
    if (portMatchesRealm.value && ownership.value === "missing" && owned.value.has(ship.id)) return false;
    const name = `${ship.name} ${ship.englishName} ${ship.id}`.toLocaleLowerCase().replace(/\s+/g, " ");
    return !needle || name.includes(needle);
  }).sort((a, b) => b.tier - a.tier || a.name.localeCompare(b.name, "zh-CN"));
});

async function refreshPort() {
  if (!props.authStatus.authorized) return;
  loading.value = true;
  error.value = "";
  try { port.value = await window.wws.getChristmasPortShips(); }
  catch (reason) { port.value = null; error.value = reason instanceof Error ? reason.message : String(reason); }
  finally { loading.value = false; }
}

async function authorize() {
  loading.value = true;
  error.value = "";
  try {
    const status = await window.wws.loginWg(props.realm);
    emit("authorized", status);
    port.value = await window.wws.getChristmasPortShips();
  } catch (reason) { error.value = reason instanceof Error ? reason.message : String(reason); }
  finally { loading.value = false; }
}

function openSource() { void window.wws.openChristmasSource(pool.value.year); }

watch(() => props.authStatus.authorized, (value) => { if (value) void refreshPort(); else port.value = null; });
watch(() => props.realm, () => { ownership.value = "all"; });
onMounted(() => { if (props.authStatus.authorized) void refreshPort(); });
</script>

<template>
  <section class="christmas-page">
    <section class="panel christmas-overview">
      <div class="christmas-overview__top">
        <div>
          <span class="eyebrow">SANTA CONTAINER FLEET</span>
          <h2>{{ pool.year }} 圣诞船池</h2>
          <p>依据 WG 官方公布的圣诞补给箱掉落名单；港口拥有情况按舰船 ID 核对。</p>
        </div>
        <div class="christmas-overview__actions">
          <button type="button" class="button-secondary" @click="openSource">查看官网说明 ↗</button>
        </div>
      </div>
      <div class="christmas-progress">
        <article><span>船池舰船</span><strong>{{ pool.ships.length }}</strong><small>当年官方掉落名单</small></article>
        <article><span>已拥有</span><strong>{{ ownedCount === null ? '—' : ownedCount }}</strong><small>{{ portMatchesRealm ? `${port?.nickname} · ${props.realm.toUpperCase()}` : '授权后核对港口' }}</small></article>
        <article><span>尚未拥有</span><strong>{{ ownedCount === null ? '—' : pool.ships.length - ownedCount }}</strong><small>当前账号港口对照</small></article>
        <div class="christmas-progress__account">
          <p v-if="port && !portMatchesRealm">当前授权为 {{ port.realm.toUpperCase() }}，请授权 {{ realm.toUpperCase() }} 账号以核对港口。</p>
          <p v-else-if="portMatchesRealm">港口已同步 · {{ new Date(port!.syncedAt).toLocaleString() }}</p>
          <p v-else>名单可离线浏览；授权 WG 账号后显示已拥有舰船。</p>
          <button type="button" :disabled="loading" @click="portMatchesRealm ? refreshPort() : authorize()"><span v-if="loading" class="ui-spinner" aria-hidden="true"></span>{{ loading ? '同步中…' : portMatchesRealm ? '刷新港口' : '授权并核对' }}</button>
        </div>
      </div>
      <p v-if="error" class="error-message">{{ error }}</p>
    </section>

    <section class="panel christmas-catalog">
      <div class="christmas-catalog__toolbar">
        <div><span class="eyebrow">SHIP LIST</span><h2>舰船名单 <small>{{ visibleShips.length }} / {{ pool.ships.length }}</small></h2></div>
        <div class="christmas-filters">
          <input v-model="search" type="search" placeholder="搜索中英文船名或舰船 ID" aria-label="搜索圣诞船池" />
          <select v-model="type" aria-label="筛选舰种"><option value="all">全部舰种</option><option v-for="item in types" :key="item" :value="item">{{ typeNames[item] || item }}</option></select>
          <select v-model="nation" aria-label="筛选国家"><option value="all">全部国家</option><option v-for="item in nations" :key="item" :value="item">{{ nationNames[item] || item }}</option></select>
          <select v-model="tier" aria-label="筛选等级"><option value="all">全部等级</option><option v-for="item in [...new Set(pool.ships.map((ship) => ship.tier))].sort((a,b) => b-a)" :key="item" :value="String(item)">{{ item }} 级</option></select>
          <select v-model="ownership" :disabled="!portMatchesRealm" aria-label="筛选拥有情况"><option value="all">全部状态</option><option value="owned">已拥有</option><option value="missing">未拥有</option></select>
        </div>
      </div>
      <div class="christmas-catalog__list">
        <div v-for="ship in visibleShips" :key="ship.id" class="christmas-ship" :class="{ 'christmas-ship--owned': owned.has(ship.id) }">
          <span class="christmas-ship__tier">{{ ship.tier }}</span>
          <span class="christmas-ship__name"><strong>{{ ship.name }}</strong><small>{{ ship.englishName }}</small></span>
          <span class="christmas-ship__detail">{{ nationNames[ship.nation] || ship.nation }} · {{ typeNames[ship.type] || ship.type }}</span>
          <span class="christmas-ship__group">{{ ship.group }}</span>
          <span class="christmas-ship__status" :class="{ owned: owned.has(ship.id) }">{{ portMatchesRealm ? owned.has(ship.id) ? '✓ 已拥有' : '未拥有' : '待核对' }}</span>
        </div>
        <div v-if="!visibleShips.length" class="christmas-catalog__empty"><AppIcon name="search" :size="26" />没有符合条件的舰船</div>
      </div>
    </section>
  </section>
</template>
