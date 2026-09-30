<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import AppIcon from "./components/AppIcon.vue";
import BattleRoster from "./components/BattleRoster.vue";
import ContainerView from "./components/ContainerView.vue";
import NewsView from "./components/NewsView.vue";
import ChristmasPoolView from "./components/ChristmasPoolView.vue";
import PlayerStatsPanel from "./components/PlayerStatsPanel.vue";
import LoadingState from "./components/LoadingState.vue";
import MyStatsView from "./components/MyStatsView.vue";
import SnowflakeView from "./components/SnowflakeView.vue";
import SearchControl from "./components/SearchControl.vue";
import TitleBar from "./components/TitleBar.vue";
import WgAuthGate from "./components/WgAuthGate.vue";
import type { AppConfig, ArenaInfo, ClanDetails, ClanSearchResult, DownloadedUpdate, PlayerDetails, RosterPlayer, SearchResult, UpdateCheckResult, UpdateProgress, WgAuthStatus } from "./types";

const config = ref<AppConfig>({ realm: "asia", theme: "dark", gamePath: "", overlayEnabled: true, overlayHotkeyEnabled: true, overlayHotkey: "Tab" });
const mode = ref<"player" | "clan">("player");
const activeView = ref<"player" | "clan" | "containers" | "christmas" | "overlay" | "my" | "snow" | "news">("overlay");
const statsPage = ref<"overview" | "ships">("overview");
watch(activeView, () => { statsPage.value = "overview"; });
const authStatus = ref<WgAuthStatus>({ authorized: false });
const snowEventName = ref("");
const authOnboardingOpen = ref(false);
const query = ref("");
const searching = ref(false);
const suggestions = ref<SearchResult[]>([]);
const clanSuggestions = ref<ClanSearchResult[]>([]);
const player = ref<PlayerDetails | null>(null);
const clan = ref<ClanDetails | null>(null);
const clanDescriptionExpanded = ref(false);
const error = ref("");
const settingsOpen = ref(false);
const settingsSaving = ref(false);
const updateBusy = ref<"" | "checking" | "downloading" | "installing">("");
const updateResult = ref<UpdateCheckResult | null>(null);
const downloadedUpdate = ref<DownloadedUpdate | null>(null);
const updateProgress = ref<UpdateProgress | null>(null);
const updateError = ref("");
const saveFeedback = ref<{ type: "success" | "error"; message: string } | null>(null);
const arena = ref<ArenaInfo | null>(null);
const roster = ref<RosterPlayer[]>([]);
const watchedPath = ref("");
const watchedGamePath = ref("");
const arenaFileFound = ref(false);
const arenaWarning = ref("");
const battleLogs = ref<Array<{ time: string; message: string; tone?: string }>>([]);
const battleLogOpen = ref(false);
const latestBattleLog = computed(() => battleLogs.value.at(-1));
const rosterRefreshing = ref(false);
const capturingHotkey = ref(false);

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

let cleanups: Array<() => void> = [];
let rosterLoadingLogged = false;
let saveFeedbackTimer: ReturnType<typeof setTimeout> | null = null;
type QueryHistoryEntry = { kind: "player" | "clan"; realm: AppConfig["realm"]; id: number; label: string; queriedAt: number };
const HISTORY_KEY = "wwsmonkey.queryHistory.v1";
function readQueryHistory(): QueryHistoryEntry[] {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
    if (!Array.isArray(saved)) return [];
    return saved.filter((entry): entry is QueryHistoryEntry =>
      Boolean(entry) && (entry.kind === "player" || entry.kind === "clan") &&
      ["asia", "eu", "na"].includes(entry.realm) &&
      Number.isSafeInteger(entry.id) && entry.id > 0 &&
      typeof entry.label === "string" && entry.label.length > 0 &&
      Number.isFinite(entry.queriedAt)
    ).slice(0, 30);
  } catch { return []; }
}
const queryHistory = ref<QueryHistoryEntry[]>(readQueryHistory());
const visibleHistory = computed(() => queryHistory.value.filter(entry => entry.kind === mode.value));
const historyTime = (timestamp: number) => new Date(timestamp).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false });
function rememberQuery(entry: QueryHistoryEntry) {
  queryHistory.value = [entry, ...queryHistory.value.filter(old => old.kind !== entry.kind || old.realm !== entry.realm || old.id !== entry.id)].slice(0, 30);
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(queryHistory.value)); } catch { /* History still works until the app closes. */ }
}
function showQueryHistory() {
  if (mode.value === "player") player.value = null;
  else clan.value = null;
  query.value = "";
  error.value = "";
  suggestions.value = [];
  clanSuggestions.value = [];
}
function openHistory(entry: QueryHistoryEntry) {
  selectMode(entry.kind);
  config.value.realm = entry.realm;
  if (entry.kind === "player") void loadPlayer(entry.id);
  else void loadClan(entry.id);
}
const hasSearchResult = computed(() => mode.value === "player" ? Boolean(player.value) : Boolean(clan.value));

const pageMeta = computed(() => {
  if (activeView.value === "news") return { eyebrow: "OFFICIAL NEWS", title: "公告中心", description: "舰船调整与大版本更新 · 官方资讯中文导读" };
  if (activeView.value === "clan") return { eyebrow: "CLAN INTELLIGENCE", title: "军团情报", description: "检索军团档案与完整成员名单" };
  if (activeView.value === "containers") return { eyebrow: "CONTAINER INTELLIGENCE", title: "箱子查询", description: "检索官网公布的补给箱奖励和掉落概率" };
  if (activeView.value === "christmas") return { eyebrow: "SANTA SHIP POOL", title: "圣诞船池", description: "核对最近一期圣诞补给箱舰船与当前港口拥有情况" };
  if (activeView.value === "overlay") return { eyebrow: "BATTLE ASSISTANT", title: "七号插", description: config.value.overlayHotkeyEnabled ? `自动加载当前对局，按住 ${hotkeyLabel(config.value.overlayHotkey)} 可在游戏中呼出` : "自动加载当前对局，按键呼出已关闭" };
  if (activeView.value === "my") return { eyebrow: "PERSONAL PERFORMANCE", title: "我的战绩", description: "仅展示当前授权账号的总体战绩、排位记录和舰船水平" };
  if (activeView.value === "snow") return { eyebrow: "FESTIVE REWARDS", title: snowEventName.value ? `扫雪 - ${snowEventName.value}` : "扫雪", description: "算算你能获得什么！" };
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
    const realm = config.value.realm;
    clanDescriptionExpanded.value = false;
    clan.value = await window.wws.clanDetails(clanId, realm);
    query.value = clan.value.tag;
    rememberQuery({ kind: "clan", realm, id: clanId, label: `[${clan.value.tag}] ${clan.value.name}`, queriedAt: Date.now() });
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

function openChristmas() {
  activeView.value = "christmas";
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
function openRosterPlayer(target: RosterPlayer) {
  selectMode("player");
  player.value = null;
  if (Number.isSafeInteger(target.accountId) && Number(target.accountId) > 0) {
    void loadPlayer(target.accountId!);
  } else {
    query.value = target.name;
    void runSearch();
  }
}

async function loadPlayer(accountId: number) {
  searching.value = true;
  error.value = "";
  try {
    const realm = config.value.realm;
    player.value = await window.wws.playerDetails(accountId, realm);
    query.value = player.value.nickname;
    rememberQuery({ kind: "player", realm, id: accountId, label: player.value.nickname, queriedAt: Date.now() });
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
      overlayHotkeyEnabled: config.value.overlayHotkeyEnabled,
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

async function checkUpdates() {
  updateBusy.value = "checking";
  updateError.value = "";
  downloadedUpdate.value = null;
  updateProgress.value = null;
  try {
    updateResult.value = await window.wws.checkForUpdate();
  } catch (reason) {
    updateResult.value = null;
    updateError.value = reason instanceof Error ? reason.message : String(reason);
  } finally {
    updateBusy.value = "";
  }
}

async function downloadAvailableUpdate() {
  updateBusy.value = "downloading";
  updateError.value = "";
  updateProgress.value = null;
  try {
    downloadedUpdate.value = await window.wws.downloadUpdate();
  } catch (reason) {
    updateError.value = reason instanceof Error ? reason.message : String(reason);
  } finally {
    updateBusy.value = "";
  }
}

async function installAvailableUpdate() {
  updateBusy.value = "installing";
  updateError.value = "";
  try {
    await window.wws.installUpdate();
  } catch (reason) {
    updateError.value = reason instanceof Error ? reason.message : String(reason);
    updateBusy.value = "";
  }
}

async function showDownloadedUpdate() {
  try { await window.wws.showUpdateFile(); }
  catch (reason) { updateError.value = reason instanceof Error ? reason.message : String(reason); }
}

async function openUpdateRelease() {
  try { await window.wws.openUpdateRelease(); }
  catch (reason) { updateError.value = reason instanceof Error ? reason.message : String(reason); }
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

async function captureHotkey(event: KeyboardEvent, persist = false) {
  if (event.code === "Escape") { capturingHotkey.value = false; return; }
  const supported = /^(Key[A-Z]|Digit[0-9]|F(?:[1-9]|1[0-2])|Tab|CapsLock|Space|Backquote|Minus|Equal|BracketLeft|BracketRight|Backslash|Semicolon|Quote|Comma|Period|Slash)$/;
  if (!supported.test(event.code)) return;
  const previous = config.value.overlayHotkey;
  config.value.overlayHotkey = event.code;
  capturingHotkey.value = false;
  if (!persist) return;
  try {
    config.value = await window.wws.saveConfig({ ...config.value });
    showSaveFeedback("success", `呼出按键已设为 ${hotkeyLabel(event.code)}`);
  } catch (reason) {
    config.value.overlayHotkey = previous;
    showSaveFeedback("error", `按键保存失败：${reason instanceof Error ? reason.message : String(reason)}`);
  }
}

onMounted(async () => {
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
        if (value.battleId !== previousBattleId) {
          activeView.value = "overlay";
          rosterLoadingLogged = false;
        }
        logBattle("识别对局：" + (value.mapName || "未知地图") + "，" + value.players.length + " 名玩家");
      } else {
        battleLogOpen.value = false;
        rosterLoadingLogged = false;
      }
    }),
    window.wws.onRosterStats((value) => {
      roster.value = value;
      if (!value.length) { rosterLoadingLogged = false; return; }
      if (value.some((item) => item.status === "loading")) {
        if (!rosterLoadingLogged) {
          logBattle("正在读取 " + value.length + " 名玩家的账号与单舰数据…");
          rosterLoadingLogged = true;
        }
      } else {
        rosterLoadingLogged = false;
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
    window.wws.onUpdateProgress((progress) => { updateProgress.value = progress; }),
  ];
});
onUnmounted(() => {
  cleanups.forEach((cleanup) => cleanup());
  if (saveFeedbackTimer) clearTimeout(saveFeedbackTimer);
});
</script>

<template>
  <div class="app-frame">
    <TitleBar />
    <div class="app-shell">
      <aside class="sidebar">
        <div class="nav-section nav-section--battle">
          <span class="sidebar-label">助手</span>
          <nav>
            <button class="nav-item" :class="{ 'nav-item--active': activeView === 'overlay' }" @click="openOverlay">
              <AppIcon name="overlay" /><span>七号插</span><i class="nav-live">LIVE</i>
            </button>
            <button class="nav-item" :class="{ 'nav-item--active': activeView === 'news' }" @click="activeView = 'news'"><AppIcon name="overlay" :size="18" /><span>公告中心</span><AppIcon name="chevron" :size="13" /></button>
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
            <button class="nav-item" :class="{ 'nav-item--active': activeView === 'christmas' }" @click="openChristmas">
              <AppIcon name="gift" /><span>圣诞船池</span><AppIcon class="nav-chevron" name="chevron" :size="14" />
            </button>
          </nav>
        </div>

        <div class="sidebar__footer">
          <div class="sidebar-health"><i></i><span><strong>WG API</strong><small>连接正常</small></span></div>
          <button class="settings-button" aria-label="打开设置" title="设置" @click="settingsOpen = true"><AppIcon name="settings" :size="18" /></button>
        </div>
      </aside>

      <main class="workspace">
        <header class="topbar">
          <div class="page-heading">
            <div><div class="page-heading__title"><h1>{{ pageMeta.title }}</h1><div v-if="activeView === 'my' || activeView === 'player'" class="stats-page-tabs" role="tablist" aria-label="战绩页面"><button id="stats-tab-overview" type="button" role="tab" :aria-selected="statsPage === 'overview'" aria-controls="stats-page-overview" :class="{ active: statsPage === 'overview' }" @click="statsPage = 'overview'">总览</button><button id="stats-tab-ships" type="button" role="tab" :aria-selected="statsPage === 'ships'" aria-controls="stats-page-ships" :class="{ active: statsPage === 'ships' }" @click="statsPage = 'ships'">详细</button></div></div><p>{{ pageMeta.description }}</p></div>
          </div>
          <div v-if="activeView === 'overlay' && arena" class="battle-topbar">
            <div class="battle-topbar__log">
              <button type="button" class="battle-topbar__toggle" :aria-expanded="battleLogOpen" aria-controls="battle-topbar-history" @click="battleLogOpen = !battleLogOpen">
                <AppIcon name="pulse" :size="16" /><span>读取日志</span><small aria-live="polite">{{ latestBattleLog?.message || '等待对局数据' }}</small>
              </button>
              <div v-show="battleLogOpen" id="battle-topbar-history" class="battle-topbar__history" role="log" aria-label="对局读取日志">
                <div v-for="(entry, index) in [...battleLogs].reverse()" :key="index"><time>{{ entry.time }}</time><span :class="entry.tone">{{ entry.message }}</span></div>
                <div v-if="!battleLogs.length"><time>—</time><span>等待对局数据</span></div>
              </div>
            </div>
            <button type="button" class="battle-topbar__refresh button-secondary" :disabled="rosterRefreshing" @click="refreshBattleRoster"><span v-if="rosterRefreshing" class="ui-spinner" aria-hidden="true"></span>{{ rosterRefreshing ? '刷新中…' : '刷新数据' }}</button>
          </div>
          <div v-if="activeView !== 'news'" class="topbar__tools">
            <span class="realm-label">服务器</span>
            <div class="realm-switch" aria-label="选择服务器">
              <button v-for="realm in ['asia', 'eu', 'na']" :key="realm" :class="{ active: config.realm === realm }" @click="config.realm = realm as AppConfig['realm']">
                {{ realm.toUpperCase() }}
              </button>
            </div>
          </div>
        </header>

        <div class="workspace__scroll">
          <div :key="activeView" class="workspace__content">
            <template v-if="activeView === 'player' || activeView === 'clan'">
              <section v-if="!hasSearchResult" class="command-panel panel">
                <div class="command-panel__intro">
                  <span class="section-kicker"><AppIcon :name="mode === 'player' ? 'user' : 'clan'" :size="15" />{{ mode === 'player' ? '查找玩家档案' : '查找军团档案' }}</span>
                  <h2>{{ mode === 'player' ? '输入昵称或 UID，调取公开战绩' : '输入标签或名称，查看军团阵容' }}</h2>
                  <p>{{ mode === 'player' ? '支持亚服、欧服与美服；数据来自 Wargaming 官方接口。' : '查看成员规模、管理层与完整成员列表。' }}</p>
                </div>
                <SearchControl v-model="query" :mode="mode" :realm="config.realm" :searching="searching" :suggestions="suggestions" :clan-suggestions="clanSuggestions" :error="error" @submit="runSearch" @select-player="loadPlayer" @select-clan="loadClan" />
                <div class="command-panel__meta">
                  <span><AppIcon name="shield" :size="14" />仅读取公开数据</span>
                  <span><AppIcon name="database" :size="14" />官方 API 实时查询</span>
                </div>
              </section>

              <LoadingState v-if="searching && !hasSearchResult" class="panel stats-loading stats-loading--compact" :label="mode === 'player' ? '正在读取玩家随机战战绩…' : '正在读取军团资料…'" detail="正在从 WG 官方接口同步并整理数据" />

              <PlayerStatsPanel v-if="mode === 'player' && player" v-model:page="statsPage" :player="player" markable>
                <template #tools><button class="button-secondary query-history__back" @click="showQueryHistory">查询历史</button><SearchControl v-model="query" compact :mode="mode" :realm="config.realm" :searching="searching" :suggestions="suggestions" :clan-suggestions="clanSuggestions" :error="error" @submit="runSearch" @select-player="loadPlayer" @select-clan="loadClan" /></template>
              </PlayerStatsPanel>

              <section v-if="mode === 'clan' && clan" class="result-area clan-result">
                <div class="panel clan-hero">
                  <div class="clan-hero__head">
                    <div class="clan-emblem">{{ clan.tag.slice(0, 2) }}</div>
                    <div class="clan-identity">
                      <span class="eyebrow">{{ config.realm.toUpperCase() }} · CLAN ID {{ clan.clanId }}</span>
                      <h2>[{{ clan.tag }}] {{ clan.name }}</h2>
                      <small>公开成员随机战绩汇总 · {{ clan.overall?.publicMembers || 0 }}/{{ clan.membersCount }} 名成员可统计</small>
                    </div>
                    <div class="clan-hero__search"><SearchControl v-model="query" compact :mode="mode" :realm="config.realm" :searching="searching" :suggestions="suggestions" :clan-suggestions="clanSuggestions" :error="error" @submit="runSearch" @select-player="loadPlayer" @select-clan="loadClan" /><button class="button-secondary query-history__back" @click="showQueryHistory">查询历史</button></div>
                  </div>
                  <div class="clan-summary-grid">
                    <article><span>成员人数</span><strong>{{ clan.membersCount }}</strong><small>{{ clan.overall?.publicMembers || 0 }} 名公开战绩</small></article>
                    <article><span>总体胜率</span><strong>{{ clan.overall ? clan.overall.winRate.toFixed(1) + '%' : '—' }}</strong><small>按公开随机战场次汇总</small></article>
                    <article><span>场均经验</span><strong>{{ clan.overall ? Math.round(clan.overall.avgXp).toLocaleString() : '—' }}</strong><small>累计经验 {{ clan.overall ? Math.round(clan.overall.totalXp).toLocaleString() : '—' }}</small></article>
                    <article><span>场均伤害</span><strong>{{ clan.overall ? Math.round(clan.overall.avgDamage).toLocaleString() : '—' }}</strong><small>{{ clan.overall ? clan.overall.battles.toLocaleString() : '0' }} 场公开随机战</small></article>
                  </div>
                  <div class="clan-hero__details">
                    <div class="clan-description">
                      <div class="clan-description__heading"><strong>军团简介</strong><button v-if="clan.description.length > 120" type="button" @click="clanDescriptionExpanded = !clanDescriptionExpanded">{{ clanDescriptionExpanded ? '收起' : '展开全文' }}</button></div>
                      <p :class="{ 'is-expanded': clanDescriptionExpanded }">{{ clan.description || '该军团暂无简介' }}</p>
                    </div>
                    <div class="clan-people"><span>指挥官 <strong>{{ clan.leaderName || '—' }}</strong></span><span>创建者 <strong>{{ clan.creatorName || '—' }}</strong></span></div>
                  </div>
                </div>
                <section class="panel clan-members">
                  <header class="panel__header"><div><span class="eyebrow">CLAN ROSTER</span><h2>军团成员</h2></div><small>点击成员即可打开战绩</small></header>
                  <div class="member-grid">
                    <button v-for="member in clan.members" :key="member.accountId" type="button" @click="openMember(member.accountId)">
                      <i>{{ member.accountName.slice(0, 1).toUpperCase() }}</i>
                      <span class="member-identity"><strong>{{ member.accountName }}</strong><small>{{ member.role.replaceAll('_', ' ') }} · {{ member.accountId }}<em v-if="member.statsStatus !== 'ok'"> · {{ member.statsStatus === 'hidden' ? '隐藏战绩' : '战绩暂不可用' }}</em></small></span>
                      <span class="member-metrics">
                        <span class="member-stat"><small>胜率</small><strong>{{ member.overall ? member.overall.winRate.toFixed(1) + '%' : '—' }}</strong></span>
                        <span class="member-stat"><small>场均伤害</small><strong>{{ member.overall ? Math.round(member.overall.avgDamage).toLocaleString() : '—' }}</strong></span>
                        <span class="member-stat"><small>场均经验</small><strong>{{ member.overall ? Math.round(member.overall.avgXp).toLocaleString() : '—' }}</strong></span>
                      </span>
                      <AppIcon name="arrow" :size="16" />
                    </button>
                  </div>
                </section>
              </section>

              <section v-if="!searching && !hasSearchResult" class="welcome-grid">
                <section class="feature-card feature-card--wide panel query-history">
                  <header class="query-history__header">
                    <div class="feature-card__icon"><AppIcon name="pulse" :size="21" /></div>
                    <div><span class="eyebrow">RECENT SEARCHES</span><h3>查询历史记录</h3><p>点击记录可重新查询当前公开数据。</p></div>
                    <span class="query-history__count">{{ visibleHistory.length }} 条记录</span>
                  </header>
                  <div v-if="visibleHistory.length" class="query-history__list">
                    <button v-for="entry in visibleHistory" :key="`${entry.kind}-${entry.realm}-${entry.id}`" type="button" @click="openHistory(entry)">
                      <span class="query-history__avatar">{{ entry.label.slice(0, 1).toUpperCase() }}</span>
                      <span class="query-history__name"><strong>{{ entry.label }}</strong><small>{{ entry.realm.toUpperCase() }} · {{ historyTime(entry.queriedAt) }}</small></span>
                      <AppIcon name="arrow" :size="16" />
                    </button>
                  </div>
                  <p v-else class="query-history__empty">{{ mode === 'player' ? '暂无玩家查询记录；成功查询后会显示在这里。' : '暂无军团查询记录；成功查询后会显示在这里。' }}</p>
                </section>
                <article class="feature-card panel">
                  <div class="feature-card__icon feature-card__icon--violet"><AppIcon name="database" :size="21" /></div>
                  <div><span class="eyebrow">MULTI REGION</span><h3>三大区服</h3><p>亚服、欧服、美服一键切换。</p></div>
                </article>
                <button class="feature-card feature-card--action panel" @click="openOverlay">
                  <div class="feature-card__icon feature-card__icon--orange"><AppIcon name="overlay" :size="21" /></div>
                  <div><span class="eyebrow">BATTLE OVERLAY</span><h3>进入七号插</h3><p>设置游戏路径后，自动查找最新的对局文件。</p></div>
                  <AppIcon name="arrow" :size="18" />
                </button>
              </section>
            </template>

            <template v-else-if="activeView === 'overlay'">
              <section class="overlay-dashboard">
                <section v-if="arena" class="panel battle-panel battle-panel--active">
                  <BattleRoster :arena="arena" :roster="roster" :realm="config.realm" embedded @open-player="openRosterPlayer" />
                </section>

                <template v-else>
                <div class="overlay-hero panel">
                  <div class="overlay-hero__copy">
                    <span class="section-kicker"><i></i>OVERLAY READY</span>
                    <h2>战斗开始时，情报自动就位。</h2>
                    <p>设置一次游戏安装目录，程序会自动监控对局文件。新对局开始后，双方公开战绩会直接显示在本页。{{ config.overlayHotkeyEnabled ? `按住 ${hotkeyLabel(config.overlayHotkey)} 可呼出游戏内透明覆盖层。` : '按键呼出已在设置中关闭。' }}</p>
                    <div class="arena-file-card" :class="{ 'arena-file-card--found': arenaFileFound }">
                      <div class="arena-file-card__status"><AppIcon name="database" :size="19" /><div><strong>{{ !config.gamePath ? '尚未设置游戏路径' : arenaFileFound ? '已找到对局文件' : '等待进入战斗' }}</strong><span>{{ !config.gamePath ? '请选择《战舰世界》安装目录' : arenaFileFound ? '监控已就绪，等待对局文件更新' : '战斗开始后自动查找 replays 及其子目录；若无响应，请确认游戏路径' }}</span></div><i></i></div>
                      <div class="arena-file-card__path"><span>游戏路径</span><code :title="config.gamePath">{{ config.gamePath || '尚未设置' }}</code><button type="button" :disabled="settingsSaving" @click="chooseGameDirectoryFromHero">{{ config.gamePath ? '更改路径' : '设置游戏路径' }}</button></div>
                      <div v-if="arenaFileFound" class="arena-file-card__path"><span>对局文件</span><code :title="watchedPath">{{ watchedPath }}</code></div>
                      <small v-if="arenaWarning" class="arena-file-card__warning">{{ arenaWarning }}</small>
                    </div>
                    <div class="overlay-actions">
                      <div v-if="arenaFileFound" class="arena-waiting" role="status"><AppIcon name="pulse" :size="17" />等待对局文件更新…</div>
                      <button v-else class="button-primary" @click="simulate"><AppIcon name="pulse" :size="17" />载入模拟对局</button>
                    </div>
                  </div>
                  <button type="button" class="key-visual key-visual--editable" :class="{ 'key-visual--disabled': !config.overlayHotkeyEnabled }" aria-label="修改游戏内战绩面板呼出按键" @click="capturingHotkey = true" @keydown.stop.prevent="captureHotkey($event, true)" @blur="capturingHotkey = false">
                    <span>{{ capturingHotkey ? 'PRESS A KEY' : config.overlayHotkeyEnabled ? 'HOLD TO VIEW' : 'HOTKEY OFF' }}</span>
                    <strong>{{ capturingHotkey ? '…' : hotkeyLabel(config.overlayHotkey).toUpperCase() }}</strong>
                    <small>{{ capturingHotkey ? '按下新按键，Esc 取消' : '点击修改呼出按键' }}</small>
                  </button>
                </div>

                <section class="panel privacy-note">
                  <AppIcon name="shield" :size="20" /><div><strong>只读、透明、随时可关</strong><span>软件只读取本地战斗阵容文件和 WG 官方公开数据，不修改游戏文件。</span></div>
                </section>
                </template>
              </section>
            </template>
            <NewsView v-else-if="activeView === 'news'" />
            <ContainerView v-else-if="activeView === 'containers'" :realm="config.realm" :auth-status="authStatus" />
            <ChristmasPoolView v-else-if="activeView === 'christmas'" :realm="config.realm" :auth-status="authStatus" @authorized="handleAuthorized" />
            <MyStatsView v-else-if="activeView === 'my'" v-model:page="statsPage" :auth-status="authStatus" :realm="config.realm" @authorized="handleAuthorized" />
            <SnowflakeView v-else :realm="config.realm" :auth-status="authStatus" @auth-changed="handleAuthorized" @event-name="snowEventName = $event" />
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
        <label class="toggle"><input v-model="config.overlayHotkeyEnabled" type="checkbox" /><span></span><b>启用按键呼出战绩面板</b></label>
        <label><span>七号插呼出按键</span><button class="hotkey-input" @keydown.stop.prevent="captureHotkey">{{ hotkeyLabel(config.overlayHotkey) }}<small>点击后按下新按键</small></button></label>
        <div class="settings-update">
          <div class="settings-update__top"><div><strong>程序更新</strong><small>从 GitHub 正式发布版本检查</small></div><button type="button" :disabled="Boolean(updateBusy)" @click="checkUpdates">{{ updateBusy === 'checking' ? '检查中…' : '检查更新' }}</button></div>
          <p v-if="updateResult" role="status">当前 {{ updateResult.currentVersion }} · {{ updateResult.updateAvailable ? `发现新版本 ${updateResult.latestVersion}` : updateResult.currentVersion === updateResult.latestVersion ? '已是最新版本' : `本机版本较新（GitHub 已发布 ${updateResult.latestVersion}）` }}</p>
          <p v-if="updateResult?.updateAvailable && !updateResult.asset">新版本尚无可下载的 Windows 程序，请查看发布页。</p>
          <div v-if="updateResult?.updateAvailable" class="settings-update__actions">
            <button v-if="updateResult.asset && !downloadedUpdate" type="button" :disabled="Boolean(updateBusy)" @click="downloadAvailableUpdate">{{ updateBusy === 'downloading' ? (updateProgress?.received ? '下载中 ' + (updateProgress.percent === null ? Math.round(updateProgress.received / 1024 / 1024) + ' MB' : updateProgress.percent + '%') : '正在连接…') : '下载更新' }}</button>
            <button v-if="downloadedUpdate" type="button" @click="showDownloadedUpdate">打开下载位置</button>
            <button v-if="downloadedUpdate?.installer && downloadedUpdate.verified" type="button" :disabled="Boolean(updateBusy)" @click="installAvailableUpdate">安装更新</button>
            <button type="button" @click="openUpdateRelease">查看发布页</button>
          </div>
          <progress v-if="updateBusy === 'downloading' && updateProgress && updateProgress.percent !== null" :value="updateProgress.percent" max="100" />
          <p v-if="downloadedUpdate" class="settings-update__hint">{{ downloadedUpdate.installer && downloadedUpdate.verified ? '下载完成并通过校验；安装时程序会关闭。' : '下载完成，请从下载位置手动更新。' }}</p>
          <p v-if="updateError" class="settings-update__error" role="alert">{{ updateError }}</p>
        </div>
        <div class="settings-guide">
          <strong>对局监控说明</strong>
          <ol>
            <li>可选择游戏根目录、<code>replays</code> 文件夹或其上级启动器目录。</li>
            <li>程序会递归查找 <code>replays</code> 及其子目录中的 <code>tempArenaInfo.json</code>，优先选择最近写入的文件。</li>
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
