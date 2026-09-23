<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import AppIcon from "./components/AppIcon.vue";
import appIcon from "./assets/app-icon.png";
import BattleRoster from "./components/BattleRoster.vue";
import ContainerView from "./components/ContainerView.vue";
import LoadingState from "./components/LoadingState.vue";
import MyStatsView from "./components/MyStatsView.vue";
import SnowflakeView from "./components/SnowflakeView.vue";
import OverlayView from "./components/OverlayView.vue";
import PerformanceOverview from "./components/PerformanceOverview.vue";
import ShipTable from "./components/ShipTable.vue";
import TitleBar from "./components/TitleBar.vue";
import WgAuthGate from "./components/WgAuthGate.vue";
import type { AppConfig, ArenaInfo, ClanDetails, ClanSearchResult, PlayerDetails, RosterPlayer, SearchResult, WgAuthStatus } from "./types";

const isOverlay = new URLSearchParams(location.search).get("overlay") === "1";
document.documentElement.classList.toggle("overlay-mode", isOverlay);
document.body.classList.toggle("overlay-mode", isOverlay);
const config = ref<AppConfig>({ realm: "asia", theme: "dark", gamePath: "", overlayEnabled: true, overlayHotkey: "Tab" });
const mode = ref<"player" | "clan">("player");
const activeView = ref<"player" | "clan" | "containers" | "overlay" | "my" | "snow">("overlay");
const authStatus = ref<WgAuthStatus>({ authorized: false });
const authOnboardingOpen = ref(false);
const query = ref("");
const searching = ref(false);
const suggestions = ref<SearchResult[]>([]);
const clanSuggestions = ref<ClanSearchResult[]>([]);
const player = ref<PlayerDetails | null>(null);
const clan = ref<ClanDetails | null>(null);
const error = ref("");
const settingsOpen = ref(false);
const settingsSaving = ref(false);
const saveFeedback = ref<{ type: "success" | "error"; message: string } | null>(null);
const arena = ref<ArenaInfo | null>(null);
const roster = ref<RosterPlayer[]>([]);
const watchedPath = ref("");
const watchedGamePath = ref("");
const arenaFileFound = ref(false);
const arenaWarning = ref("");
const battleLogs = ref<Array<{ time: string; message: string; tone?: string }>>([]);
const rosterRefreshing = ref(false);

function logBattle(message: string, tone = "") {
  battleLogs.value = [...battleLogs.value, {
    time: new Date().toLocaleTimeString("zh-CN", { hour12: false }),
    message,
    tone,
  }].slice(-40);
}

async function refreshBattleRoster() {
  if (rosterRefreshing.value) return;
  rosterRefreshing.value = true;
  logBattle("手动刷新双方公开战绩…");
  try {
    await window.wws.refreshRoster();
  } catch (reason) {
    logBattle("刷新失败：" + (reason instanceof Error ? reason.message : String(reason)), "error");
  } finally {
    rosterRefreshing.value = false;
  }
}

interface HistoryEntry { accountId: number; nickname: string; realm: string; }
const history = ref<HistoryEntry[]>(JSON.parse(localStorage.getItem("wwsmonkey.history") || "[]"));
let cleanups: Array<() => void> = [];
let saveFeedbackTimer: ReturnType<typeof setTimeout> | null = null;

const pageMeta = computed(() => {
  if (activeView.value === "clan") return { eyebrow: "CLAN INTELLIGENCE", title: "军团情报", description: "检索军团档案与完整成员名单" };
  if (activeView.value === "containers") return { eyebrow: "CONTAINER INTELLIGENCE", title: "箱子查询", description: "检索官网公布的补给箱奖励和掉落概率" };
  if (activeView.value === "overlay") return { eyebrow: "BATTLE ASSISTANT", title: "七号插", description: `自动加载当前对局，按住 ${hotkeyLabel(config.value.overlayHotkey)} 可在游戏中呼出` };
  if (activeView.value === "my") return { eyebrow: "PERSONAL PERFORMANCE", title: "我的战绩", description: "仅展示当前授权账号的总体战绩、排位记录和舰船水平" };
  if (activeView.value === "snow") return { eyebrow: "FESTIVE REWARDS", title: "扫雪", description: "算算你能获得什么！" };
  return { eyebrow: "PLAYER INTELLIGENCE", title: "玩家战绩", description: "从 WG 官方数据中检索公开战绩" };
});

watch(() => config.value.theme, (theme) => {
  document.documentElement.dataset.theme = theme;
}, { immediate: true });

async function runSearch() {
  const text = query.value.trim();
  if (!text) return;
  searching.value = true;
  error.value = "";
  suggestions.value = [];
  clanSuggestions.value = [];
  try {
    if (mode.value === "clan") {
      const matches = await window.wws.searchClans(text, config.value.realm);
      const exact = matches.find((item) => item.tag.toLowerCase() === text.toLowerCase() || item.name.toLowerCase() === text.toLowerCase());
      if (exact) await loadClan(exact.clan_id);
      else clanSuggestions.value = matches;
      if (matches.length === 0) error.value = "没有找到该军团";
      return;
    }
    if (/^\d+$/.test(text)) {
      await loadPlayer(Number(text));
      return;
    }
    const matches = await window.wws.searchPlayers(text, config.value.realm);
    const exact = matches.find((match) => match.nickname.toLowerCase() === text.toLowerCase());
    if (exact) await loadPlayer(exact.account_id);
    else suggestions.value = matches;
    if (matches.length === 0) error.value = "没有找到该玩家";
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : String(reason);
  } finally {
    searching.value = false;
  }
}

async function loadClan(clanId: number) {
  searching.value = true;
  error.value = "";
  try {
    clan.value = await window.wws.clanDetails(clanId, config.value.realm);
    query.value = clan.value.tag;
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : String(reason);
  } finally {
    searching.value = false;
  }
}

function selectMode(next: "player" | "clan") {
  activeView.value = next;
  mode.value = next;
  query.value = "";
  error.value = "";
  suggestions.value = [];
  clanSuggestions.value = [];
}

function openOverlay() {
  activeView.value = "overlay";
  error.value = "";
}

function openSnow() {
  activeView.value = "snow";
  error.value = "";
}

function openMyStats() {
  activeView.value = "my";
  error.value = "";
}

function openContainers() {
  activeView.value = "containers";
  error.value = "";
}

function handleAuthorized(status: WgAuthStatus) {
  authStatus.value = status;
  authOnboardingOpen.value = false;
  localStorage.setItem("wwsmonkey.authPromptSeen", "1");
}

function skipAuthOnboarding() {
  authOnboardingOpen.value = false;
  localStorage.setItem("wwsmonkey.authPromptSeen", "1");
}

function openMember(accountId: number) {
  selectMode("player");
  void loadPlayer(accountId);
}

function openHistory(item: HistoryEntry) {
  activeView.value = "player";
  mode.value = "player";
  config.value.realm = item.realm as AppConfig["realm"];
  void loadPlayer(item.accountId);
}

async function loadPlayer(accountId: number) {
  searching.value = true;
  error.value = "";
  try {
    player.value = await window.wws.playerDetails(accountId, config.value.realm);
    query.value = player.value.nickname;
    const entry = { accountId, nickname: player.value.nickname, realm: config.value.realm };
    history.value = [entry, ...history.value.filter((item) => item.accountId !== accountId || item.realm !== config.value.realm)].slice(0, 12);
    localStorage.setItem("wwsmonkey.history", JSON.stringify(history.value));
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : String(reason);
  } finally {
    searching.value = false;
  }
}

async function saveSettings() {
  settingsSaving.value = true;
  try {
    const plainConfig: AppConfig = {
      realm: config.value.realm,
      theme: config.value.theme,
      gamePath: config.value.gamePath,
      overlayEnabled: config.value.overlayEnabled,
      overlayHotkey: config.value.overlayHotkey,
    };
    const gamePathChanged = plainConfig.gamePath !== watchedGamePath.value;
    config.value = await window.wws.saveConfig(plainConfig);
    if (gamePathChanged || (config.value.gamePath && !watchedPath.value)) {
      arenaWarning.value = "";
      arenaFileFound.value = false;
      if (config.value.gamePath) {
        watchedPath.value = await window.wws.startArenaWatch(config.value.gamePath);
        arenaFileFound.value = Boolean((await window.wws.getArenaState()).arenaFileFound);
      } else {
        await window.wws.stopArenaWatch();
        watchedPath.value = "";
      }
      watchedGamePath.value = config.value.gamePath;
    }
    settingsOpen.value = false;
    showSaveFeedback("success", "设置已保存");
  } catch (reason) {
    showSaveFeedback("error", `保存失败：${reason instanceof Error ? reason.message : String(reason)}`);
  } finally {
    settingsSaving.value = false;
  }
}

function showSaveFeedback(type: "success" | "error", message: string) {
  saveFeedback.value = { type, message };
  if (saveFeedbackTimer) clearTimeout(saveFeedbackTimer);
  saveFeedbackTimer = setTimeout(() => (saveFeedback.value = null), 2600);
}

async function browseGameDirectory() {
  const selected = await window.wws.chooseGameDirectory();
  if (selected) config.value.gamePath = selected;
}

async function chooseGameDirectoryFromHero() {
  const selected = await window.wws.chooseGameDirectory();
  if (!selected) return;
  config.value.gamePath = selected;
  await saveSettings();
}

async function simulate() {
  await window.wws.simulateArena();
}

function previewOverlay(visible: boolean) {
  void window.wws.setOverlayVisible(visible);
}

function hotkeyLabel(code: string) {
  if (code.startsWith("Key")) return code.slice(3);
  if (code.startsWith("Digit")) return code.slice(5);
  const labels: Record<string, string> = {
    Tab: "Tab", CapsLock: "Caps Lock", Space: "空格", Backquote: "`",
    Minus: "-", Equal: "=", BracketLeft: "[", BracketRight: "]",
    Backslash: "\\", Semicolon: ";", Quote: "'", Comma: ",", Period: ".", Slash: "/",
  };
  return labels[code] || code;
}

function captureHotkey(event: KeyboardEvent) {
  const supported = /^(Key[A-Z]|Digit[0-9]|F(?:[1-9]|1[0-2])|Tab|CapsLock|Space|Backquote|Minus|Equal|BracketLeft|BracketRight|Backslash|Semicolon|Quote|Comma|Period|Slash)$/;
  if (supported.test(event.code)) config.value.overlayHotkey = event.code;
}

onMounted(async () => {
  if (isOverlay) return;
  const [savedConfig, current, savedAuth] = await Promise.all([
    window.wws.getConfig(),
    window.wws.getArenaState(),
    window.wws.getWgAuthStatus(),
  ]);
  config.value = savedConfig;
  watchedGamePath.value = savedConfig.gamePath;
  authStatus.value = savedAuth;
  authOnboardingOpen.value = !savedAuth.authorized && localStorage.getItem("wwsmonkey.authPromptSeen") !== "1";
  arena.value = current.arena;
  roster.value = current.roster;
  watchedPath.value = current.watchedPath || "";
  arenaFileFound.value = Boolean(current.arenaFileFound);
  if (current.arena) {
    logBattle("已载入当前对局：" + current.arena.players.length + " 名玩家");
    if (current.roster.some((item) => item.status === "loading")) logBattle("正在读取公开战绩…");
  }
  cleanups = [
    window.wws.onArenaUpdate((value) => {
      const previousBattleId = arena.value?.battleId;
      arena.value = value;
      if (value) {
        if (value.battleId !== previousBattleId) activeView.value = "overlay";
        logBattle("识别对局：" + (value.mapName || "未知地图") + "，" + value.players.length + " 名玩家");
      }
    }),
    window.wws.onRosterStats((value) => {
      roster.value = value;
      if (!value.length) return;
      if (value.some((item) => item.status === "loading")) {
        logBattle("正在读取 " + value.length + " 名玩家的账号与单舰数据…");
      } else {
        const available = value.filter((item) => item.status === "ok").length;
        const hidden = value.filter((item) => item.status === "hidden").length;
        const failed = value.length - available - hidden;
        logBattle("读取完成：" + available + " 名公开、" + hidden + " 名隐藏、" + failed + " 名不可用", failed ? "error" : "success");
      }
    }),
    window.wws.onOverlayStatus((value) => {
      if (typeof value.watchedPath === "string") watchedPath.value = value.watchedPath;
      if (typeof value.arenaFileFound === "boolean") {
        arenaFileFound.value = value.arenaFileFound;
        if (value.arenaFileFound) arenaWarning.value = "";
      }
      if (value.error || value.warning) {
        arenaWarning.value = String(value.error || value.warning);
        logBattle(arenaWarning.value, "error");
      }
    }),
  ];
});
onUnmounted(() => {
  cleanups.forEach((cleanup) => cleanup());
  if (saveFeedbackTimer) clearTimeout(saveFeedbackTimer);
});
</script>

<template>
  <OverlayView v-if="isOverlay" />
  <div v-else class="app-frame">
    <TitleBar />
    <div class="app-shell">
      <aside class="sidebar">
        <div class="brand">
          <img class="brand__mark" :src="appIcon" alt="" />
          <div class="brand__copy"><strong>No. 7 insert</strong><small>WWS BATTLE ASSISTANT</small></div>
          <b>ALPHA</b>
        </div>

        <div class="nav-section nav-section--battle">
          <span class="sidebar-label">助手</span>
          <nav>
            <button class="nav-item" :class="{ 'nav-item--active': activeView === 'overlay' }" @click="openOverlay">
              <AppIcon name="overlay" /><span>七号插</span><i class="nav-live">LIVE</i>
            </button>
            <button class="nav-item" :class="{ 'nav-item--active': activeView === 'my' }" @click="openMyStats">
              <AppIcon name="user" /><span>我的战绩</span><AppIcon class="nav-chevron" name="chevron" :size="14" />
            </button>
            <button class="nav-item" :class="{ 'nav-item--active': activeView === 'snow' }" @click="openSnow">
              <AppIcon name="snow" /><span>扫雪</span><AppIcon class="nav-chevron" name="chevron" :size="14" />
            </button>
          </nav>
        </div>

        <div class="nav-section">
          <span class="sidebar-label">数据检索</span>
          <nav>
            <button class="nav-item" :class="{ 'nav-item--active': activeView === 'player' }" @click="selectMode('player')">
              <AppIcon name="user" /><span>玩家战绩</span><AppIcon class="nav-chevron" name="chevron" :size="14" />
            </button>
            <button class="nav-item" :class="{ 'nav-item--active': activeView === 'clan' }" @click="selectMode('clan')">
              <AppIcon name="clan" /><span>军团情报</span><AppIcon class="nav-chevron" name="chevron" :size="14" />
            </button>
            <button class="nav-item" :class="{ 'nav-item--active': activeView === 'containers' }" @click="openContainers">
              <AppIcon name="database" /><span>箱子查询</span><AppIcon class="nav-chevron" name="chevron" :size="14" />
            </button>
          </nav>
        </div>

        <div class="history">
          <div class="history__title"><span class="sidebar-label">最近查询</span><AppIcon name="history" :size="14" /></div>
          <button v-for="item in history.slice(0, 5)" :key="`${item.realm}-${item.accountId}`" @click="openHistory(item)">
            <i>{{ item.nickname.slice(0, 1).toUpperCase() }}</i>
            <span><strong>{{ item.nickname }}</strong><small>{{ item.realm.toUpperCase() }} · {{ item.accountId }}</small></span>
          </button>
          <div v-if="history.length === 0" class="history__empty">
            <AppIcon name="history" :size="16" />
            <p>查询记录会保存在这里</p>
          </div>
        </div>

        <div class="sidebar__footer">
          <div class="sidebar-health"><i></i><span><strong>WG API</strong><small>连接正常</small></span></div>
          <button class="settings-button" aria-label="打开设置" title="设置" @click="settingsOpen = true"><AppIcon name="settings" :size="18" /></button>
        </div>
      </aside>

      <main class="workspace">
        <header class="topbar">
          <div class="page-heading">
            <div><h1>{{ pageMeta.title }}</h1><p>{{ pageMeta.description }}</p></div>
          </div>
          <div class="topbar__tools">
            <span class="realm-label">服务器</span>
            <div class="realm-switch" aria-label="选择服务器">
              <button v-for="realm in ['asia', 'eu', 'na']" :key="realm" :class="{ active: config.realm === realm }" @click="config.realm = realm as AppConfig['realm']">
                {{ realm.toUpperCase() }}
              </button>
            </div>
          </div>
        </header>

        <div class="workspace__scroll">
          <div class="workspace__content">
            <template v-if="activeView === 'player' || activeView === 'clan'">
              <section class="command-panel panel">
                <div class="command-panel__intro">
                  <span class="section-kicker"><AppIcon :name="mode === 'player' ? 'user' : 'clan'" :size="15" />{{ mode === 'player' ? '查找玩家档案' : '查找军团档案' }}</span>
                  <h2>{{ mode === 'player' ? '输入昵称或 UID，调取公开战绩' : '输入标签或名称，查看军团阵容' }}</h2>
                  <p>{{ mode === 'player' ? '支持亚服、欧服与美服；数据来自 Wargaming 官方接口。' : '查看成员规模、管理层与完整成员列表。' }}</p>
                </div>
                <form class="search-box" @submit.prevent="runSearch">
                  <AppIcon name="search" :size="20" />
                  <input v-model="query" :placeholder="mode === 'player' ? '玩家昵称 / UID' : '军团标签 / 名称'" aria-label="查询关键词" />
                  <span class="search-box__realm">{{ config.realm.toUpperCase() }}</span>
                  <button :disabled="searching">
                    <span>{{ searching ? '正在检索' : '开始查询' }}</span><AppIcon :class="{ 'loading-spin': searching }" :name="searching ? 'pulse' : 'arrow'" :size="17" />
                  </button>
                </form>
                <div v-if="suggestions.length" class="suggestions">
                  <button v-for="match in suggestions" :key="match.account_id" @click="loadPlayer(match.account_id)">
                    <span class="suggestion-avatar">{{ match.nickname.slice(0, 1).toUpperCase() }}</span>
                    <strong>{{ match.nickname }}</strong><span>UID {{ match.account_id }}</span><AppIcon name="arrow" :size="15" />
                  </button>
                </div>
                <div v-if="clanSuggestions.length" class="suggestions">
                  <button v-for="match in clanSuggestions" :key="match.clan_id" @click="loadClan(match.clan_id)">
                    <span class="suggestion-avatar">{{ match.tag.slice(0, 1) }}</span>
                    <strong>[{{ match.tag }}] {{ match.name }}</strong><span>{{ match.members_count }} 名成员</span><AppIcon name="arrow" :size="15" />
                  </button>
                </div>
                <p v-if="error" class="error-message">{{ error }}</p>
                <div class="command-panel__meta">
                  <span><AppIcon name="shield" :size="14" />仅读取公开数据</span>
                  <span><AppIcon name="database" :size="14" />官方 API 实时查询</span>
                  <span v-if="history.length"><AppIcon name="history" :size="14" />已保存 {{ history.length }} 条历史</span>
                </div>
              </section>

              <LoadingState v-if="searching" class="panel stats-loading stats-loading--compact" :label="mode === 'player' ? '正在读取玩家随机战战绩…' : '正在读取军团资料…'" detail="正在从 WG 官方接口同步并整理数据" />

              <section v-if="!searching && mode === 'player' && player" class="result-area">
                <PerformanceOverview :player="player" />
                <ShipTable :ships="player.ships" />
              </section>

              <section v-if="!searching && mode === 'clan' && clan" class="result-area clan-result">
                <div class="panel clan-hero">
                  <div class="clan-emblem">{{ clan.tag.slice(0, 2) }}</div>
                  <div class="clan-identity">
                    <span class="eyebrow">{{ config.realm.toUpperCase() }} · CLAN ID {{ clan.clanId }}</span>
                    <h2>[{{ clan.tag }}] {{ clan.name }}</h2>
                    <p>{{ clan.description || '该军团暂无简介' }}</p>
                  </div>
                  <div class="clan-facts">
                    <article><span>成员</span><strong>{{ clan.membersCount }}</strong></article>
                    <article><span>指挥官</span><strong>{{ clan.leaderName || '—' }}</strong></article>
                    <article><span>创建者</span><strong>{{ clan.creatorName || '—' }}</strong></article>
                  </div>
                </div>
                <section class="panel clan-members">
                  <header class="panel__header"><div><span class="eyebrow">CLAN ROSTER</span><h2>军团成员</h2></div><small>点击成员即可打开战绩</small></header>
                  <div class="member-grid">
                    <button v-for="member in clan.members" :key="member.accountId" @click="openMember(member.accountId)">
                      <i>{{ member.accountName.slice(0, 1).toUpperCase() }}</i>
                      <span><strong>{{ member.accountName }}</strong><small>{{ member.role.replaceAll('_', ' ') }} · {{ member.accountId }}</small></span>
                      <AppIcon name="arrow" :size="15" />
                    </button>
                  </div>
                </section>
              </section>

              <section v-if="!searching && ((mode === 'player' && !player) || (mode === 'clan' && !clan))" class="welcome-grid">
                <article class="feature-card feature-card--wide panel">
                  <div class="feature-card__icon"><AppIcon name="pulse" :size="21" /></div>
                  <div><span class="eyebrow">STAT SNAPSHOT</span><h3>把关键数据放在第一眼</h3><p>场次、胜率、伤害、经验、击沉与存活率集中呈现，单舰数据可搜索和排序。</p></div>
                  <div class="metric-preview"><span>WR</span><strong>57.50%</strong><small>优秀</small></div>
                </article>
                <article class="feature-card panel">
                  <div class="feature-card__icon feature-card__icon--violet"><AppIcon name="database" :size="21" /></div>
                  <div><span class="eyebrow">MULTI REGION</span><h3>三大区服</h3><p>亚服、欧服、美服一键切换。</p></div>
                </article>
                <button class="feature-card feature-card--action panel" @click="openOverlay">
                  <div class="feature-card__icon feature-card__icon--orange"><AppIcon name="overlay" :size="21" /></div>
                  <div><span class="eyebrow">BATTLE OVERLAY</span><h3>进入七号插</h3><p>设置游戏路径后，自动等待下一局对局文件更新。</p></div>
                  <AppIcon name="arrow" :size="18" />
                </button>
              </section>
            </template>

            <template v-else-if="activeView === 'overlay'">
              <section class="overlay-dashboard">
                <section v-if="arena" class="panel battle-panel battle-panel--active">
                  <BattleRoster :arena="arena" :roster="roster" :logs="battleLogs" :refreshing="rosterRefreshing" embedded @refresh="refreshBattleRoster" />
                </section>

                <template v-else>
                <div class="overlay-hero panel">
                  <div class="overlay-hero__copy">
                    <span class="section-kicker"><i></i>OVERLAY READY</span>
                    <h2>战斗开始时，情报自动就位。</h2>
                    <p>设置一次游戏安装目录，程序会自动监控对局文件。新对局开始后，双方公开战绩会直接显示在本页，也可按住 {{ hotkeyLabel(config.overlayHotkey) }} 呼出游戏内透明覆盖层。</p>
                    <div class="arena-file-card" :class="{ 'arena-file-card--found': arenaFileFound }">
                      <div class="arena-file-card__status"><AppIcon name="database" :size="19" /><div><strong>{{ !config.gamePath ? '尚未设置游戏路径' : arenaFileFound ? '已找到对局文件' : '尚未找到对局文件' }}</strong><span>{{ !config.gamePath ? '请选择《战舰世界》安装目录' : arenaFileFound ? '监控已就绪，等待下一局游戏加载' : '请确认路径，或进入游戏生成对局文件' }}</span></div><i></i></div>
                      <div class="arena-file-card__path"><span>游戏路径</span><code :title="config.gamePath">{{ config.gamePath || '尚未设置' }}</code><button type="button" :disabled="settingsSaving" @click="chooseGameDirectoryFromHero">{{ config.gamePath ? '更改路径' : '设置游戏路径' }}</button></div>
                      <div v-if="arenaFileFound" class="arena-file-card__path"><span>对局文件</span><code :title="watchedPath">{{ watchedPath }}</code></div>
                      <small v-if="arenaWarning" class="arena-file-card__warning">{{ arenaWarning }}</small>
                    </div>
                    <div class="overlay-actions">
                      <div v-if="arenaFileFound" class="arena-waiting" role="status"><AppIcon name="pulse" :size="17" />等待下一局游戏加载…</div>
                      <button v-else class="button-primary" @click="simulate"><AppIcon name="pulse" :size="17" />载入模拟对局</button>
                      <button class="button-secondary" @mousedown="previewOverlay(true)" @mouseup="previewOverlay(false)" @mouseleave="previewOverlay(false)"><AppIcon name="eye" :size="17" />按住预览</button>
                    </div>
                  </div>
                  <div class="key-visual">
                    <span>HOLD TO VIEW</span>
                    <strong>{{ hotkeyLabel(config.overlayHotkey).toUpperCase() }}</strong>
                    <small>释放后自动隐藏</small>
                  </div>
                </div>

                <section class="panel privacy-note">
                  <AppIcon name="shield" :size="20" /><div><strong>只读、透明、随时可关</strong><span>软件只读取本地战斗阵容文件和 WG 官方公开数据，不修改游戏文件。</span></div>
                </section>
                </template>
              </section>
            </template>
            <ContainerView v-else-if="activeView === 'containers'" :realm="config.realm" />
            <MyStatsView v-else-if="activeView === 'my'" :auth-status="authStatus" :realm="config.realm" @authorized="handleAuthorized" />
            <SnowflakeView v-else :realm="config.realm" :auth-status="authStatus" @auth-changed="handleAuthorized" />
          </div>
        </div>
      </main>
    </div>

    <div v-if="settingsOpen" class="modal-backdrop" @click.self="settingsOpen = false">
      <section class="settings-modal">
        <header><div><span class="eyebrow">APPLICATION SETTINGS</span><h2>设置</h2></div><button aria-label="关闭设置" @click="settingsOpen = false"><AppIcon name="close" :size="18" /></button></header>
        <label><span>界面主题</span><div class="theme-choice" aria-label="选择界面主题"><button :class="{ active: config.theme === 'dark' }" @click="config.theme = 'dark'">黑色</button><button :class="{ active: config.theme === 'light' }" @click="config.theme = 'light'">白色</button></div></label>
        <label><span>游戏安装文件夹</span><div class="path-field"><input v-model="config.gamePath" placeholder="请选择《战舰世界》的安装目录" /><button @click="browseGameDirectory">选择目录</button></div></label>
        <label class="toggle"><input v-model="config.overlayEnabled" type="checkbox" /><span></span><b>启用游戏内透明覆盖层</b></label>
        <label><span>七号插呼出按键</span><button class="hotkey-input" @keydown.stop.prevent="captureHotkey">{{ hotkeyLabel(config.overlayHotkey) }}<small>点击后按下新按键</small></button></label>
        <div class="settings-guide">
          <strong>对局监控说明</strong>
          <ol>
            <li>可选择游戏根目录、<code>replays</code> 文件夹或其上级启动器目录。</li>
            <li>程序会向下查找并监控实际的 <code>replays\tempArenaInfo.json</code>。</li>
            <li>该文件是开局阵容快照；尚未生成时，请先进入一场战斗。</li>
          </ol>
        </div>
        <footer><button class="button-secondary" :disabled="settingsSaving" @click="settingsOpen = false">取消</button><button class="button-primary" :disabled="settingsSaving" @click="saveSettings">{{ settingsSaving ? '保存中…' : '保存设置' }}</button></footer>
      </section>
    </div>

    <div v-if="authOnboardingOpen" class="modal-backdrop auth-onboarding-backdrop">
      <WgAuthGate :realm="config.realm" onboarding @authorized="handleAuthorized" @skip="skipAuthOnboarding" />
    </div>

    <Transition name="save-toast">
      <div v-if="saveFeedback" class="save-feedback" :class="`save-feedback--${saveFeedback.type}`" role="status">
        <AppIcon :name="saveFeedback.type === 'success' ? 'shield' : 'close'" :size="18" />
        <span><strong>{{ saveFeedback.type === 'success' ? '保存成功' : '保存失败' }}</strong><small>{{ saveFeedback.message }}</small></span>
      </div>
    </Transition>
  </div>
</template>
