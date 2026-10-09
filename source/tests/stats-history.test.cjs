"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");

// stats-history
{

  const { DAY_MS, makeSnapshot, mergeSnapshot, recentFromSnapshots } = require("../electron/stats-history.cjs");

  test("calculates recent random-battle performance from cumulative snapshots", () => {
    const now = Date.UTC(2026, 8, 22);
    const current = { capturedAt: now, battles: 120, wins: 70, damageDealt: 12_000_000, xp: 240_000, frags: 130, survivedBattles: 60 };
    const prior = { capturedAt: now - 7 * DAY_MS, battles: 100, wins: 58, damageDealt: 9_800_000, xp: 196_000, frags: 108, survivedBattles: 49 };
    const result = recentFromSnapshots(current, [prior]);
    const seven = result.periods.find((item) => item.days === 7);
    assert.equal(seven.available, true);
    assert.equal(seven.battles, 20);
    assert.equal(seven.winRate, 60);
    assert.equal(seven.avgDamage, 110000);
    assert.equal(result.periods.find((item) => item.days === 30).available, false);
  });

  test("creates and compacts local cumulative snapshots", () => {
    const first = makeSnapshot({ cumulative: { battles: 10, wins: 6, damageDealt: 1000, xp: 500, frags: 8, survivedBattles: 4 } }, 1000);
    assert.equal(first.battles, 10);
    const updated = { ...first, capturedAt: 2000, battles: 11 };
    assert.deepEqual(mergeSnapshot([first], updated), [updated]);
  });
}

// stats-trend
{
  const { dailySnapshots, trendPoints, ratingValue } = require("../src/stats-trend.ts");
  const { aggregateRating, ratingValue: backendRating } = require("../electron/personal-rating.cjs");
  const { mergeSnapshot } = require("../electron/stats-history.cjs");
  const DAY=86400000, now = new Date(2026,8,30,12).getTime();
  const sample=(days,battles=100)=>({capturedAt:now-days*DAY,battles,wins:battles*.6,damageDealt:battles*100000,xp:battles*2000,frags:battles,survivedBattles:battles*.4});
  const aggregate=(battles,version="v1")=>({version,totalBattles:battles,coveredBattles:battles,damage:battles*100000,wins:battles*.6,frags:battles,expectedDamage:battles*100000,expectedWins:battles*.6,expectedFrags:battles});
  test("full history preserves old dates and the last actual sample per local day",()=>{
   const old=sample(500),a=sample(1),b={...a,capturedAt:a.capturedAt+1000,battles:110};
   assert.deepEqual(dailySnapshots([b,old,a]),[old,b]);
   const merged=mergeSnapshot([old,a],b);assert.deepEqual(merged,[old,b]);
   assert.equal(trendPoints(merged,"cumulative",now).length,2);
   assert.equal(trendPoints([sample(-1)],"cumulative",now).length,0);
  });
  test("bad samples and zero battle totals never produce non-finite chart values",()=>{
   assert.equal(dailySnapshots([null,{...sample(1),damageDealt:NaN},{...sample(1),wins:101}]).length,0);
   assert.equal(trendPoints([sample(0,0)],"cumulative",now)[0].values,null);
   assert.deepEqual(trendPoints([],"cumulative",now),[]);
  });
  test("intervals reflect actual multi-day totals and remain empty without battles or after reset",()=>{
   const prior=sample(5),current={...sample(0,120),wins:70,damageDealt:12400000};
   const result=trendPoints([prior,current],"interval",now);
   assert.equal(result[0].values,null);assert.equal(result[1].battles,20);assert.equal(result[1].values.winRate,50);assert.equal(result[1].values.avgDamage,120000);assert.equal(result[1].from,prior.capturedAt);
   assert.equal(trendPoints([prior,sample(0)],"interval",now)[1].values,null);
   assert.equal(trendPoints([prior,sample(0,50)],"interval",now)[1].values,null);
  });
  test("PR matches the WoWS Numbers published overall example and both implementations agree",()=>{
   const a={damage:378514,wins:4,frags:6,expectedDamage:256468.39600696,expectedWins:2.527045177502,expectedFrags:3.5488332672093};
   assert.equal(Math.round(ratingValue(a)),2227);assert.equal(ratingValue(a),backendRating(a));
   assert.equal(ratingValue(aggregate(100)),1150);
   assert.equal(ratingValue({...a,damage:0,wins:0,frags:0}),0);
   assert.equal(ratingValue({...a,expectedDamage:0}),null);
  });
  test("overall PR sums battle-weighted ship expectations and excludes missing ships with coverage",()=>{
   const table={version:"v1",data:{1:{average_damage_dealt:50000,average_frags:.5,win_rate:50},2:{average_damage_dealt:100000,average_frags:1,win_rate:60}}};
   const a=aggregateRating([{shipId:1,battles:2,avgDamage:80000,avgFrags:1,wins:1},{shipId:2,battles:1,avgDamage:120000,avgFrags:2,wins:1},{shipId:3,battles:7,avgDamage:100,avgFrags:0,wins:0}],table);
   assert.equal(a.expectedDamage,200000);assert.equal(a.expectedFrags,2);assert.equal(a.expectedWins,1.6);assert.equal(a.damage,280000);assert.equal(a.coveredBattles,3);assert.equal(a.totalBattles,10);
   assert.equal(aggregateRating([{shipId:3,battles:10,avgDamage:1,avgFrags:0,wins:0}],table),null);
  });
  test("PR intervals use aggregate differences and reject legacy or changed expectation versions",()=>{
   const a={...sample(1),pr:aggregate(100)},b={...sample(0,120),pr:aggregate(120)};
   const points=trendPoints([a,b],"interval",now);assert.equal(points[1].values.pr,1150);assert.equal(points[1].prCoverage,1);
   assert.equal(trendPoints([sample(1),b],"interval",now)[1].values.pr,null);
   assert.equal(trendPoints([a,{...b,pr:aggregate(120,"v2")}],"interval",now)[1].values.pr,null);
   const coverage=trendPoints([{...b,pr:{...aggregate(120),coveredBattles:60}}],"cumulative",now)[0];assert.equal(coverage.prCoverage,.5);
  });
}

// pr-grade
{
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
}
