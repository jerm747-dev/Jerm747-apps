const test=require('node:test');
const assert=require('node:assert/strict');
require('../street-game.js');
function tick(g,seconds){for(let i=0;i<Math.ceil(seconds*120);i++)g.step(1/120)}
function setup(options){
 const events=[],game=StreetGame.create({onEvent:e=>events.push(e)});game.reset(options);
 return {game,state:game.state,player:game.state.player,events};
}

test('ground chord, either order, gives one tuck, vertical drop and impact per press',()=>{
 for(const chord of [['down','flip'],['flip','down']]){
  const {game,player,events}=setup();const feet=player.y;
  for(const key of chord)game.press(key);
  tick(game,.16);assert.ok(player.y<feet-35&&player.poundTime>0);
  tick(game,.1);assert.ok(player.vy>600);
  game.press('jump');assert.equal(player.doubleJump,false);
  tick(game,1);assert.equal(player.y,feet);
  assert.equal(events.filter(e=>e.type==='poundImpact').length,1);
  assert.equal(player.poundTime,-1);
  for(const key of [...chord,'jump'])game.release(key);
  game.press('jump');tick(game,.1);assert.equal(player.grounded,false);
 }
});

test('tapping Down during the running flip attacks vertically and pause freezes the attack',()=>{
 const {game,player,events}=setup();game.press('right');game.press('speed');tick(game,.32);
 game.press('flip');tick(game,.24);game.release('flip');
 assert.ok(player.flip);game.press('down');assert.equal(player.poundTime,0);
 const x=player.x;tick(game,.12);game.setMode('paused');const t=player.poundTime;
 tick(game,.3);assert.equal(player.poundTime,t);game.setMode('run');
 tick(game,.6);assert.ok(Math.abs(player.x-x)<24);
 assert.equal(events.filter(e=>e.type==='poundImpact').length,1);
 assert.equal(events.some(e=>e.type==='dive'),false);
});

test('direct impact opens a supply, protects the fireball-only backpack and awards the two black finds independently',()=>{
 const {game,state}=setup();Object.assign(state,{collection:['tee','cap','vinyl'],goldMic:true});
 const s=game.reset({afterParty:true}),p=s.player;
 function stomp(block){
  Object.assign(p,{x:block.x+block.w/2,y:block.y,grounded:true,vy:0,vx:0});
  game.press('down');game.press('flip');tick(game,.8);game.release('down');game.release('flip');
 }
 stomp(s.blocks[0]);assert.ok(s.blocks[0].used);
 stomp(s.lootCrates[0]);assert.equal(s.lootCrates[0].broken,false);
 function exitRight(){Object.assign(p,{x:StreetGame.areaWidth(s.areaIndex)-45,y:770,grounded:true});tick(game,1.2)}
 const ammo=s.fireAmmo;
 for(const id of ['blackTee','blackCap']){
  exitRight();const crate=s.lootCrates.find(c=>c.item===id);
  assert.ok(!crate.broken&&s.lootCrates[0].broken);
  stomp(crate);assert.equal(crate.broken,true);
  tick(game,1);assert.ok(s.collection.includes(id));assert.equal(s.fireAmmo,ammo);
 }
 assert.deepEqual(s.collection,['tee','cap','vinyl','blackTee','blackCap']);
 assert.equal(StreetGame.merchTotal(true),6);assert.equal(StreetGame.merchTotal(false),3);
 const replay=game.reset({afterParty:true});assert.ok(replay.areas[0].lootCrates.every(c=>c.broken));
 game.reset({timed:true});assert.ok(!game.state.areas.flatMap(a=>a.lootCrates).some(c=>c.nightGear));
});
