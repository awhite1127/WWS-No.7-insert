"use strict";
const { app, BrowserWindow, ipcMain } = require("electron");
const fs = require("node:fs"), path = require("node:path");
const { parseArenaData } = require("../electron/arena-parser.cjs");
const catalog = require("../data/operations.json");
const { createPlannerService } = require("../electron/planner-service.cjs");
const root = path.resolve(__dirname, "../..");
const packageArg = process.argv.find(arg => arg.startsWith("--package="));
const appRoot = packageArg ? packageArg.slice("--package=".length) : path.join(root, "source");
const config = { realm: "asia", theme: "dark", overlayEnabled: true, overlayHotkeyEnabled: true, overlayHotkey: "Tab", overlayBattleMode: "operations", gamePath: "" };
let arena = parseArenaData({ mapName: "s03_Labyrinth", vehicles: [{ name: "Test" }] });
const profile = fs.mkdtempSync(path.join(require("node:os").tmpdir(), "wws-operation-ui-"));
app.setPath("userData", profile);
const planner = createPlannerService({ cacheFile: path.join(profile, "planner.json") });
ipcMain.handle("planner:catalog", () => planner.get());
ipcMain.handle("ships:data-status", () => planner.getStatus());
for (const [channel, handler] of Object.entries({ "config:get": () => config, "config:save": (_e, value) => Object.assign(config, value), "wg:auth-status": () => ({ authorized: false }), "arena:get-state": () => ({ arena, roster: [], visible: true }), "window:is-maximized": () => false, "update:check": () => ({ available: false }) })) ipcMain.handle(channel, handler);
const delay = ms => new Promise(r => setTimeout(r, ms));
const timeout = setTimeout(() => { console.error("Operation UI timed out"); app.exit(1); }, 45000);
app.on("will-quit", () => clearTimeout(timeout));
app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, width: 1450, height: 980, webPreferences: { offscreen: true, backgroundThrottling: false, preload: path.join(appRoot, "electron/preload.cjs"), sandbox: true, contextIsolation: true } });
  const js = code => win.webContents.executeJavaScript(code);
  await win.loadFile(path.join(appRoot, "dist/index.html")); await delay(200);
  await js(`Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim()==='暂不授权')?.click()`);
  await js(`Array.from(document.querySelectorAll('.nav-item')).find(b=>b.textContent.includes('七号插')).click()`); await delay(200);
  if (!await js(`document.querySelector('.operation-guide h2')?.textContent.includes('猛禽')`)) throw new Error("Auto recognition not displayed");
  if (await js(`Boolean(document.querySelector('.battle-topbar__refresh'))`)) throw new Error('Operations must not show an ineffective roster refresh button');

  const chooseRoute = async id => { await js(`document.querySelector('[data-route="${id}"]')?.click()`); await delay(20); };
  const selectMap = async id => { await js(`(()=>{const e=document.querySelector('select[aria-label="选择行动地图"]');e.value=${JSON.stringify(id)};e.dispatchEvent(new Event('change',{bubbles:true}));})()`); await delay(30); };
  fs.mkdirSync(path.join(root,'previews'),{recursive:true});
  for (const op of catalog.operations) {
    await selectMap(op.id);
    if (await js(`document.querySelectorAll('[data-stage],[aria-label="切换刷新点位图"]').length`)) throw new Error('Legacy wave selectors remain');
    if (await js(`document.querySelectorAll('[data-route]').length`) !== (op.overview.routeSelection ? op.routes.length : 0)) throw new Error('Incorrect route choices');
    const imagePaths = new Set();
    for (const route of op.overview.routeSelection ? op.routes : [op.routes[0]]) {
      await chooseRoute(route.id);
      const baseImage = await js(`document.querySelector('.operation-guide svg image').getAttribute('href')`);
      if(imagePaths.has(baseImage)) throw new Error('Routes share annotated base image');
      imagePaths.add(baseImage);
      if(await js(`document.querySelectorAll('.operation-guide svg polyline,.operation-guide svg marker').length`)) throw new Error('Enemy movement arrows remain');
      if (await js(`document.querySelectorAll('.operation-guide__legend>li').length`) !== op.overview.groups.length) throw new Error('Missing overview stages');
      if (!await js(`document.querySelectorAll('.operation-guide__point').length>2 && Array.from(document.querySelectorAll('.operation-guide svg [transform],.operation-guide svg polyline')).every(g=>!String(g.getAttribute('transform')||g.getAttribute('points')).match(/NaN|undefined/))`)) throw new Error('Invalid overview points');
      if (!await js(`(()=>{const boxes=Array.from(document.querySelectorAll('.operation-guide__number rect')).map(r=>r.getBoundingClientRect());return boxes.every((a,i)=>boxes.slice(i+1).every(b=>a.right<=b.left||b.right<=a.left||a.bottom<=b.top||b.bottom<=a.top));})()`)) throw new Error(`Overlapping number labels: ${op.id}/${route.id}`);
      if (!await js(`new Promise(resolve=>{const image=new Image();image.onload=()=>resolve(true);image.onerror=()=>resolve(false);image.src=document.querySelector('.operation-guide svg image').getAttribute('href');})`)) throw new Error('Map failed to load');
      const count = await js(`document.querySelectorAll('.operation-guide__point').length`);
      await js(`document.querySelector('.operation-guide__legend button').click()`); await delay(20);
      if (await js(`document.querySelectorAll('.operation-guide__point').length`) !== count || !await js(`Boolean(document.querySelector('.operation-guide__point.emphasized'))`)) throw new Error('Emphasis hid full overview');
      await js(`document.querySelector('.operation-guide__legend button').click()`);
    }
  }
  await selectMap('newport');
  if (await js(`document.querySelectorAll('[data-numbers="1–3/5"]').length`) !== 3) throw new Error('Newport random regions missing or duplicated');
  await selectMap('narai');
  if (!await js(`['D7','G6'].every(c=>document.querySelector('.operation-guide__legend').textContent.includes(c))`)) throw new Error('Narai objectives not shown together');
  await selectMap('killer-whale');
  const killerImage = await js(`document.querySelector('.operation-guide svg image').getAttribute('href')`);
  await chooseRoute('north');
  if(killerImage === await js(`document.querySelector('.operation-guide svg image').getAttribute('href')`)) throw new Error('Killer Whale base did not change');
  arena = {...arena, operationId:'', mapName:'未知行动'};
  win.webContents.send('arena:update',arena); await delay(60);
  if (!await js(`Boolean(document.querySelector('.operation-guide__empty'))`)) throw new Error('Unknown battle kept old map');
  await js(`Array.from(document.querySelectorAll('.nav-item')).find(b=>b.textContent.includes('行动路线')).click()`); await delay(80);
  if (await js(`document.querySelectorAll('.operation-guide__maps button').length`) !== 8) throw new Error('Missing map categories');
  if (!await js(`Array.from(document.querySelectorAll('.nav-item')).find(b=>b.textContent.includes('行动路线')).querySelector('.beta-badge')?.textContent==='Beta' && !document.querySelector('.page-heading .beta-badge')`)) throw new Error('Operations Beta must only appear in sidebar');
  for (const op of catalog.operations) {
    await js(`document.querySelectorAll('.operation-guide__maps button')[${catalog.operations.indexOf(op)}].click()`); await delay(80);
    fs.writeFileSync(path.join(root,`previews/operations-overview-${op.id}.png`),(await win.webContents.capturePage()).toPNG());
    if(op.overview.routeSelection) for(const r of op.routes) {
      await chooseRoute(r.id); await delay(70);
      fs.writeFileSync(path.join(root,`previews/operations-overview-${op.id}-${r.id}.png`),(await win.webContents.capturePage()).toPNG());
    }
  }
  await js(`Array.from(document.querySelectorAll('.operation-guide__maps button')).find(b=>b.textContent.includes('赫尔墨斯')).click()`); await delay(40);
  if (!await js(`document.querySelector('.operation-guide__legend').textContent.includes('A10') && !document.querySelector('.operation-guide__legend ul').textContent.includes('J1')`)) throw new Error('Hermes north missing');
  const northFirst = await js(`document.querySelector('.operation-guide__point g').getAttribute('transform')`);
  await chooseRoute('west');
  if (!await js(`document.querySelector('.operation-guide__legend').textContent.includes('J1') && document.querySelectorAll('.operation-guide__legend>li').length===6`) || northFirst === await js(`document.querySelector('.operation-guide__point g').getAttribute('transform')`)) throw new Error('Hermes did not swap whole route');
  await delay(80);
  fs.writeFileSync(path.join(root,'previews/operations-hermes-west.png'),(await win.webContents.capturePage()).toPNG());
  await chooseRoute('north'); await delay(80);
  fs.writeFileSync(path.join(root,'previews/operations-hermes-north.png'),(await win.webContents.capturePage()).toPNG());
  const current = parseArenaData({mapName:'s09_LePVE',vehicles:[{name:'Test'}]});
  await js(`Array.from(document.querySelectorAll('.nav-item')).find(b=>b.textContent.includes('七号插')).click()`); await delay(50);
  win.webContents.send('arena:update',current); await delay(50);
  await chooseRoute('west');
  win.webContents.send('arena:update',{...current,updatedAt:current.updatedAt+1}); await delay(50);
  if (!await js(`document.querySelector('[data-route][aria-pressed="true"]').dataset.route==='west'`)) throw new Error('Same battle refresh lost route selection');
  await js(`Array.from(document.querySelectorAll('.nav-item')).find(b=>b.textContent.includes('舰船配装')).click()`); await delay(40);
  if (!await js(`Array.from(document.querySelectorAll('.nav-item')).find(b=>b.textContent.includes('舰船配装')).querySelector('.beta-badge')?.textContent==='Beta' && !document.querySelector('.page-heading .beta-badge')`)) throw new Error('Planner Beta must only appear in sidebar');
  const overlay = new BrowserWindow({show:false,width:1150,height:900,webPreferences:{offscreen:true,backgroundThrottling:false,preload:path.join(appRoot,'electron/preload.cjs'),sandbox:true,contextIsolation:true}});
  arena = parseArenaData({mapName:'s03_Labyrinth',vehicles:[{name:'Test'}]});
  await overlay.loadFile(path.join(appRoot,'dist/overlay.html')); await delay(100);
  await overlay.webContents.executeJavaScript(`document.querySelector('[data-route="north-north"]').click()`); await delay(50);
  if (!await overlay.webContents.executeJavaScript(`document.querySelector('.operation-guide__legend').textContent.includes('E9') && document.querySelectorAll('.operation-guide__legend>li').length===5 && !document.querySelector('[data-stage]')`)) throw new Error('Overlay overview did not switch');
  await delay(200);
  fs.writeFileSync(path.join(root,'previews/operations-overlay.png'),(await overlay.webContents.capturePage()).toPNG());
  console.log('Operations UI OK: 8 complete overviews, all actual route variants, random range numbering, all Narai objectives, focus retains all points, same battle selection, unknown reset, sidebar Beta, overlay switching');
  app.exit(0);
}).catch(e=>{console.error(e);app.exit(1);});
