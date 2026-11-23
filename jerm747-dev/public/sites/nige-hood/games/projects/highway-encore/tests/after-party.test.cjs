const test = require('node:test');
const assert = require('node:assert/strict');
require('../street-game.js');

function advance(game, seconds) {
 for (let i=0; i<Math.ceil(seconds*120); i++) game.step(1/120);
}

test('the five-block night replay carries earned finds and ends at breakfast exactly once', () => {
 const events=[];
 const game=StreetGame.create({onEvent:event=>events.push(event)});
 game.reset();
 Object.assign(game.state,{collection:['tee'],tokens:1,goldMic:true});
 game.reset({afterParty:true});
 const night=game.state;
 assert.equal(night.areaName,'Backstage Alley');
 assert.equal(night.flashlightOn,true);
 game.press('right');game.press('flashlight');game.press('flashlight');
 advance(game,.25);
 assert.equal(night.flashlightOn,false);
 assert.ok(night.player.x>120);
 game.release('flashlight');
 // Walk straight to the street without taking the optional climb.
 advance(game,15.5);game.release('right');
 assert.equal(night.areaName,'Club Encore');
 assert.equal(night.flashlightOn,false);
 assert.equal(night.areas.length,5);
 assert.equal(night.areas[0].lootCrates[0].broken,true);
 assert.equal(night.areas[1].lootCrates[0].broken,false);
 assert.equal(night.encounter.rewarded,true);

 for(const [i,y] of [770,770,150,553].entries()){
  Object.assign(night.player,{x:1627,y,grounded:true});
  advance(game,.01);advance(game,1.1);
  assert.equal(night.areaIndex,i+1);
  assert.equal(night.areaName,StreetGame.areaName(i+1,true));
 }
 assert.equal(night.areaName,'Rooftop Café');
 night.player.x=1165;advance(game,.02);advance(game,15);
 assert.equal(night.mode,'finale');
 assert.equal(night.finale.beat,0);
 game.nextScene();assert.equal(night.finale.beat,1);
 game.nextScene();game.nextScene();
 assert.equal(night.mode,'complete');
 assert.deepEqual(events.filter(e=>e.type==='breakfast').map(e=>e.beat),[0,1]);
 assert.equal(events.filter(e=>e.type==='finale').length,0);
 assert.equal(events.filter(e=>e.type==='complete').length,1);
 assert.deepEqual(night.collection,['tee']);
 assert.equal(night.tokens,1);
 assert.equal(night.goldMic,true);

 game.reset({timed:true,afterParty:true,areaIndex:4});
 assert.equal(game.state.afterParty,false);
 game.press('flashlight');assert.equal(game.state.flashlightOn,false);
 assert.equal(game.state.areaIndex,0);
 assert.deepEqual(game.state.collection,[]);
 assert.equal(game.state.goldMic,false);
 assert.equal(game.state.timed,true);
});


test('earn the backpack by jumping the alley fire escape, shooting its crate, and touching the drop',()=>{
 const game=StreetGame.create();
 const s=game.reset({afterParty:true}),player=s.player,box=s.lootCrates[0];
 function walkTo(x){
  const right=player.x<x,dir=right?'right':'left';
  game.press(dir);
  for(let i=0;i<2000&&(right?player.x<x:player.x>x);i++)game.step(1/120);
  game.release(dir);advance(game,.55);
  assert.ok(Math.abs(x-player.x)<24);
 }
 function jump(){
  game.press('jump');advance(game,1.15);game.release('jump');advance(game,.45);
 }
 walkTo(s.blocks[0].x+19);jump();advance(game,1);
 walkTo(s.pickups[0].x);
 assert.equal(s.fireAmmo,3);
 for(const landing of s.platforms){
  walkTo(landing.x+5);jump();assert.equal(player.platform,landing.id);
 }
 walkTo(box.x-99);assert.equal(box.broken,false);
 game.press('fire');advance(game,.6);game.release('fire');
 assert.equal(box.broken,true);assert.equal(s.fireAmmo,2);
 assert.deepEqual(s.collection,[]);
 walkTo(box.x+37);assert.deepEqual(s.collection,['backpack']);

 game.press('right');advance(game,4.8);game.release('right');
 assert.equal(s.areaName,'Club Encore');
 game.press('left');advance(game,3.6);game.release('left');
 assert.equal(s.areaName,'Backstage Alley');
 assert.equal(s.lootCrates[0].broken,true);assert.deepEqual(s.lootDrops,[]);
 assert.deepEqual(s.collection,['backpack']);

 game.reset({afterParty:true});
 assert.equal(game.state.flashlightOn,true);
 assert.equal(game.state.lootCrates[0].broken,true);
 game.reset();assert.equal(game.state.areaName,'Café Block');
 assert.deepEqual(game.state.collection,[]);
});
