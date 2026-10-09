"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {normalizePlayer,parseArenaData}=require("../electron/arena-parser.cjs");
const {WgApi}=require("../electron/wg-api.cjs");
const {enrichRosterKarma}=require("../electron/karma-service.cjs");

test("bot names and explicit flags are recognized without treating unresolved humans as bots",()=>{
  const arena=parseArenaData({vehicles:[{name:":Hollmann:",relation:0},{name:":Goltz:",relation:2},{name:"Human"},{name:"AI",isBot:true}]});
  assert.deepEqual(arena.players.map(p=>p.isBot),[true,true,false,true]);
  assert.equal(normalizePlayer({nickname:":Lee:"}).isBot,true);
  assert.equal(normalizePlayer({name:"Human",isBot:"false",accountId:0}).isBot,false);
});

test("mixed co-op roster excludes bots from all account requests and reads real players",async()=>{
  const api=new WgApi(()=>"test"),calls=[];
  api.setShipCatalog({ships:[{gameId:99,name:"测试舰船",english:"Test Ship",tier:8,type:"Cruiser",nation:"japan"}]});
  api.request=async(_realm,endpoint,params)=>{
    calls.push({endpoint,params});
    if(endpoint==="account/list"){
      if(params.search.includes(":"))throw Error("INVALID_SEARCH");
      assert.equal(params.search,"HumanOne");return {data:[{nickname:"HumanOne",account_id:1}]};
    }
    assert.ok(!String(params.account_id||"").split(",").includes("77"));
    if(endpoint==="account/info")return {data:Object.fromEntries(String(params.account_id).split(",").map(id=>[id,{account_id:Number(id),nickname:Number(id)===1?"HumanOne":"HumanTwo",statistics:{pvp:{battles:100,wins:55,xp:100000}}}]))};
    if(endpoint==="ships/stats")return {data:{[params.account_id]:[{ship_id:99,pvp:{battles:10,wins:6,damage_dealt:100000,xp:20000}}]}};
    return {data:{1:null,2:null}};
  };
  const players=parseArenaData({vehicles:[{name:"HumanOne",shipId:99},{name:":Hollmann:",shipId:99},{name:"HumanTwo",accountId:2,shipId:99},{name:"ExplicitAI",isBot:true,accountId:77,shipId:99}]}).players;
  const progress=[],result=await api.rosterStats(players,"asia",()=>true,(entry,index)=>progress.push({index,status:entry.status}));
  assert.deepEqual(result.map(p=>p.status),["ok","bot","ok","bot"]);
  for(const p of result.filter(p=>p.status==="bot")){assert.equal(p.shipName,"测试舰船");assert.equal(p.accountId,null);assert.equal(p.overall,null);assert.equal(p.currentShip,null);}
  assert.equal(result[0].overall.battles,100);assert.equal(result[2].currentShip.battles,10);
  assert.equal(calls.filter(c=>c.endpoint==="ships/stats").length,2);
  assert.ok(progress.some(p=>p.index===1&&p.status==="bot"));
});

test("all-bot roster never queries player services and bot karma cannot be fetched",async()=>{
  const api=new WgApi(()=>"test");
  api.shipMetadata=async()=>({99:{name:"Bot Ship",tier:8,type:"Battleship"}});
  api.request=async()=>{throw Error("bot account query must not run");};
  const result=await api.rosterStats([{name:":Lee:",accountId:77,shipId:99,side:"enemy"}]);
  assert.equal(result[0].status,"bot");assert.equal(result[0].shipName,"Bot Ship");
  let calls=0;
  await enrichRosterKarma({get:async()=>{calls++;return 5;}},{status:"bot",accountId:77},"asia",()=>true,()=>{});
  assert.equal(calls,0);
});
