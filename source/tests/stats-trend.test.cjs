const test = require("node:test");
const assert = require("node:assert/strict");
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
