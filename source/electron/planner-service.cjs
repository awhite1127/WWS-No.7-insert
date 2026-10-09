"use strict";
const fs = require("node:fs/promises");
const path = require("node:path");
const {gunzipSync} = require("node:zlib");
const {download,collect} = require("./planner-download.cjs");
function validCatalog(value) {
  if(value?.schema!==1 || !Number.isSafeInteger(value.revision) || !Array.isArray(value.ships) || value.ships.length<100 || !Array.isArray(value.skills) || value.skills.length<70 || !Array.isArray(value.upgrades) || !Array.isArray(value.commanders))throw new Error("配装数据不完整或版本不兼容");
  for(const type of ["Battleship","Cruiser","Destroyer","AirCarrier","Submarine"])if(!value.ships.some(s=>s.type===type))throw new Error("配装数据缺少舰种");
  return value;
}
function createPlannerService({cacheFile,fetcher=fetch,seedFile=path.join(__dirname,"../public/planner-catalog.json.gz"),collectCatalog=collect,onCatalog=()=>{},onStatus=()=>{}}) {
  let current,loading,updating;
  let startup,checking;
  let status={state:"idle",version:"",revision:0,shipCount:0,checkedAt:null,updated:false,error:""};
  function publish(patch){status={...status,...patch};onStatus({...status});}
  function catalogStatus(){return {version:current.version,revision:current.revision,shipCount:current.ships.length};}
  async function load(){if(current)return current;if(!loading)loading=(async()=>{try{current=validCatalog(JSON.parse(await fs.readFile(cacheFile,"utf8")));}catch{current=validCatalog(JSON.parse(gunzipSync(await fs.readFile(seedFile)).toString("utf8")));}onCatalog(current);publish(catalogStatus());return current;})();return loading;}
  async function get(force=false){await load();if(!force)return current;if(!updating)updating=(async()=>{const version=await download("VersionInfo.json",fetcher);if(!Number.isSafeInteger(version.currentVersionCode))throw new Error("远端舰船数据版本无效");if(version.currentVersionCode<=current.revision)return current;const next=validCatalog(await collectCatalog(version,fetcher));if(next.revision!==version.currentVersionCode)throw new Error("舰船数据版本不匹配");await fs.mkdir(path.dirname(cacheFile),{recursive:true});const temp=cacheFile+".tmp";await fs.writeFile(temp,JSON.stringify(next),"utf8");await fs.rename(temp,cacheFile);current=next;onCatalog(current);return current;})().finally(()=>{updating=null;});return updating;}
  function check(){
    if(!checking)checking=(async()=>{
      publish({state:"checking",error:"",updated:false});
      try{await load();const previous=current.revision;await get(true);publish({...catalogStatus(),state:"ready",checkedAt:Date.now(),updated:current.revision>previous,error:""});}
      catch(error){publish({state:"error",checkedAt:Date.now(),error:error instanceof Error?error.message:String(error)});}
      return {...status};
    })().finally(()=>{checking=null;});
    return checking;
  }
  function start(){if(!startup)startup=check();return startup;}
  async function getStatus(){await load();return {...status};}
  return {get,check,start,getStatus};
}
module.exports={createPlannerService,validCatalog};
