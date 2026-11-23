const test=require('node:test'),assert=require('node:assert/strict');
require('../street-game.js');require('../encore-record.js');
const tick=(g,t)=>{for(let i=0;i<t*120;i++)g.step(1/120)};
test('five areas lead to one finale; shock precedes surprise and the smile follows it',()=>{
 let time=200,events=[];const g=StreetGame.create({now:()=>time,onEvent:e=>events.push(e)});g.reset({areaIndex:4,timed:true});assert.equal(g.state.areaIndex,0);
 g.state.collection.push('tee','vinyl');g.state.tokens=1;
 for(let i=0;i<4;i++){
  Object.assign(g.state.player,{x:1625,y:[770,770,150,553][i],grounded:true});time+=2000;g.step(1/120);
  assert.equal(g.state.mode,'transition');time+=1100;tick(g,1.1);assert.equal(g.state.areaIndex,i+1);
 }
 time+=420;g.setMode('paused');time+=10000;g.setMode('run');time+=580;
 g.state.player.x=1162;g.step(1/120);assert.equal(g.state.mode,'finale');assert.equal(g.state.finale.totalMs,9000);
 g.press('jump');g.nextScene();assert.equal(g.state.finale.beat,0);
 tick(g,1);assert.equal(g.state.finale.beat,1);tick(g,.8);assert.equal(g.state.finale.beat,2);
 tick(g,1);assert.equal(g.state.finale.beat,3);assert.equal(g.state.goldMic,false);
 tick(g,2.4);assert.equal(g.state.finale.beat,4);time+=10000;
 g.nextScene();g.nextScene();assert.equal(g.state.mode,'finale');assert.equal(g.state.goldMic,false);
 g.nextScene();g.nextScene();assert.equal(g.state.goldMic,true);assert.equal(g.state.mode,'complete');assert.equal(g.runMs(),9000);
 assert.deepEqual(events.filter(e=>e.type==='finale').map(e=>e.beat),[0,1,2,3,4,5,6]);
 assert.equal(events.filter(e=>e.type==='complete').length,1);assert.deepEqual(g.state.collection,['tee','vinyl']);assert.equal(g.state.tokens,1);
 g.reset({timed:true});assert.equal(g.state.areaIndex,0);assert.equal(g.runMs(),0);assert.equal(g.state.finale,null);assert.equal(g.state.goldMic,false);assert.deepEqual(g.state.collection,[]);assert.equal(g.state.tokens,0);
});
test('only timed finishes set the one device best; ties and slower runs keep it',()=>{
 let value=null;const store={getItem:()=>value,setItem:(k,v)=>value=v},rec=EncoreRecord.open(()=>store);
 assert.equal(rec.unlocked,false);assert.equal(rec.finish(false,1000).best,null);assert.equal(rec.unlocked,true);
 assert.equal(rec.finish(true,15306).previous,null);assert.equal(rec.finish(true,18001).best,15306);assert.equal(rec.finish(true,15306).improved,false);
 const winner=rec.finish(true,12020);assert.equal(winner.previous,15306);assert.equal(winner.best,12020);
 const reload=EncoreRecord.open(()=>store);assert.equal(reload.unlocked,true);assert.equal(reload.best,12020);assert.equal(EncoreRecord.format(61250),'1:01.25');
 assert.deepEqual(Object.keys(JSON.parse(value)).sort(),['bestMs','unlocked']);
});
test('corrupt or blocked storage does not prevent completion or session replay',()=>{
 const blocked=()=>{throw Error('blocked')},r=EncoreRecord.open(blocked);assert.equal(r.finish(true,12000).persistent,false);assert.equal(r.finish(true,18000).best,12000);
 const corrupt=EncoreRecord.open(()=>({getItem:()=>'{bad',setItem(){}}));assert.equal(corrupt.best,null);assert.equal(corrupt.finish(false,1000).best,null);
});
