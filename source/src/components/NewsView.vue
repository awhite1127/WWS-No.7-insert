<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref } from "vue";
import AppIcon from "./AppIcon.vue";
import LoadingState from "./LoadingState.vue";
import type { NewsFeed, NewsItem } from "../types";
const feed = ref<NewsFeed>({ items: [], sources: [] });
const category = ref<"ships" | "events">("ships");
const query = ref("");
const loading = ref(false);
const error = ref("");
const opening = ref("");
const selected = ref<NewsItem | null>(null);
const detailDialog = ref<HTMLDialogElement | null>(null);
const pendingDetails = ref(new Set<string>());
const detailError = ref<Record<string, string>>({});
const details = ref<Record<string, string[]>>({});
const items = computed(() => feed.value.items.filter(i => i.category === category.value && `${i.title} ${i.summary} ${i.originalTitle}`.toLocaleLowerCase().includes(query.value.trim().toLocaleLowerCase())));
const source = computed(() => feed.value.sources.find(s => s.category === category.value));
const count = (value: string) => feed.value.items.filter(i => i.category === value).length;
const date = (value: number) => new Date(value).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false });
function readableDetails(lines: string[], category: NewsItem["category"]) {
  if (category !== "events") return lines;
  return lines.flatMap((line) => {
    const sentences = line.trim().replace(/([。！？；!?])\s*/gu, "$1\n").replace(/\.\s+(?=[A-Z])/gu, ".\n").split("\n").filter(Boolean);
    const paragraphs: string[] = [];
    let paragraph = "";
    for (const sentence of sentences) {
      const clauses = sentence.length > 160 ? sentence.replace(/([，、,])\s*/gu, "$1\n").split("\n").filter(Boolean) : [sentence];
      for (const clause of clauses) {
        if (paragraph && paragraph.length + clause.length > 130) {
          paragraphs.push(paragraph);
          paragraph = "";
        }
        if (clause.length > 160) {
          for (let index = 0; index < clause.length; index += 130) paragraphs.push(clause.slice(index, index + 130));
        } else paragraph += clause;
      }
    }
    if (paragraph) paragraphs.push(paragraph);
    return paragraphs;
  });
}
let disposed = false;
async function load() {
  if (loading.value) return;
  loading.value = true; error.value = "";
  try { const result = await window.wws.getNews(); if (!disposed) feed.value = result; }
  catch { if (!disposed) error.value = "公告读取失败，请稍后重试。"; }
  finally { if (!disposed) loading.value = false; }
}
async function open(url: string) {
  opening.value = url;
  try { await window.wws.openNewsSource(url); }
  catch { error.value = "无法打开原文链接，请稍后重试。"; }
  finally { opening.value = ""; }
}
function closeDetail() {
  detailDialog.value?.close();
  selected.value = null;
}
function closeOnBackdrop(event: MouseEvent) {
  if (event.target !== detailDialog.value) return;
  const box = detailDialog.value!.getBoundingClientRect();
  if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) closeDetail();
}
async function loadDetail(item: NewsItem) {
  if (details.value[item.id] || pendingDetails.value.has(item.id)) return;
  pendingDetails.value.add(item.id);
  detailError.value[item.id] = "";
  try {
    const result = await window.wws.getNewsDetail(item.url);
    if (!disposed) details.value[item.id] = result;
  } catch {
    if (!disposed) detailError.value[item.id] = "公告详情读取失败，请稍后重试或查看官网原文。";
  } finally {
    pendingDetails.value.delete(item.id);
  }
}
async function showDetail(item: NewsItem) {
  selected.value = item;
  await nextTick();
  if (disposed || !detailDialog.value) return;
  if (!detailDialog.value.open) detailDialog.value.showModal();
  void loadDetail(item);
}
onMounted(() => { void load(); });
onUnmounted(() => { disposed = true; });
</script>

<template>
  <section class="news-page">
    <header class="news-hero panel">
      <div class="news-hero__main">
        <span class="section-kicker">WORLD OF WARSHIPS · OFFICIAL INTELLIGENCE</span>
        <h2>舰队公告</h2>
        <p>掌握舰船调整与大版本更新。</p>
        <div class="news-tabs" role="tablist" aria-label="公告分类">
          <button role="tab" :aria-selected="category === 'ships'" :class="{ active: category === 'ships' }" @click="category = 'ships'"><AppIcon name="ship" :size="18" />舰船调整 <b>{{ count('ships') }}</b></button>
          <button role="tab" :aria-selected="category === 'events'" :class="{ active: category === 'events' }" @click="category = 'events'"><AppIcon name="overlay" :size="18" />版本更新 <b>{{ count('events') }}</b></button>
        </div>
      </div>
      <div class="news-sync"><span><i></i>每次启动软件时更新一次</span><small>{{ source?.updatedAt ? `内容更新于 ${date(source.updatedAt)}` : loading ? '正在进行启动同步' : '本次启动未能取得新内容' }}</small><label class="news-search"><AppIcon name="search" :size="16" /><input v-model="query" type="search" placeholder="搜索版本或舰船" aria-label="搜索公告" /></label></div>
    </header>
    <p v-if="error || source?.error" class="news-warning" role="alert">{{ error || source?.error }}<span v-if="source?.updatedAt"> · 当前内容截至 {{ date(source.updatedAt) }}</span></p>
    <LoadingState v-if="loading && !feed.items.length" class="panel news-loading" label="正在同步官方公告…" detail="正在读取开发者日志与亚服简体中文新闻" />
    <div v-else class="news-content">
      <div class="news-list" role="tabpanel" :aria-label="category === 'ships' ? '舰船调整' : '版本更新'" :aria-busy="loading">
        <article v-for="item in items" :key="item.id" class="news-card panel" :class="{ 'news-card--important': item.important }">
          <div class="news-card__meta"><span :class="{ 'news-tag--event': category === 'events' }">{{ item.stage }}</span><b v-if="item.important">重要</b><time :datetime="item.publishedAt">{{ item.publishedAt }}</time></div>
          <h3>{{ item.title }}</h3><small v-if="item.originalTitle" class="news-original">{{ item.originalTitle }}</small><p>{{ item.summary }}</p>
          <footer><span>{{ item.source }}<small>{{ item.language }}</small></span><div class="news-card__actions"><button class="button-secondary" aria-haspopup="dialog" @click="showDetail(item)">查看详细</button><button class="button-secondary" :disabled="opening === item.url" @click="open(item.url)">官网原文 ↗</button></div></footer>
        </article>
        <div v-if="!items.length" class="panel news-empty"><AppIcon name="search" :size="28" /><strong>{{ query ? '没有匹配的公告' : '暂无可显示的公告' }}</strong><span>{{ query ? '试试版本号、中文舰名或其他关键词' : '下次启动软件时将重新同步公告' }}</span><button v-if="query" class="button-secondary" @click="query = ''">清空搜索</button></div>
      </div>

    </div>
  </section>
  <Teleport to="body">
    <dialog v-if="selected" ref="detailDialog" class="news-modal" aria-labelledby="news-detail-title" @cancel.prevent="closeDetail" @dblclick="closeOnBackdrop" @close="selected = null">
      <header class="news-modal__header">
        <div><span class="eyebrow">{{ selected.stage }} · {{ selected.publishedAt }}</span><h2 id="news-detail-title">{{ selected.title }}</h2><small v-if="selected.originalTitle">{{ selected.originalTitle }}</small></div>
        <button type="button" class="button-secondary" autofocus aria-label="关闭公告详情" @click="closeDetail">关闭 ✕</button>
      </header>
      <div class="news-modal__body" :aria-busy="pendingDetails.has(selected.id)">
        <p class="news-modal__translation">{{ selected.category === 'ships' ? '舰名采用 WG 官方中文；改动说明已翻译为中文' : '正文来自亚服官网简体中文页面' }}</p>
        <LoadingState v-if="pendingDetails.has(selected.id)" label="正在读取公告详情…" detail="正在同步完整正文" />
        <div v-else-if="detailError[selected.id]" class="news-modal__error" role="alert"><p>{{ detailError[selected.id] }}</p><button type="button" class="button-secondary" @click="loadDetail(selected)">重试</button></div>
        <div v-else class="news-modal__text"><p v-for="(line, index) in readableDetails(details[selected.id] || [], selected.category)" :key="index">{{ line }}</p></div>
      </div>
      <footer class="news-modal__footer"><span>{{ selected.source }} · {{ selected.language }}</span><button type="button" class="button-secondary" :disabled="opening === selected.url" @click="open(selected.url)">官网原文 ↗</button></footer>
    </dialog>
  </Teleport>
</template>

<style scoped>
.news-page{height:100%;min-height:0;display:flex;flex-direction:column;gap:14px}
.news-hero{display:flex;justify-content:space-between;align-items:center;gap:24px;padding:24px 28px;background:radial-gradient(ellipse at 85% 0,var(--cyan-soft),transparent 65%),var(--panel)}
.news-hero__main{min-width:0}.news-hero h2{font-size:28px;margin:10px 0 8px;letter-spacing:1px}.news-hero p{margin:0;color:var(--muted-strong);font-size:13px}
.news-sync{display:grid;justify-items:end;gap:8px;flex-shrink:0}.news-sync>span{font-size:12px;color:var(--muted-strong);display:flex;align-items:center;gap:7px}.news-sync i{width:6px;height:6px;background:var(--cyan);border-radius:50%}.news-sync small{color:var(--muted);font-size:11px}
.news-tabs{display:flex;flex-wrap:wrap;gap:8px;margin-top:18px}.news-tabs button{display:flex;align-items:center;gap:9px;border:1px solid var(--line);border-radius:9px;padding:12px 17px;background:var(--panel);color:var(--muted-strong);font-size:13px}.news-tabs button.active{color:var(--cyan);border-color:var(--cyan);background:var(--cyan-soft)}.news-tabs b{font-size:11px;opacity:.75}
.news-search{width:min(280px,100%);display:flex;align-items:center;gap:8px;margin-top:8px;padding:0 12px;height:42px;border:1px solid var(--line-strong);border-radius:8px;background:var(--panel);color:var(--muted)}.news-search input{flex:1;min-width:0;background:none;border:0;color:var(--ink);font-size:12px}
.news-content{min-height:0;flex:1;display:flex}.news-list{flex:1;overflow-y:auto;min-height:0;display:flex;flex-direction:column;gap:12px;padding-right:4px;scrollbar-width:thin;scrollbar-color:var(--line-strong) transparent}
.news-card{padding:20px 22px;flex-shrink:0}.news-card--important{border-color:var(--line-strong);border-left:3px solid var(--cyan)}.news-card__meta{display:flex;align-items:center;gap:8px;font-size:11px}.news-card__meta>span{padding:4px 8px;border-radius:4px;color:var(--cyan);background:var(--cyan-soft)}.news-card__meta .news-tag--event{color:var(--orange);background:rgba(255,157,86,.08)}.news-card__meta b{color:var(--orange);font-weight:500}.news-card time{margin-left:auto;color:var(--muted);font-variant-numeric:tabular-nums}
.news-card h3{font-size:18px;margin:14px 0 7px;line-height:1.5;color:var(--ink)}.news-original{display:block;color:var(--muted);font-size:11px;line-height:1.5}.news-card p{font-size:13px;line-height:1.85;color:var(--muted-strong);margin:12px 0 17px;overflow-wrap:anywhere}.news-card footer{border-top:1px solid var(--line);padding-top:14px;display:flex;align-items:center;justify-content:space-between;gap:12px}.news-card footer>span{color:var(--muted-strong);font-size:11px}.news-card footer small{display:block;color:var(--muted);margin-top:5px}.news-card footer button{font-size:11px;white-space:nowrap}.news-card__actions{display:flex;gap:8px}.news-detail{border-top:1px solid var(--line);padding:16px 0;display:grid;gap:8px}.news-detail strong{font-size:13px}.news-detail strong small{display:block;margin-top:5px;color:var(--muted);font-weight:normal;font-size:11px}.news-detail>span{color:var(--muted-strong);font-size:12px}.news-detail p{max-width:90ch;margin:0 0 7px;font-size:13px;line-height:1.9;color:var(--ink);white-space:pre-wrap}
.news-warning{margin:0;color:var(--orange);font-size:12px;line-height:1.5}.news-loading{flex:1}.news-empty{padding:45px 15px;display:grid;justify-items:center;gap:16px;color:var(--muted);font-size:12px}
@media(max-width:1100px){.news-hero{padding:18px 20px}.news-hero h2{font-size:24px}}
@media(max-width:800px){.news-hero{align-items:stretch;flex-direction:column}.news-sync{justify-items:start}.news-search{width:100%}.news-search input{width:100%}}
.news-modal{width:min(920px,calc(100vw - 48px));max-width:none;max-height:calc(100vh - 80px);padding:0;border:1px solid var(--line-strong);border-radius:14px;background:var(--panel-solid);color:var(--ink);box-shadow:0 24px 90px rgba(0,0,0,.4);overflow:hidden}
.news-modal[open]{display:flex;flex-direction:column}.news-modal::backdrop{background:rgba(2,10,16,.72);backdrop-filter:blur(4px)}
.news-modal__header{display:flex;align-items:flex-start;justify-content:space-between;gap:20px;padding:24px 28px;border-bottom:1px solid var(--line);flex-shrink:0}.news-modal__header>div{min-width:0}.news-modal__header h2{margin:9px 0 6px;font-size:22px;line-height:1.5;overflow-wrap:anywhere}.news-modal__header small{font-size:12px;color:var(--muted)}.news-modal__header button{flex-shrink:0;white-space:nowrap}
.news-modal__body{min-height:0;overflow-y:auto;padding:20px 28px;scrollbar-gutter:stable;scrollbar-width:thin;scrollbar-color:var(--line-strong) transparent}.news-modal__translation{margin:0 0 20px;color:var(--muted);font-size:12px}.news-modal__text p{margin:0 0 16px;line-height:1.9;font-size:14px;white-space:pre-wrap;overflow-wrap:anywhere}.news-modal__error{color:var(--orange);font-size:13px}
.news-modal__footer{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:16px 28px;border-top:1px solid var(--line);flex-shrink:0}.news-modal__footer span{font-size:12px;color:var(--muted)}
@media(max-width:760px){.news-modal{width:calc(100vw - 24px);max-height:calc(100vh - 32px)}.news-modal__header,.news-modal__body,.news-modal__footer{padding:16px}.news-modal__header h2{font-size:18px}}
</style>
