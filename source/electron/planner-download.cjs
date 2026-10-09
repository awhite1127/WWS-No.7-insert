"use strict";
const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");
const { normalizeData } = require("./planner-data.cjs");
const HOST = "https://d2nzlaerr9l5k3.cloudfront.net/api/live/";
async function download(file, fetcher = fetch, checksum) {
  const response = await fetcher(HOST + file, {signal:AbortSignal.timeout(45000)});
  if(!response.ok)throw new Error(`游戏数据 HTTP ${response.status}: ${file}`);
  const text = await response.text();
  if(text.length > 16000000) throw new Error("数据文件过大");
  if(checksum && crypto.createHash("sha256").update(text).digest("hex") !== checksum)throw new Error("数据校验失败: "+file);
  return JSON.parse(text);
}
async function collect(version, fetcher = fetch, localDirectory) {
  const raw = {ships:[],crew:[],upgrades:[],aircraft:{},projectiles:{},abilities:{}};
  const entries = ["Ship","Aircraft","Projectile","Crew","Ability","Modernization"].flatMap(cat=>(version.categories[cat] || []).map(f=>({cat,file:cat+"/"+f.fileName,checksum:f.checksum})));
  entries.push({cat:"zh",file:"Localization/zh_sg.json"},{cat:"en",file:"Localization/en.json"});
  let cursor=0;
  await Promise.all(Array.from({length:4}, async()=>{while(cursor<entries.length){const e=entries[cursor++];const value=localDirectory?JSON.parse(await fs.readFile(path.join(localDirectory,e.file.replaceAll("/","-")),"utf8")):await download(e.file,fetcher,e.checksum);if(e.cat==="Ship")raw.ships.push(...Object.values(value));else if(e.cat==="Crew")raw.crew.push(...Object.values(value));else if(e.cat==="Modernization")raw.upgrades.push(...Object.values(value));else Object.assign(raw[e.cat==="Aircraft"?"aircraft":e.cat==="Projectile"?"projectiles":e.cat==="Ability"?"abilities":e.cat] ||= {},value);}}));
  return normalizeData(raw,version,require("../data/wg-zh-sg-glossary.json"),require("../data/wg-en-ship-names.json"));
}
module.exports={download,collect,HOST};
