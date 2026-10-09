<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import catalog from '../../data/operations.json';
import { buildOverview, type Operation, type Location, type Point } from '../lib/operation-overview';
import type { ArenaInfo } from '../types';
const props = defineProps<{ arena: ArenaInfo | null; browse?: boolean }>();
const selected = ref(props.browse ? catalog.operations[0]!.id : '');
const route = ref('');
const focused = ref<number | null>(null);
watch(() => `${props.arena?.battleId}|${props.arena?.mapId}|${props.arena?.operationId}`, () => { if (!props.browse) selected.value = ''; });
const operation = computed(() => (catalog.operations as Operation[]).find(op => op.id === (selected.value || props.arena?.operationId)));
function resetSelection() { route.value = operation.value?.routes[0]?.id || ''; focused.value = null; }
watch(() => operation.value?.id, resetSelection, { immediate: true, flush: 'sync' });
watch(() => props.arena?.battleId, () => { if (!props.browse) resetSelection(); });
watch(route, () => { focused.value = null; });
const overview = computed(() => operation.value ? buildOverview(operation.value, route.value) : { groups: [], markers: [] });
const currentRoute = computed(() => operation.value?.overview.routeSelection ? operation.value.routes.find(r => r.id === route.value) : undefined);
const mapImage = computed(() => import.meta.env.BASE_URL + (currentRoute.value?.image || operation.value?.image || '').replace(/^\//, ''));
function position(point: Location) {
  const [left = 0, top = 0, width = 100, height = 100] = operation.value!.bounds;
  if (point.cell) return { x: left + (Number(point.cell.slice(1)) - .5) * width / 10, y: top + (point.cell.charCodeAt(0) - 64.5) * height / 10 };
  return { x: left + (point.x || 0) * width / 100, y: top + (point.y || 0) * height / 100 };
}
function scope(point: Point) { return point.cell ? point.cell + ' · 格位参考' : '大致刷新区域'; }
function toggleFocus(index: number) { focused.value = focused.value === index ? null : index; }
function badgeWidth(numbers: string[]) { return Math.max(5.6, numbers.join('/').length * 1.9 + 2.4); }
const numberedMarkers = computed(() => {
  const placed: { x: number; y: number; width: number; height: number }[] = [...(currentRoute.value?.baseMarkers || [])];
  return overview.value.markers.map(point => {
    const p = position(point), width = badgeWidth(point.numbers);
    const offsets = [[0,0]];
    for(let radius=8;radius<=32;radius+=8) for(let x=-radius;x<=radius;x+=8) for(let y=-radius;y<=radius;y+=8) {
      if(Math.max(Math.abs(x),Math.abs(y))===radius) offsets.push([x,y]);
    }
    offsets.sort((a,b) => Math.hypot(a[0]!,a[1]!) - Math.hypot(b[0]!,b[1]!));
    const candidates = offsets.map(([x=0,y=0]) => ({ x: p.x+x, y: p.y+y, width, height: 5.6 }));
    const label = candidates.find(c => c.x-width/2 >= -7 && c.x+width/2 <= 107 && c.y >= -5 && c.y <= 105 && placed.every(other => Math.abs(other.x-c.x) > (other.width+width)/2 + .6 || Math.abs(other.y-c.y) > (other.height+c.height)/2 + 1)) || candidates[0]!;
    placed.push(label);
    return { ...point, label, anchor: p, moved: label.x !== p.x || label.y !== p.y };
  });
});
</script>

<template>
  <section class="operation-guide">
    <nav v-if="browse" class="operation-guide__maps" aria-label="按行动地图分类"><button v-for="op in catalog.operations" :key="op.id" type="button" :class="{ active: selected === op.id }" :aria-pressed="selected === op.id" @click="selected = op.id"><strong>{{ op.name }}</strong><span>{{ op.overview.routeSelection ? `${op.routes.length} 种出口／航线总图` : '完整点位总图' }}</span></button></nav>
    <header class="operation-guide__header">
      <div><span class="eyebrow">OPERATIONS · SPAWN POINTS</span><h2>{{ operation?.name || '行动模式点位图' }}</h2><p>{{ browse ? `${operation?.englishName || ''} · 全流程敌舰点位总览` : arena ? `读取地图：${arena.mapName || arena.mapId || '未知'} · ${selected ? '手动选择' : operation ? '自动匹配' : '尚未收录或未识别'}` : '进入行动后自动匹配地图，也可以先手动浏览。' }}</p></div>
      <label v-if="!browse">行动地图<select v-model="selected" aria-label="选择行动地图"><option value="">{{ arena ? '使用对局识别结果' : '请选择地图' }}</option><option v-for="op in catalog.operations" :key="op.id" :value="op.id">{{ op.name }} · {{ op.englishName }}</option></select></label>
    </header>
    <template v-if="operation">
      <div v-if="operation.overview.routeSelection" class="operation-guide__selectors"><span>出口／航线</span><div class="operation-guide__tabs" role="group" aria-label="选择出口或航线"><button v-for="r in operation.routes" :key="r.id" type="button" :data-route="r.id" :aria-pressed="route === r.id" :class="{ active: route === r.id }" @click="route = r.id">{{ r.label }}</button></div></div>
      <p class="operation-guide__reading">数字对应右侧阶段说明；同阶段多点共用编号，随机顺序用编号范围表示。点击说明可强调相关点位，完整总图始终保留。</p>
      <div class="operation-guide__body">
        <figure>
          <svg viewBox="-8 -8 116 116" role="img" :aria-label="operation.name + ' · ' + (currentRoute?.label || '') + '全流程敌舰刷新点位总图'">
            <image :href="mapImage" x="0" y="0" width="100" height="100" preserveAspectRatio="none" />
            <g v-for="(point,index) in overview.markers" :key="index" class="operation-guide__point" :class="{ emphasized: focused !== null && point.groupIndices.includes(focused) }" :data-numbers="point.numbers.join('/')" :style="{ '--point-color': '#ff754f' }">
              <title>{{ point.numbers.join(' / ') }} · {{ point.entries.map(p => p.label).join('；') }} · {{ scope(point) }}</title>
              <g :transform="`translate(${position(point).x} ${position(point).y})`">
                <circle r="3.4" fill="none" stroke="var(--point-color)" stroke-width=".3" :stroke-dasharray="point.entries.every(p => p.cell) ? undefined : '1 .8'"/>
              </g>
            </g>
            <!-- Draw all numbered labels after the location rings so later points cannot cover earlier numbers. -->
            <g v-for="(point,index) in numberedMarkers" :key="'label'+index" class="operation-guide__number" :class="{ emphasized: focused !== null && point.groupIndices.includes(focused) }" :style="{ '--point-color': point.kind === 'movement' ? '#4de4e1' : '#ff754f' }">
              <line v-if="point.moved" :x1="point.anchor.x" :y1="point.anchor.y" :x2="point.label.x" :y2="point.label.y" stroke="var(--point-color)" stroke-width=".45"/><circle v-if="point.moved" :cx="point.anchor.x" :cy="point.anchor.y" r=".7" fill="var(--point-color)"/>
              <g :transform="`translate(${point.label.x} ${point.label.y})`">
              <rect :x="-badgeWidth(point.numbers)/2" y="-2.8" :width="badgeWidth(point.numbers)" height="5.6" rx="2.8" fill="var(--point-color)" stroke="#fff" stroke-width=".45"/>
              <text text-anchor="middle" dominant-baseline="central" fill="#071723" font-size="2.7" font-weight="800">{{ point.numbers.join('/') }}</text>
              </g>
            </g>
          </svg>
          <figcaption>橙色编号：敌舰刷新位置 · 青色底图标记：当前友方航点／出口<br>实线圈：格位参考 · 虚线圈：大致区域。细引线仅用于编号避让，不表示敌舰航线。</figcaption>
        </figure>
        <aside><span class="eyebrow">{{ currentRoute?.label || '全流程总览' }}</span><h3>刷新顺序与点位说明</h3><ol class="operation-guide__legend"><li v-for="(group,index) in overview.groups" :key="group.number" :data-group="group.number" :class="{ active: focused === index }"><button type="button" :aria-pressed="focused === index" @click="toggleFocus(index)"><b>{{ group.number }}</b><strong>{{ group.title }}</strong></button><p>{{ group.note }}</p><ul><li v-for="(point,i) in group.entries" :key="i"><span >{{ point.label }}</span><small>{{ scope(point) }}</small></li></ul></li></ol></aside>
      </div>
      <footer>{{ catalog.notice }}<br><template v-if="operation.routeNotice">{{ operation.routeNotice }} <a :href="operation.routeSource" target="_blank" rel="noopener noreferrer">社区参考资料</a><br></template><span v-if="operation.legacy">此图参考较早攻略，当前版本点位需实战核对。 </span>资料整理 {{ catalog.reviewedAt }} · 来源修订 {{ operation.sourceUpdated }} · <a :href="operation.source" target="_blank" rel="noopener noreferrer">官方 Wiki</a> · <a href="https://wikiwiki.jp/wobships/オペレーション" target="_blank" rel="noopener noreferrer">社区点位参考</a> · <a :href="operation.terrainSource" target="_blank" rel="noopener noreferrer">地形底图来源</a></footer>
    </template>
    <div v-else class="operation-guide__empty">{{ arena ? '当前地图尚未匹配到点位资料，请手动选择对应行动。新行动或未知地图不会套用其他地图的点位。' : '选择行动地图，查看全流程敌舰点位总图。' }}</div>
  </section>
</template>

<style scoped>
.operation-guide{width:100%;padding:20px;color:var(--ink);box-sizing:border-box;background:var(--panel-solid);border:1px solid var(--line);border-radius:12px;overflow:auto;max-height:100%}
.operation-guide__maps{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:8px;margin-bottom:14px;padding-bottom:12px;border-bottom:1px solid var(--line)}.operation-guide__maps button{text-align:left;display:grid;gap:3px;padding:9px;background:transparent;border:1px solid var(--line);border-radius:7px;cursor:pointer;color:var(--ink)}.operation-guide__maps button.active{border-color:var(--cyan);background:rgba(72,215,210,.1)}.operation-guide__maps button span{color:var(--muted);font-size:11px}.operation-guide__maps button strong{font-size:13px}
.operation-guide__header{display:flex;justify-content:space-between;gap:20px;align-items:center}.operation-guide h2{margin:7px 0;font-size:24px}.operation-guide p{color:var(--muted-strong);font-size:13px;line-height:1.7;margin:8px 0}.operation-guide label{display:grid;gap:6px;font-size:12px;color:var(--muted-strong)}.operation-guide select{max-width:300px;color:var(--ink);background:var(--panel-solid);border:1px solid var(--line);padding:9px;border-radius:6px}
.operation-guide__selectors{display:flex;align-items:center;gap:14px;margin:16px 0;padding:12px;border:1px solid var(--line);border-radius:8px}.operation-guide__selectors>span{flex:0 0 84px;font-size:12px;color:var(--muted)}.operation-guide__tabs{display:flex;flex-wrap:wrap;gap:7px}.operation-guide__tabs button{padding:8px 12px;background:transparent;color:var(--muted-strong);border:1px solid var(--line);border-radius:6px;cursor:pointer;font:inherit;font-size:12px}.operation-guide__tabs button.active{color:var(--cyan);border-color:var(--cyan);background:rgba(72,215,210,.1)}
.operation-guide .operation-guide__reading{font-size:12px;margin:12px 0 16px}.operation-guide__body{display:grid;grid-template-columns:minmax(280px,1.4fr) minmax(220px,1fr);gap:24px;align-items:start}.operation-guide figure{margin:0;min-width:0}.operation-guide svg{display:block;width:100%;height:58vh;background:#102532;border-radius:8px}.operation-guide figcaption{font-size:11px;color:var(--muted);margin-top:8px;line-height:1.7}.operation-guide h3{margin:7px 0 12px;font-size:19px}.operation-guide__legend{list-style:none;padding:0;margin:0;max-height:51vh;overflow:auto;scrollbar-gutter:stable}.operation-guide__legend>li{padding:10px 8px;border-top:1px solid var(--line);border-radius:5px}.operation-guide__legend>li.active{background:rgba(72,215,210,.09);outline:1px solid var(--cyan);outline-offset:-1px}.operation-guide__legend button{display:flex;align-items:center;gap:10px;padding:0;background:none;border:0;color:var(--ink);text-align:left;cursor:pointer;font:inherit;font-size:14px;width:100%}.operation-guide__legend b{display:grid;place-items:center;min-width:30px;height:27px;padding:0 5px;box-sizing:border-box;flex-shrink:0;border-radius:14px;background:#ff754f;color:#071723;font-size:13px}.operation-guide__legend ul{padding-left:16px;display:grid;gap:6px;font-size:12px;color:var(--muted-strong)}.operation-guide__legend small{display:block;color:var(--muted);font-size:10px;margin-top:2px}.operation-guide__legend .movement{color:var(--cyan)}.operation-guide__number.emphasized rect{stroke:#4de4e1;stroke-width:1}.operation-guide__point.emphasized circle{stroke-width:1;fill-opacity:.2}.operation-guide__point.emphasized polyline{stroke-width:1.1;stroke-opacity:1}
.operation-guide footer{margin-top:16px;border-top:1px solid var(--line);padding-top:12px;color:var(--muted);font-size:11px;line-height:1.8}.operation-guide a{color:var(--cyan)}.operation-guide__empty{padding:35px 0;color:var(--muted-strong);font-size:14px}
.operation-guide:has(.operation-guide__maps) svg{height:clamp(260px,calc(100vh - 480px),620px)}.operation-guide:has(.operation-guide__maps):has(.operation-guide__selectors) svg{height:clamp(260px,calc(100vh - 550px),550px)}.operation-guide:has(.operation-guide__maps) .operation-guide__legend{max-height:clamp(220px,calc(100vh - 530px),570px)}.operation-guide:has(.operation-guide__maps):has(.operation-guide__selectors) .operation-guide__legend{max-height:clamp(220px,calc(100vh - 600px),500px)}
@media(max-width:850px){.operation-guide__header{align-items:start;flex-direction:column}.operation-guide__body{grid-template-columns:1fr}.operation-guide svg,.operation-guide:has(.operation-guide__maps) svg{height:55vh}.operation-guide__legend,.operation-guide:has(.operation-guide__maps) .operation-guide__legend{max-height:none}.operation-guide__selectors{align-items:start}}
</style>
