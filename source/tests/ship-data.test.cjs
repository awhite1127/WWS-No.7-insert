"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs/promises"),os=require("node:os"),path=require("node:path");
const {gunzipSync}=require("node:zlib");
const {createPlannerService}=require("../electron/planner-service.cjs");
const {WgApi}=require("../electron/wg-api.cjs");
const seed=JSON.parse(gunzipSync(require("node:fs").readFileSync(path.join(__dirname,"../public/planner-catalog.json.gz"))));
const response=revision=>({ok:true,text:async()=>JSON.stringify({currentVersionCode:revision})});
async function cache(t){const dir=await fs.mkdtemp(path.join(os.tmpdir(),"no7-ship-data-"));t.after(()=>fs.rm(dir,{recursive:true,force:true}));return path.join(dir,"catalog.json");}

test("startup checks once, concurrent manual checks share it, page reads never check",async t=>{
  let requests=0,collections=0;
  const service=createPlannerService({cacheFile:await cache(t),fetcher:async()=>{requests++;await new Promise(r=>setTimeout(r,10));return response(seed.revision);},collectCatalog:async()=>{collections++;throw Error("must not download unchanged data");}});
  const [first,manual]=await Promise.all([service.start(),service.check()]);
  assert.equal(first.state,"ready");assert.equal(manual.version,seed.version);
  await service.start();await service.get();await service.getStatus();
  assert.equal(requests,1);assert.equal(collections,0);
  await service.check();assert.equal(requests,2);
});

test("new catalog is persisted and shared with battle ship names, including after restart",async t=>{
  const cacheFile=await cache(t),api=new WgApi(()=>"test"),next=structuredClone(seed);
  next.version="test-new";next.revision++;
  const extra={...structuredClone(seed.ships[0]),id:"NEW_SHIP",gameId:99999999,name:"新增舰船",english:"New Ship"};
  next.ships.push(extra);
  const revisions=[];
  const service=createPlannerService({cacheFile,fetcher:async()=>response(next.revision),collectCatalog:async()=>next,onCatalog:c=>{revisions.push(c.revision);api.setShipCatalog(c);}});
  const result=await service.start();
  assert.equal(result.updated,true);assert.equal(result.shipCount,seed.ships.length+1);
  assert.deepEqual(revisions,[seed.revision,next.revision]);
  api.request=async()=>{throw Error("known ship must not need WG access");};
  assert.equal((await api.shipMetadata([extra.gameId],"asia"))[extra.gameId].name,"新增舰船");
  assert.equal((await service.get()).ships.at(-1).id,"NEW_SHIP");
  const restart=createPlannerService({cacheFile,fetcher:async()=>{throw Error("offline");},onCatalog:c=>api.setShipCatalog(c)});
  assert.equal((await restart.start()).state,"error");
  assert.equal((await restart.get()).revision,next.revision);
  assert.equal(api.localShipMetadata(extra.gameId).name,"新增舰船");
});

test("failed startup retains local data, does not repeat automatically, manual retry works",async t=>{
  let requests=0;
  const service=createPlannerService({cacheFile:await cache(t),fetcher:async()=>{if(++requests===1)throw Error("offline");return response(seed.revision);}});
  assert.equal((await service.start()).state,"error");
  assert.equal((await service.get()).ships.length,seed.ships.length);
  await service.start();await service.getStatus();assert.equal(requests,1);
  assert.equal((await service.check()).state,"ready");assert.equal(requests,2);
});

test("invalid new snapshot cannot replace the catalog or names",async t=>{
  const cacheFile=await cache(t);
  const service=createPlannerService({cacheFile,fetcher:async()=>response(seed.revision+1),collectCatalog:async()=>({...seed,revision:seed.revision+1,ships:[]})});
  assert.equal((await service.start()).state,"error");
  assert.equal((await service.get()).revision,seed.revision);
  await assert.rejects(fs.access(cacheFile));
});

test("updated names take priority over bundled names, unknown ships retain WG fallback",async()=>{
  const api=new WgApi(()=>"test");
  api.setShipCatalog({ships:[{gameId:3436099280,name:"新版舰名",english:"New Name",tier:9,type:"Cruiser",nation:"japan"}]});
  api.request=async(_realm,_endpoint,params)=>{assert.equal(params.ship_id,"777");return {data:{777:{ship_id:777,name:"Unknown Ship",tier:8,type:"Destroyer"}}};};
  const meta=await api.shipMetadata([3436099280,777],"asia");
  assert.equal(meta[3436099280].name,"新版舰名");assert.equal(meta[777].name,"Unknown Ship");
  api.playerDetails=async()=>({accountId:1,hiddenProfile:false,clan:null,overall:{battles:1},ships:[{shipId:3436099280,name:"旧舰名",battles:1}]});
  api.request=async()=>({data:{}});
  const [player]=await api.rosterStats([{key:"p1",accountId:1,name:"Tester",shipId:3436099280}],"asia");
  assert.equal(player.shipName,"新版舰名");assert.equal(player.currentShip.name,"新版舰名");
});
