"use strict";
const {app,BrowserWindow,ipcMain}=require("electron");
const fs=require("node:fs"),path=require("node:path"),os=require("node:os"),{gunzipSync}=require("node:zlib");
const root=path.resolve(__dirname,"../.."),packageArg=process.argv.find(arg=>arg.startsWith("--package="));
const appRoot=packageArg?packageArg.slice(10):path.join(root,"source");
const {createPlannerService}=require(path.join(appRoot,"electron/planner-service.cjs"));
const seedFile=path.join(appRoot,"dist/planner-catalog.json.gz"),seed=JSON.parse(gunzipSync(fs.readFileSync(seedFile)));
const next=structuredClone(seed);next.revision++;next.version="test-new";
next.ships.push({...structuredClone(seed.ships.find(s=>s.id==="PJSB018")),id:"NEW_UI_SHIP",gameId:99999999,name:"新增舰船测试",english:"New UI Ship"});
const profile=fs.mkdtempSync(path.join(os.tmpdir(),"no7-ship-data-ui-"));app.setPath("userData",profile);
let win,requests=0,remote=seed.revision,offline=false;
const service=createPlannerService({cacheFile:path.join(profile,"catalog.json"),seedFile,
  fetcher:async()=>{requests++;if(offline)throw Error("模拟离线");return {ok:true,text:async()=>JSON.stringify({currentVersionCode:remote})};},
  collectCatalog:async()=>next,onStatus:status=>{if(win&&!win.isDestroyed())win.webContents.send("ships:data-status",status);}});
const config={realm:"asia",theme:"dark",gamePath:"",overlayEnabled:false,overlayHotkeyEnabled:true,overlayHotkey:"Tab",overlayBattleMode:"random"};
for(const [channel,handler] of Object.entries({"config:get":()=>config,"wg:auth-status":()=>({authorized:false}),"arena:get-state":()=>({arena:null,roster:[],visible:true}),"window:is-maximized":()=>false,"planner:catalog":()=>service.get(),"ships:data-status":()=>service.getStatus(),"ships:check-data":()=>service.check()}))ipcMain.handle(channel,handler);
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const timer=setTimeout(()=>{console.error("Ship data UI timed out");app.exit(1);},30000);app.on("will-quit",()=>clearTimeout(timer));
app.whenReady().then(async()=>{
  await service.start();
  win=new BrowserWindow({show:false,width:1280,height:720,webPreferences:{offscreen:true,backgroundThrottling:false,sandbox:true,contextIsolation:true,preload:path.join(appRoot,"electron/preload.cjs")}});
  const js=code=>win.webContents.executeJavaScript(code);
  await win.loadFile(path.join(appRoot,"dist/index.html"));await delay(200);
  await js(`Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim()==='暂不授权')?.click()`);
  await js(`Array.from(document.querySelectorAll('.nav-item')).find(b=>b.textContent.includes('舰船配装')).click()`);
  for(let i=0;i<100;i++){if(await js(`Boolean(document.querySelector('.planner-skill'))`))break;await delay(30);}
  if(await js(`Boolean(document.querySelector('.planner-update'))`))throw Error("Planner still has its own update button");
  await js(`document.querySelector('[aria-label="打开设置"]').click()`);await delay(50);
  if(!await js(`document.querySelector('.settings-ship-data').textContent.includes('已检查，暂无新版')`))throw Error("Startup result missing");
  if(requests!==1)throw Error("Visiting planner/settings caused another check");
  remote=next.revision;
  await js(`document.querySelector('.settings-ship-data button').click()`);
  for(let i=0;i<100;i++){if(await js(`document.querySelector('.settings-ship-data').textContent.includes('已更新')`))break;await delay(30);}
  if(!await js(`document.querySelector('.settings-ship-data').textContent.includes('test-new') && Array.from(document.querySelector('[aria-label="选择舰船"]').options).some(o=>o.textContent.includes('新增舰船测试'))`))throw Error("Active planner did not receive new ship");
  if(requests!==2)throw Error("Manual check duplicated requests");
  const layout=await js(`(()=>{const block=document.querySelector('.settings-ship-data'),button=block.querySelector('button').getBoundingClientRect(),title=block.querySelector('strong').getBoundingClientRect();return button.left>=title.right && button.right<=block.getBoundingClientRect().right;})()`);
  if(!layout)throw Error("Settings controls overlap");
  fs.mkdirSync(path.join(root,"previews"),{recursive:true});
  fs.writeFileSync(path.join(root,"previews/ship-data-settings.png"),(await win.webContents.capturePage()).toPNG());
  offline=true;
  await js(`document.querySelector('.settings-ship-data button').click()`);
  for(let i=0;i<100;i++){if(await js(`Boolean(document.querySelector('.settings-ship-data [role="alert"]'))`))break;await delay(30);}
  if(!await js(`document.querySelector('.settings-ship-data').textContent.includes('继续使用本地舰船数据') && document.querySelector('[aria-label="选择舰船"]').textContent.includes('新增舰船测试')`))throw Error("Offline fallback missing");
  console.log("Ship data UI OK: one startup check, global settings entry, live new-ship catalog, offline fallback, no planner update button.");app.exit(0);
}).catch(error=>{console.error(error);app.exit(1);});
