// Native SVG maps: unannotated game terrain + grid + only the selected friendly waypoint/exit.
const fs = require('node:fs'), path = require('node:path');
const root = path.resolve(__dirname,'..'), file = path.join(root,'data/operations.json');
const catalog = JSON.parse(fs.readFileSync(file,'utf8'));
const terrainSource = 'https://github.com/WoWs-Builder-Team/minimap_renderer/tree/0cc781355535906f6f4817e40bc7d902325537b6/src/renderer/resources/spaces';
const escape = s => s.replaceAll('&','&amp;').replaceAll('<','&lt;');
const cell = s => ({x:(Number(s.slice(1))-.5)*10,y:(s.charCodeAt(0)-64.5)*10});
for (const op of catalog.operations) {
  op.bounds = [4,4,92,92]; op.terrainSource = terrainSource;
  op.overview.routeSelection = ['raptor','hermes','killer-whale'].includes(op.id);
  const png = fs.readFileSync(path.join(root,'public/operation-maps',op.id+'-clean.png')).toString('base64');
  const variants = op.overview.routeSelection ? op.routes : [{id:'overview',label:op.name}];
  for (const variant of variants) {
    const positions=[];
    if (op.id === 'raptor') {
      positions.push({x:48,y:variant.id.startsWith('north')?40:56,label:variant.id.startsWith('north')?'北航点':'南航点',waypoint:true});
      positions.push({x:5,y:variant.id.endsWith('north')?10:variant.id.endsWith('south')?93:43,label:'出口'});
    } else if(variant.exitCell) positions.push({...cell(variant.exitCell),label:variant.exitCell+' 出口'});
    const tags = [], reservations=[];
    for(const p of positions) {
      const x=4+p.x*.92,y=4+p.y*.92,width=p.waypoint?14:p.label==='出口'?10:14;
      const tx = p.waypoint ? x : x+(x>60?-11:11), ty=Math.max(6,y-8);
      tags.push(`<circle cx="${x}" cy="${y}" r="3.2" fill="#103641" stroke="#64dfd6" stroke-width=".5"/><rect x="${tx-width/2}" y="${ty-2.4}" width="${width}" height="4.8" rx="1.4" fill="#103641" stroke="#64dfd6" stroke-width=".35"/><text x="${tx}" y="${ty}" text-anchor="middle" dominant-baseline="central" fill="#88eae2" font-size="2.7">${p.label}</text>`);
      reservations.push({x,y,width:7,height:7},{x:tx,y:ty,width:width+1,height:6});
    }
    let grid='';
    for(let i=0;i<=10;i++) {const p=4+i*9.2;grid+=`<path d="M4 ${p}H96 M${p} 4V96" stroke="#83acb5" stroke-opacity=".22" stroke-width=".15"/>`;}
    for(let i=0;i<10;i++) {const p=4+(i+.5)*9.2;grid+=`<text x="${p}" y="99" text-anchor="middle">${i+1}</text><text x="98" y="${p}" text-anchor="middle" dominant-baseline="central">${String.fromCharCode(65+i)}</text>`;}
    const image=`/operation-maps/${op.id}-${variant.id}.svg`;
    const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><title>${escape(op.name+' · '+variant.label)}</title><rect width="100" height="100" fill="#122c38"/><image x="4" y="4" width="92" height="92" href="data:image/png;base64,${png}" opacity=".68"/><g font-family="sans-serif" font-size="2.6" fill="#a3bec5">${grid}</g>${tags.join('')}</svg>`;
    fs.writeFileSync(path.join(root,'public',image),svg);
    if(op.overview.routeSelection) {variant.image=image;variant.baseMarkers=reservations;} else op.image=image;
  }
  if(op.overview.routeSelection) op.image=op.routes[0].image;
  for(const group of op.overview.groups) {
    group.note=group.note.replace('青色点为航母或运输船通行位置。','').replace('；C1 为西侧航母北上通行格位。','。').replace('两个可能的撤离出口都在同一总图标出，敌舰点位不按出口分图。','当前出口在底图中标出；两种出口的敌舰刷新位置相同。');
    if(op.id==='raptor'&&group.number==='3')group.note='两艘航母为开局已存在的次要目标，这里只标初始位置；不再标后续通行格位。';
  }
}
fs.writeFileSync(file,JSON.stringify(catalog,null,2)+'\n');
fs.writeFileSync(path.join(root,'public/operation-maps/SOURCES.md'),`# 地形底图来源\n\n${terrainSource}\n\n底图为社区项目收录的游戏透明地形图层，保留原文件，原项目许可证见 MINIMAP_LICENSE.txt；游戏资源版权属于 Wargaming。\n本项目生成的 SVG 仅叠加网格及当前友方航点／出口，敌舰位置由独立数据层显示。\n参考点位：https://steamcommunity.com/sharedfiles/filedetails/?id=3392428008\n该攻略未包含 14.11 后变化，方向区域不作精确坐标保证。\n`);
