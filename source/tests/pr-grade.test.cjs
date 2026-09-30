const test=require("node:test"),assert=require("node:assert/strict");
const {prGrade}=require("../src/pr-grade.ts");
const {shipClassStats,aggregateRating,ratingValue}=require("../electron/personal-rating.cjs");
test("PR colors follow all WoWS Numbers boundaries and match displayed integer ratings",()=>{
 const values=[[0,"#fe0e00"],[749,"#fe0e00"],[750,"#fe7903"],[1100,"#ffc71f"],[1350,"#44b300"],[1550,"#318000"],[1723,"#318000"],[1750,"#02c9b3"],[2100,"#d042f3"],[2450,"#a00dc5"]];
 for(const [n,c] of values)assert.equal(prGrade(n).color,c);
 assert.equal(prGrade(1749.5).color,prGrade(1750).color);assert.equal(prGrade(null).min,null);assert.equal(prGrade(NaN).min,null);assert.equal(prGrade(-1).min,null);
});
const table={version:"v1",data:{1:{average_damage_dealt:50000,average_frags:.5,win_rate:50},2:{average_damage_dealt:100000,average_frags:1,win_rate:60}}};
const ship=(id,type,battles,wins,avgDamage,avgXp,avgFrags)=>({shipId:id,type,battles,wins,avgDamage,avgXp,avgFrags});
test("class summaries use battle weighted totals and aggregate expected values for PR",()=>{
 const ships=[ship(1,"Destroyer",10,4,40000,1000,.4),ship(2,"Destroyer",90,54,120000,2000,1.2),ship(1,"Battleship",20,15,90000,1500,.9)];
 const rows=shipClassStats(ships,table);assert.deepEqual(rows.map(r=>r.code),["DD","BB","CV","CL","SS"]);
 const dd=rows[0];assert.equal(dd.battles,100);assert(Math.abs(dd.winRate-58)<1e-10);assert.equal(dd.avgDamage,112000);assert.equal(dd.avgXp,1900);assert.equal(dd.pr,ratingValue(aggregateRating(ships.slice(0,2),table)));assert.equal(dd.prCoverage,1);
 assert.equal(rows[2].battles,0);assert.equal(rows[2].winRate,null);assert.equal(rows[2].pr,null);
});
test("classes keep unknown metadata visible and report missing expected coverage",()=>{
 const ships=[ship(1,"Cruiser",10,5,50000,1200,.5),ship(3,"Cruiser",30,20,60000,1300,.6),ship(1,"missing",5,3,50000,1000,.5),ship(1,"Submarine",-1,0,0,0,0)];
 const rows=shipClassStats(ships,table);assert.equal(rows[3].battles,40);assert.equal(rows[3].prCoverage,.25);assert.equal(rows[5].label,"未分类");assert.equal(rows[5].battles,5);assert.equal(rows[4].battles,0);
});
