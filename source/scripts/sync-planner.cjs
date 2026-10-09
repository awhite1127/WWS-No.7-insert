"use strict";
const fs = require("node:fs/promises");
const path = require("node:path");
const { download, collect } = require("../electron/planner-download.cjs");
if(require.main===module)(async()=>{
  const dir=process.argv[2];const version=dir?JSON.parse(await fs.readFile(path.join(dir,"version.json"),"utf8")):await download("VersionInfo.json");
  const catalog=await collect(version,fetch,dir);const target=path.join(__dirname,"../public/planner-catalog.json.gz");
  await fs.mkdir(path.dirname(target),{recursive:true});
  await fs.writeFile(target,require("node:zlib").gzipSync(JSON.stringify(catalog),{level:9}));console.log(`Saved ${catalog.ships.length} ships / ${catalog.skills.length} skills / ${catalog.commanders.length} commanders / ${catalog.upgrades.length} upgrades. ${Math.round((await fs.stat(target)).size/1024)} KB, version ${catalog.version}`);
})().catch(e=>{console.error(e);process.exitCode=1;});
