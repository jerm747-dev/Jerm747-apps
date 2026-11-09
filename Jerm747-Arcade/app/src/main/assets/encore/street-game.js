/* Encore: deterministic movement, connected blocks and collectible fireballs. */
(() => {
'use strict';
const WORLD={width:1672,height:941,ground:770,playerHeight:128,halfWidth:22,finish:1560};
const platformData=[
 {id:'step-a',x:190,y:685,w:72,kind:'wood'},
 {id:'step-b',x:304,y:595,w:72,kind:'wood'},
 {id:'step-c',x:440,y:505,w:82,kind:'wood'},
 {id:'cafe-awning',x:34,y:382,w:506,kind:'ledge'},
 {id:'cafe-balcony',x:32,y:316,w:130,kind:'ledge'},
 {id:'balcony-step',x:530,y:284,w:88,kind:'wood'},
 {id:'center-balcony',x:757,y:310,w:430,kind:'ledge'},
 {id:'rooftop-step',x:660,y:194,w:82,kind:'wood'},
 {id:'rooftop',x:705,y:87,w:522,kind:'ledge'},
 {id:'shop-step-a',x:750,y:680,w:76,kind:'wood'},
 {id:'shop-step-b',x:858,y:585,w:76,kind:'wood'},
 {id:'shop-awning',x:702,y:477,w:490,kind:'ledge'},
 {id:'shop-step-c',x:1075,y:392,w:78,kind:'wood'},
 {id:'bench',x:963,y:653,w:129,kind:'ledge'},
 {id:'east-step',x:1360,y:680,w:76,kind:'wood'}
];
const AREA_NAMES=['Café Block','Sunset Market','Roofline Rise','Rooftop Run','The Listening Party'];
const NIGHT_AREAS=['Club Encore','Night Market','Moonrise Row','Moonlit Rooftops','Rooftop Café'];
// The alley is an unnumbered prelude; the five chapter indices stay stable.
const ALLEY=-1;
function areaWidth(index){return index===ALLEY?2460:WORLD.width}
function areaName(index,afterParty){if(index===ALLEY&&afterParty)return 'Backstage Alley';return (afterParty?NIGHT_AREAS:AREA_NAMES)[index]}
const DECK_Y=671, PARTY_MARK=1160;
const DAY_MERCH=[{id:'tee',name:'White NH T-shirt'},{id:'cap',name:'White NH cap'},{id:'vinyl',name:'Special-edition NH vinyl'}];
const MERCH=[...DAY_MERCH,{id:'backpack',name:'NH tour backpack',file:'night-backpack-v13.webp'},
 {id:'blackTee',name:'Black NH tour tee',file:'night-black-tee-v14.webp'},
 {id:'blackCap',name:'Black NH snapback',file:'night-black-cap-v14.webp'}];
function merchTotal(afterParty){return afterParty?MERCH.length:DAY_MERCH.length}
// The third block is a climb. Its right exit exists only on the highest roof.
const risePlatforms=[{"id": "rise-step-1", "x": 165, "y": 685, "w": 100, "kind": "wood"}, {"id": "rise-awning-west", "x": 40, "y": 607, "w": 268, "kind": "ledge"}, {"id": "rise-west", "x": 0, "y": 494, "w": 330, "kind": "ledge"}, {"id": "rise-center-west", "x": 320, "y": 410, "w": 327, "kind": "ledge"}, {"id": "rise-center", "x": 638, "y": 332, "w": 339, "kind": "ledge"}, {"id": "rise-center-east", "x": 966, "y": 250, "w": 339, "kind": "ledge"}, {"id": "rise-east", "x": 1292, "y": 150, "w": 380, "kind": "ledge"}, {"id": "rise-awning-0", "x": 345, "y": 596, "w": 286, "kind": "ledge"}, {"id": "rise-awning-1", "x": 674, "y": 574, "w": 290, "kind": "ledge"}, {"id": "rise-awning-2", "x": 998, "y": 573, "w": 296, "kind": "ledge"}, {"id": "rise-awning-3", "x": 1340, "y": 566, "w": 309, "kind": "ledge"}, {"id": "rise-return-0", "x": 510, "y": 685, "w": 100, "kind": "wood"}, {"id": "rise-return-1", "x": 835, "y": 680, "w": 100, "kind": "wood"}, {"id": "rise-return-2", "x": 1160, "y": 680, "w": 100, "kind": "wood"}, {"id": "rise-return-3", "x": 1470, "y": 675, "w": 100, "kind": "wood"}, {"id": "rise-return-4", "x": 1430, "y": 452, "w": 100, "kind": "wood"}, {"id": "rise-return-5", "x": 1300, "y": 345, "w": 100, "kind": "wood"}];
const roofPlatforms=[{"id": "roof-west", "x": 0, "y": 552, "w": 310, "kind": "ledge"}, {"id": "roof-west-mid", "x": 319, "y": 491, "w": 326, "kind": "ledge"}, {"id": "roof-center", "x": 654, "y": 552, "w": 351, "kind": "ledge"}, {"id": "roof-east-mid", "x": 1014, "y": 520, "w": 341, "kind": "ledge"}, {"id": "roof-east", "x": 1365, "y": 553, "w": 307, "kind": "ledge"}, {"id": "roof-high-0", "x": 185, "y": 405, "w": 100, "kind": "wood"}, {"id": "roof-high-1", "x": 495, "y": 350, "w": 100, "kind": "wood"}, {"id": "roof-high-2", "x": 780, "y": 390, "w": 100, "kind": "wood"}, {"id": "roof-high-3", "x": 1100, "y": 365, "w": 100, "kind": "wood"}, {"id": "roof-high-4", "x": 1450, "y": 400, "w": 100, "kind": "wood"}];
// Building tops stay solid; steps, awnings, balconies and fire escapes allow a drop.
const SOLID_ROOFS=new Set(['rooftop','market-roof-west','market-roof-center','market-roof-east',
 'rise-west','rise-center-west','rise-center','rise-center-east','rise-east',
 'roof-west','roof-west-mid','roof-center','roof-east-mid','roof-east']);
const platformsFor=data=>data.map(p=>({...p,dropThrough:!SOLID_ROOFS.has(p.id)}));
function idlePose(seconds){return seconds<2.6?0:seconds<4?1:seconds<5.2?2:seconds<6.5?3:seconds<8?1:4}
function lootCrate(item,x,y,amplitude=0){return {item,x,y,baseY:y,w:74,h:74,amplitude,phase:x*.013,broken:false,kind:'loot'}}
function quietEncounter(){return {partner:0,status:'unavailable',line:0,rewarded:false}}

function backstageAlley(){
 const landings=[[1175,662,165],[1330,552,175],[1490,444,185],[1660,337,205],[1835,226,335]];
 return {
  platforms:platformsFor(landings.map(([x,y,w],i)=>({id:'alley-landing-'+i,x,y,w,kind:'fireEscape'}))),
  blocks:[crate(1000,555)],pickups:[],walkers:[],encounter:quietEncounter(),
  lootCrates:[lootCrate('backpack',2070,152)],lootDrops:[]
 };
}

const marketPlatforms=[
 {id:'market-step-1',x:180,y:685,w:84,kind:'wood'},
 {id:'market-step-2',x:290,y:595,w:84,kind:'wood'},
 {id:'market-awning-west',x:40,y:482,w:390,kind:'ledge'},
 {id:'market-step-3',x:350,y:390,w:80,kind:'wood'},
 {id:'market-fire-escape-west',x:40,y:350,w:215,kind:'metal'},
 {id:'market-step-4',x:340,y:285,w:85,kind:'wood'},
 {id:'market-roof-west',x:415,y:220,w:435,kind:'metal'},
 {id:'market-roof-center',x:875,y:264,w:395,kind:'metal'},
 {id:'market-roof-east',x:1370,y:162,w:245,kind:'metal'},
 {id:'market-roof-step',x:1300,y:228,w:76,kind:'wood'},
 {id:'market-stand-1',x:570,y:682,w:110,kind:'wood'},
 {id:'market-stand-2',x:720,y:590,w:94,kind:'wood'},
 {id:'market-awning-center',x:456,y:482,w:388,kind:'ledge'},
 {id:'market-middle-step',x:860,y:387,w:80,kind:'wood'},
 {id:'market-awning-east',x:882,y:482,w:360,kind:'ledge'},
 {id:'market-stand-3',x:1040,y:680,w:100,kind:'wood'},
 {id:'market-stand-4',x:1165,y:590,w:95,kind:'wood'},
 {id:'market-stand-5',x:1390,y:682,w:90,kind:'wood'},
 {id:'market-stand-6',x:1490,y:588,w:82,kind:'wood'},
 {id:'market-awning-far',x:1285,y:482,w:355,kind:'ledge'},
 {id:'market-fire-escape-east',x:1390,y:418,w:228,kind:'metal'},
 {id:'market-fire-step',x:1285,y:325,w:80,kind:'wood'}
];
const marketCrates=[
 {x:405,y:550},{x:920,y:550},{x:1295,y:550},
 {x:505,y:270},{x:1120,y:270},{x:695,y:12},{x:1510,y:-44}
];
function crate(x,y){return {x,y,w:66,h:66,used:false,bump:0}}
const script=[
 {speaker:'npc',text:"Hey, don’t I know you from somewhere?"},
 {speaker:'nige',text:"I’m not sure. You look familiar, though."},
 {speaker:'npc',text:"I think I saw you at open mic night."},
 {speaker:'nige',text:"Yeah, that was me. I did the show with the live band."},
 {speaker:'npc',text:"Great to see you. Keep doing your thing. Here’s a token for the merchant shop."},
 {speaker:'nige',text:"Appreciate you. Catch you at the next one."}
];
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const approach=(v,to,delta)=>v<to?Math.min(to,v+delta):Math.max(to,v-delta);
// Pixels/second and pixels/second². Skid lasts ~.36 s at full run speed.
const MOTION={walk:172,run:304,boost:416,acceleration:1600,releaseFriction:2100,skidFriction:850,airAcceleration:640,anticipation:.05,poundTuck:.24,landing:.24,dropWindow:.36};
function create({random=Math.random,onEvent=()=>{}, now=null}={}){
 let s;const held=new Set();let lastTap={left:-Infinity,right:-Infinity},lastDown={time:-Infinity,platform:null};
 function emit(type,data){onEvent({type,...data})}
 function reset({areaIndex=0,timed=false,afterParty=false}={}){
  if(timed){areaIndex=0;afterParty=false}
  // This walk continues the completed chapter. Bring earned items along.
  const keepsakes=afterParty&&s ? {
   collection:[...s.collection],tokens:s.tokens,goldMic:s.goldMic
  } : {collection:[],tokens:0,goldMic:false};

  held.clear();
  lastTap={left:-Infinity,right:-Infinity};lastDown={time:-Infinity,platform:null};
  const partner=Math.floor(random()*2)%2;
  s={mode:'run',time:0,elapsed:0,timed,afterParty,clockStart:now?now():null,activeMs:0,finale:null,goldMic:false,camera:{x:0,y:340},tokens:0,fireAmmo:0,areaIndex:0,areaName:areaName(0,afterParty),transition:null,fade:0,shots:[],fizzles:[],pickups:[],finishVisited:false,collection:[],lootDrops:[],debris:[],blasts:[],talkAvailable:false,lootCrates:[lootCrate('tee',1190,687,5)],
   encounter:{partner,status:'available',line:0,rewarded:false},
   player:{x:105,y:WORLD.ground,vx:0,vy:0,facing:1,grounded:true,platform:'ground',duck:false,squat:0,squatRising:false,idleTime:0,dropping:false,dropY:null,dropTimer:0,coyote:.1,buffer:0,wantsFlip:false,flip:false,flipElapsed:0,flipAngle:0,flipUsed:false,phase:0,land:0,skid:false,runLatch:false,runGrace:0,launchQueued:false,takeoffDelay:0,jumpShort:false,airTime:0,jumpKind:'hop',running:false,boosting:false,airCarry:0,fireCooldown:0,fireFlash:0,throwTime:-1,throwFacing:1,throwReleased:false,airJumpUsed:false,doubleJump:false,doubleTime:0,dive:false,diveTime:0,diveUsed:false,poundTime:-1,lastSafe:{x:105,y:770}},
   platforms:platformsFor(platformData),
   walkers:[{id:0,type:0,x:410,y:WORLD.ground,speed:18,dir:1,lo:350,hi:490,phase:0},{id:1,type:1,x:530,y:WORLD.ground,speed:17,dir:-1,lo:470,hi:590,phase:1.5},{id:2,type:0,x:880,y:WORLD.ground,speed:22,dir:-1,lo:720,hi:1120,phase:.5},{id:3,type:1,x:1280,y:WORLD.ground,speed:25,dir:1,lo:1130,hi:1550,phase:2}],
   blocks:[crate(620,551),crate(1020,100),crate(1340,460)],
   particles:[],lastMessage:'Walk the street. Try the upper route.',messageTime:4};
  s.areas=[{platforms:s.platforms,walkers:s.walkers,blocks:s.blocks,pickups:s.pickups,encounter:s.encounter,lootCrates:s.lootCrates,lootDrops:s.lootDrops},
   {platforms:platformsFor(marketPlatforms),blocks:marketCrates.map(b=>crate(b.x,b.y)),pickups:[],
    walkers:[{id:0,type:0,x:865,y:WORLD.ground,speed:19,dir:1,lo:760,hi:990,phase:0},{id:1,type:1,x:1300,y:WORLD.ground,speed:21,dir:-1,lo:1190,hi:1400,phase:1}],
    encounter:quietEncounter(),lootCrates:[lootCrate('cap',1050,398,10)],lootDrops:[]},
   {platforms:platformsFor(risePlatforms),blocks:[crate(370,205),crate(730,125),crate(1300,-45)],pickups:[],walkers:[],encounter:quietEncounter(),lootCrates:[lootCrate('vinyl',1490,64,8)],lootDrops:[]},
   {platforms:platformsFor(roofPlatforms),blocks:[crate(355,275),crate(920,335),crate(1250,310)],pickups:[],walkers:[],encounter:quietEncounter(),lootCrates:[],lootDrops:[]},
   {platforms:[{id:'party-deck',x:0,y:DECK_Y,w:WORLD.width,kind:'terrace',dropThrough:false}],blocks:[],pickups:[],walkers:[],encounter:quietEncounter(),lootCrates:[],lootDrops:[]}];
  Object.assign(s,keepsakes);
  s.flashlightOn=afterParty;
  if(afterParty){
   // Clubgoers wear the brightest colors on the first block.
   s.walkers[0].wristLight='#62e4e6';s.walkers[1].wristLight='#f387dd';
   s.walkers.push({id:4,type:1,x:180,y:WORLD.ground,speed:24,dir:1,lo:125,hi:360,phase:1,wristLight:'#fbb772'});
   s.areas[1].walkers.push({id:2,type:0,x:305,y:WORLD.ground,speed:20,dir:-1,lo:260,hi:540,phase:2});
   // Each night edition is a separate find, even if its white counterpart was earned.
   s.areas[0].lootCrates.push({...lootCrate('blackTee',355,308),nightGear:true});
   s.areas[1].lootCrates.push({...lootCrate('blackCap',167,276),nightGear:true});
   s.alley=backstageAlley();
   for(const area of [s.alley,...s.areas]){
    for(const crate of area.lootCrates)crate.broken=s.collection.includes(crate.item);
   }
   if(s.tokens>0)Object.assign(s.encounter,{status:'completed',rewarded:true});
  }
  if(afterParty&&areaIndex===0){
   s.areaIndex=ALLEY;s.areaName=areaName(ALLEY,true);Object.assign(s,s.alley);
  }
  if(Number.isInteger(areaIndex)&&areaIndex>0&&areaIndex<s.areas.length){s.areaIndex=areaIndex;s.areaName=areaName(areaIndex,afterParty);Object.assign(s,s.areas[areaIndex]);}
  if(s.areaIndex===3){Object.assign(s.player,{y:552,platform:'roof-west',lastSafe:{x:105,y:552}});s.camera.y=137;}
  if(s.areaIndex===4){Object.assign(s.player,{y:DECK_Y,platform:'party-deck'});s.camera.y=DECK_Y-415;}
  emit('reset');return s;
 }
 function message(text){s.lastMessage=text;s.messageTime=3.3;emit('message',{text})}
 function clearInput(){held.clear();lastTap={left:-Infinity,right:-Infinity};lastDown={time:-Infinity,platform:null};if(s){Object.assign(s.player,{buffer:0,wantsFlip:false,launchQueued:false,takeoffDelay:0,runLatch:false,runGrace:0,skid:false,boosting:false})}}
 // Count real time under player control; pauses, fades, conversations and the encore are off the clock.
 function runMs(){return Math.round(now?s.activeMs+(s.clockStart===null?0:now()-s.clockStart):s.elapsed*1000)}
 function changeMode(value){
  if(now&&s.mode!==value){if(s.clockStart!==null)s.activeMs+=now()-s.clockStart;
   s.clockStart=value==='run'?now():null;}
  s.mode=value;
 }
 function mode(value){changeMode(value);clearInput()}
 function startFinale(){
  mode('finale');s.finale={beat:0,age:0,totalMs:runMs()};s.talkAvailable=false;s.shots=[];s.fizzles=[];
  Object.assign(s.player,{facing:1,vx:86,vy:0,running:false,duck:false,squat:0,land:0,throwTime:-1});
  s.lastMessage='';emit('message',{text:''});
  if(s.afterParty){s.player.vx=0;emit('breakfast',{beat:0})}
  else emit('finale',{beat:0});

 }
 function nextBeat(){
  if(s.mode!=='finale')return;
  const f=s.finale;f.age=0;f.beat++;
  if(f.beat===7){s.goldMic=true;changeMode('complete');emit('sound',{name:'reward'});emit('complete');return;}
  emit('finale',{beat:f.beat});
 }
 function nextScene(){
  if(s.mode!=='finale')return;
  if(s.afterParty){
   if(s.finale.beat===0){s.finale.beat=1;emit('breakfast',{beat:1})}
   else {changeMode('complete');emit('complete')}
   return;
  }
  if(s.finale.beat>=4)nextBeat();
 }
 function updateFinale(dt,w,h){
  const f=s.finale,p=s.player;f.age+=dt;
  if(f.beat<2){p.x=Math.min(1325,p.x+86*dt);p.phase+=86*dt/150;p.vx=86;}
  else {p.vx=0;p.idleTime+=dt;}
  const holds=[.80,.77,1.12,2.25];
  if(f.beat<4&&f.age>=holds[f.beat])nextBeat();
  updateCamera(dt,w,h);
 }
 function press(key){
  if(!['run','transition'].includes(s.mode)||held.has(key))return;
  if(key==='flashlight'){
   if(s.afterParty){held.add(key);s.flashlightOn=!s.flashlightOn}
   return;
  }
  if(s.mode==='transition'&&!['left','right','speed'].includes(key))return;
  held.add(key);s.player.idleTime=0;
  const p=s.player;
  if(p.poundTime>=0&&['jump','flip','down','fire'].includes(key))return;
  const poundChord=(key==='flip'&&held.has('down'))||(key==='down'&&(held.has('flip')||p.flip||(p.wantsFlip&&p.buffer>0)));
  if(poundChord&&!p.dive){startPound();return}
  if(key==='down'){
   const floor=dropSurface();
   if(floor&&lastDown.platform===floor.id&&s.time-lastDown.time<=MOTION.dropWindow){dropDown(floor);lastDown={time:-Infinity,platform:null}}
   else lastDown={time:s.time,platform:floor?.id??null};
   return;
  }
  if(key==='fire'){throwFire();return}
  if(key==='talk'){talk();return}
  if(key==='left'||key==='right'){
   if(s.time-lastTap[key]<.28||s.player.runGrace>0)s.player.runLatch=true;
   lastTap[key]=s.time;
  }
  if(key==='jump'){
   const p=s.player;if(p.dive)return;
   if(!p.grounded&&p.coyote<=0&&!p.airJumpUsed){doubleHop();return}
   p.buffer=.14;p.wantsFlip=false;p.jumpShort=false;
  }
  if(key==='flip'){
   if(s.player.dive)return;
   if(!s.player.grounded&&(s.player.flipUsed||s.player.doubleJump)){dive();return}
   if(s.player.grounded||s.player.coyote>0){s.player.buffer=.14;s.player.wantsFlip=true;s.player.jumpShort=false}
   else if(!s.player.flipUsed&&!s.player.doubleJump){s.player.flip=true;s.player.flipUsed=true;s.player.flipElapsed=0;emit('sound',{name:'flip'})}
  }
 }
 function dropSurface(){
  const p=s.player;
  return p.grounded?s.platforms.find(a=>a.id===p.platform&&a.dropThrough):null;
 }
 function dropDown(floor){
  const p=s.player;
  Object.assign(p,{grounded:false,platform:null,vy:70,y:p.y+2,coyote:0,buffer:0,
   launchQueued:false,takeoffDelay:0,wantsFlip:false,flip:false,flipUsed:false,flipAngle:0,
   duck:false,squat:0,squatRising:false,land:0,skid:false,airTime:.2,
   dropping:true,dropY:floor.y,dropTimer:.28,airCarry:Math.abs(p.vx),idleTime:0,throwTime:-1,
   airJumpUsed:false,doubleJump:false,doubleTime:0,dive:false,diveUsed:false});
  emit('drop',{platform:floor.id});
 }
 function release(key){
  if(!held.delete(key))return;
  if(key==='jump'){s.player.jumpShort=true;if(s.player.poundTime<0&&s.player.vy< -350&&!s.player.flip&&!s.player.doubleJump)s.player.vy=-350}
  if((key==='left'||key==='right')&&!held.has('left')&&!held.has('right')&&s.player.runLatch)s.player.runGrace=.16;
 }
 function sparks(x,y,count=9){
  for(let i=0;i<count;i++)s.particles.push({x,y,vx:(i-count/2)*20,vy:-75-(i%3)*30,life:.5+(i%3)*.1});
 }
 function openCrate(b){
  b.bump=.24;
  // A missed shot in the alley can be retried at the same supply box.
  const canRefill=s.areaIndex===ALLEY&&!s.fireAmmo&&!s.pickups.length&&!s.shots.length&&!s.lootCrates[0].broken;
  if(b.used&&!canRefill)return false;
  b.used=true;
  const direction=s.player.x<b.x+b.w/2?-1:1;
  s.pickups.push({x:b.x+b.w/2,y:b.y-18,vx:direction*105,vy:-200,age:0,bounces:0,rest:false,amount:3});
  sparks(b.x+b.w/2,b.y);message('Fireball! Catch it for 3 throws.');emit('sound',{name:'crate'});return true;
 }
 // The hand cocks beside the ear, then releases on frame three.
 function throwFire(){
  const p=s.player;if(p.poundTime>=0||p.fireCooldown>0||p.throwTime>=0||p.flip||p.dive)return;
  if(!s.fireAmmo){message('Head-bump a gold crate to find fireballs.');return}
  p.fireCooldown=.36;p.throwTime=0;p.throwFacing=p.facing;p.throwReleased=false;
 }
 function updateThrow(dt){
  const p=s.player;if(p.throwTime<0)return;
  if(p.flip||p.dive){p.throwTime=-1;return}
  p.throwTime+=dt;
  if(!p.throwReleased&&p.throwTime>=.14){
   p.throwReleased=true;
   if(s.fireAmmo>0){
    s.fireAmmo--;p.fireFlash=.07;
    const height=p.duck?64:89;
    s.shots.push({x:p.x+p.throwFacing*44,y:p.y-height,vx:p.throwFacing*540,vy:120,life:5,bounces:0});
    emit('sound',{name:'fire'});emit('fire',{ammo:s.fireAmmo});
   }
  }
  if(p.throwTime>=.34)p.throwTime=-1;
 }
 function fizzle(shot,reason){
  shot.life=0;
  s.fizzles.push({x:shot.x,y:shot.y,age:0,life:.55,vx:shot.vx*.035});
  emit('fizzle',{reason});
 }
 function breakLoot(b){
  if(b.broken)return false;b.broken=true;
  s.lootDrops.push({item:b.item,x:b.x+b.w/2,y:b.y+25,vy:-220,age:0,rest:false});
  s.blasts.push({x:b.x+b.w/2,y:b.y+b.h/2,life:.4});
  for(let i=0;i<18;i++)s.debris.push({x:b.x+b.w/2,y:b.y+b.h/2,vx:Math.cos(i*2.4)*(90+i%4*35),vy:-90-(i%6)*35,angle:i,spin:(i%2?1:-1)*5,w:7+i%4*4,h:4+i%3*3,life:.65+i%3*.1});
  message('Crate smashed! Grab the '+MERCH.find(m=>m.id===b.item).name+'.');
  emit('sound',{name:'smash'});emit('lootBreak',{item:b.item});return true;
 }
 function updateLoot(dt){
  for(const b of s.lootCrates)if(!b.broken)b.y=b.baseY+Math.sin(s.time*1.7+b.phase)*b.amplitude;
  for(const d of s.lootDrops){
   d.age+=dt;const oldY=d.y;d.vy=Math.min(480,d.vy+520*dt);d.y+=d.vy*dt;
   const floor=surfaces().filter(a=>d.x+16>a.x&&d.x-16<a.x+a.w&&oldY+20<=a.y+.5&&d.y+20>=a.y&&d.vy>=0).sort((a,b)=>a.y-b.y)[0];
   if(floor){d.y=floor.y-20;d.vy=0;d.rest=true;}
   const p=s.player;
   if(d.age>.22&&Math.abs(d.x-p.x)<45&&d.y>p.y-150&&d.y<p.y+20){
    d.collected=true;
    if(!s.collection.includes(d.item)){
     s.collection.push(d.item);emit('merch',{item:d.item,count:s.collection.length});emit('sound',{name:'reward'});
     const total=merchTotal(s.afterParty),full=s.collection.length===total;
     const name=MERCH.find(m=>m.id===d.item).name;
     message(full?'FULL SET! '+name+' completes your collection.':name+' collected · '+s.collection.length+'/'+total);
     if(full){s.celebrate=3.8;sparks(p.x,p.y-90,24);}
    }
   }
  }
  for(let i=s.lootDrops.length-1;i>=0;i--)if(s.lootDrops[i].collected)s.lootDrops.splice(i,1);
 }
 function surfaces(){return [{x:0,y:WORLD.ground,w:areaWidth(s.areaIndex)},...s.platforms,...s.blocks,...s.lootCrates.filter(b=>!b.broken)]}
 function updateFire(dt,w,h){
  for(const orb of s.pickups){
   orb.age+=dt;const oldY=orb.y;orb.vy=Math.min(500,orb.vy+620*dt);orb.x+=orb.vx*dt;orb.y+=orb.vy*dt;
   if(orb.x<18||orb.x>areaWidth(s.areaIndex)-18){orb.x=clamp(orb.x,18,areaWidth(s.areaIndex)-18);orb.vx*=-.65}
   const floor=surfaces().filter(a=>orb.x+10>a.x&&orb.x-10<a.x+a.w&&oldY+12<=a.y+.5&&orb.y+12>=a.y&&orb.vy>=0).sort((a,b)=>a.y-b.y)[0];
   if(floor){orb.y=floor.y-12;orb.bounces++;orb.vy=orb.bounces<3?-145/orb.bounces:0;orb.vx=approach(orb.vx,0,orb.bounces<3?20:200);orb.rest=orb.bounces>=3}
   const p=s.player;
   if(!orb.collected&&orb.age>.18&&Math.abs(orb.x-p.x)<38&&orb.y>p.y-(p.duck?88:128)-16&&orb.y<p.y+12){
    orb.collected=true;s.fireAmmo+=orb.amount;sparks(orb.x,orb.y,6);message('+3 fireballs · Tap Fire or press F.');emit('sound',{name:'reward'});emit('pickup',{ammo:s.fireAmmo});
   }
  }
  // Mutate in place so inactive areas retain their uncollected pickups.
  for(let i=s.pickups.length-1;i>=0;i--)if(s.pickups[i].collected)s.pickups.splice(i,1);
  for(const shot of s.shots){
   const oldY=shot.y;shot.life-=dt;shot.vy+=650*dt;shot.x+=shot.vx*dt;shot.y+=shot.vy*dt;
   // Retire before collision checks: an expired or offscreen shot cannot hit anything.
   if(shot.life<=0){fizzle(shot,'expired');continue}
   if(shot.x+11<s.camera.x||shot.x-11>s.camera.x+w||shot.y+11<s.camera.y||shot.y-11>s.camera.y+h||shot.x<0||shot.x>areaWidth(s.areaIndex)){fizzle(shot,'offscreen');continue}
   for(const b of s.lootCrates){if(!b.broken&&shot.x+11>b.x&&shot.x-11<b.x+b.w&&shot.y+11>b.y&&shot.y-11<b.y+b.h){breakLoot(b);shot.life=0;break}}
   if(shot.life<=0)continue;
   for(const b of s.blocks){if(shot.x+11>b.x&&shot.x-11<b.x+b.w&&shot.y+11>b.y&&shot.y-11<b.y+b.h){openCrate(b);fizzle(shot,'impact');break}}
   if(shot.life<=0)continue;
   const floor=surfaces().filter(a=>shot.x>a.x&&shot.x<a.x+a.w&&oldY+10<=a.y+.5&&shot.y+10>=a.y&&shot.vy>=0).sort((a,b)=>a.y-b.y)[0];
   if(floor){shot.y=floor.y-10;shot.vy=-270;shot.bounces++}
  }
  s.shots=s.shots.filter(p=>p.life>0);
 }
 function beginTransition(direction){
  if(s.transition)return;
  const target=s.areaIndex+direction;
  if(target<(s.afterParty?ALLEY:0)||target>=s.areas.length)return;
  changeMode('transition');s.transition={elapsed:0,target,direction,swapped:false};s.fade=0;
  s.player.vx=0;s.player.vy=0;s.player.buffer=0;s.player.launchQueued=false;s.player.throwTime=-1;s.player.fireCooldown=0;s.player.idleTime=0;lastDown={time:-Infinity,platform:null};
  s.talkAvailable=false;
  for(const key of ['jump','flip','down','fire','talk'])held.delete(key);
  emit('transition',{areaName:areaName(target,s.afterParty)});
 }
 function updateTransition(dt,w,h){
  const t=s.transition;t.elapsed+=dt;
  s.fade=t.elapsed<.45?t.elapsed/.45:t.elapsed<.63?1:Math.max(0,1-(t.elapsed-.63)/.45);
  if(t.elapsed>=.54&&!t.swapped){
   t.swapped=true;s.areaIndex=t.target;s.areaName=areaName(t.target,s.afterParty);
   Object.assign(s,t.target===ALLEY?s.alley:s.areas[t.target]);
   Object.assign(s.player,{x:t.direction>0?96:areaWidth(s.areaIndex)-96,y:WORLD.ground,vx:0,vy:0,facing:t.direction,grounded:true,platform:'ground',flip:false,flipUsed:false,flipAngle:0,duck:false,squat:0,squatRising:false,idleTime:0,dropping:false,dropY:null,dropTimer:0,boosting:false,airCarry:0,throwTime:-1,land:0,skid:false,launchQueued:false,takeoffDelay:0,buffer:0,coyote:.1,airTime:0,fireFlash:0,airJumpUsed:false,doubleJump:false,doubleTime:0,dive:false,diveTime:0,diveUsed:false,poundTime:-1});
   if(t.target===3){s.player.y=t.direction>0?552:553;s.player.platform=t.direction>0?'roof-west':'roof-east'}
   if(t.target===4){s.player.y=DECK_Y;s.player.platform='party-deck'}
   if(t.target===2&&t.direction<0){s.player.y=150;s.player.platform='rise-east'}
   s.player.lastSafe={x:s.player.x,y:s.player.y};
   s.shots=[];s.fizzles=[];s.particles=[];s.debris=[];s.blasts=[];s.camera.x=t.direction>0?0:Math.max(0,areaWidth(s.areaIndex)-w);s.camera.y=clamp(s.player.y-h*.73,-480,Math.max(0,WORLD.height-h));
   emit('area',{index:s.areaIndex,name:s.areaName});
  }
  if(t.elapsed>=1.08){s.transition=null;s.fade=0;changeMode('run');message(s.afterParty?(s.areaIndex===ALLEY?'Backstage Alley · Look for the fire escape.':s.areaIndex===0?'Club Encore · Back under the streetlights.':s.areaIndex===4?'Coffee’s on. Meet the server under the canopy.':s.areaIndex===2?'Moonrise Row · Climb to the high exit.':s.areaName+' · Follow the rooftops east.'):s.areaIndex===4?'Music up ahead. Walk over to the canopy.':s.areaIndex===2?'Roofline Rise · Climb to the rooftop exit.':s.areaIndex===3?'Rooftop Run · Keep going across the skyline.':s.areaName+' · Find the fireball crates.');}
 }
 function canTalk(){const p=s.player,n=s.walkers[s.encounter.partner];return s.mode==='run'&&s.encounter.status==='available'&&n&&p.grounded&&p.platform==='ground'&&Math.abs(p.x-n.x)<110}
 function talk(){if(canTalk()){beginEncounter();return true}return false}
 function beginEncounter(){
  s.talkAvailable=false;
  changeMode('dialogue');s.encounter.status='talking';s.encounter.line=0;
  s.player.vx=0;s.player.vy=0;
  s.player.facing=s.walkers[s.encounter.partner].x>s.player.x?1:-1;
  s.walkers[s.encounter.partner].dir=-s.player.facing;
  clearInput();emit('dialogue',{line:script[0],index:0,partner:s.encounter.partner});
 }
 function endEncounter(completed){
  if(s.encounter.status!=='talking')return;
  if(completed&&!s.encounter.rewarded){s.tokens++;s.encounter.rewarded=true;emit('sound',{name:'reward'})}
  s.encounter.status=completed?'completed':'available';changeMode('run');clearInput();
  emit('dialogueEnd',{completed});
  message(completed?'Merchant token +1 · Thanks for stopping.':'Back to the street.');
 }
 function advance(){
  if(s.mode!=='dialogue')return;
  if(s.encounter.line===script.length-1){endEncounter(true);return}
  s.encounter.line++;emit('dialogue',{line:script[s.encounter.line],index:s.encounter.line,partner:s.encounter.partner});
 }
 function skip(){if(s.mode==='dialogue')endEncounter(false)}
 function hop(){
  const p=s.player;p.vy=p.jumpShort&&!p.wantsFlip?-470:-720;p.grounded=false;p.coyote=0;p.buffer=0;p.platform=null;
  p.launchQueued=false;p.takeoffDelay=0;p.airTime=0;p.land=0;p.skid=false;p.duck=false;
  p.airCarry=Math.abs(p.vx);p.squat=0;p.dropping=false;p.idleTime=0;p.jumpKind=Math.abs(p.vx)>215?'long':'hop';p.airJumpUsed=false;p.doubleJump=false;p.doubleTime=0;
  p.flip=p.wantsFlip;p.flipUsed=p.flip;p.flipElapsed=0;p.flipAngle=0;p.wantsFlip=false;
  emit('sound',{name:p.flip?'flip':'jump'});
 }
 function doubleHop(){
  const p=s.player;p.vy=-760;p.vx*=Math.abs(p.vx)>MOTION.run?.65:.35;p.airCarry=Math.abs(p.vx);p.squat=0;p.dropping=false;p.idleTime=0;p.grounded=false;p.platform=null;p.coyote=0;p.buffer=0;p.launchQueued=false;p.takeoffDelay=0;p.airJumpUsed=true;p.doubleJump=true;p.doubleTime=0;p.airTime=0;p.jumpShort=false;p.flip=false;p.flipUsed=true;p.flipAngle=0;p.land=0;p.duck=false;
  s.blasts.push({x:p.x,y:p.y-10,life:.24,jump:true});emit('sound',{name:'doubleJump'});emit('doubleJump');
 }
 function startPound(){
  const p=s.player;
  // On the ground, the same chord launches a short flip before the drop.
  const lift=p.grounded?-500:-95;
  Object.assign(p,{poundTime:0,vy:lift,vx:p.vx*.28,grounded:false,platform:null,
   flip:false,flipUsed:true,doubleJump:false,airJumpUsed:true,airCarry:0,
   dropping:false,dropTimer:0,dropY:null,coyote:0,buffer:0,wantsFlip:false,
   launchQueued:false,duck:false,squat:0,boosting:false,throwTime:-1});
  lastDown={time:-Infinity,platform:null};
  emit('sound',{name:'flip'});
 }
 function poundImpact(block){
  const p=s.player;
  s.blasts.push({x:p.x,y:p.y,life:.32,pound:true});
  sparks(p.x,p.y,10);emit('sound',{name:'pound'});emit('poundImpact');
  if(block?.kind==='loot')breakLoot(block);
  else if(block&&block.kind!=='loot')openCrate(block);
 }
 function dive(){
  const p=s.player;if(p.diveUsed)return;
  const direction=Math.sign(p.vx)||p.facing;
  p.vx=direction*Math.min(480,Math.abs(p.vx)+60);p.vy=Math.max(420,p.vy);
  p.dropping=false;p.dive=true;p.diveTime=0;p.diveUsed=true;p.airJumpUsed=true;p.doubleJump=false;
  p.flip=false;p.flipUsed=true;p.flipAngle=0;p.buffer=0;p.airCarry=Math.abs(p.vx);p.facing=direction;p.throwTime=-1;
  emit('sound',{name:'dive'});emit('dive');
 }
 function updatePlayer(dt){
  const p=s.player,oldY=p.y,oldX=p.x,wasGrounded=p.grounded;
  p.dropTimer=Math.max(0,p.dropTimer-dt);
  if(lastDown.platform&&(!p.grounded||p.platform!==lastDown.platform))lastDown={time:-Infinity,platform:null};
  p.fireCooldown=Math.max(0,p.fireCooldown-dt);p.fireFlash=Math.max(0,p.fireFlash-dt);
  p.buffer=Math.max(0,p.buffer-dt);p.coyote=p.grounded?.1:Math.max(0,p.coyote-dt);p.land=Math.max(0,p.land-dt);
  const ceiling=p.duck&&[...s.blocks,...s.lootCrates.filter(b=>!b.broken)].some(b=>p.x+WORLD.halfWidth>b.x&&p.x-WORLD.halfWidth<b.x+b.w&&p.y-WORLD.playerHeight<b.y+b.h&&p.y>b.y);
  p.duck=p.grounded&&(held.has('down')||ceiling);
  p.squatRising=!p.duck&&p.squat>0;
  p.squat=approach(p.squat,p.duck?1:0,dt/(p.duck?.18:.16));
  const dir=Number(held.has('right'))-Number(held.has('left'));
  if(!dir){p.runGrace=Math.max(0,p.runGrace-dt);if(!p.runGrace)p.runLatch=false}
  p.running=held.has('speed')||p.runLatch;
  const boostHeld=p.runLatch&&held.has('speed')&&!p.duck;
  const max=p.duck?70:boostHeld?MOTION.boost:p.running?MOTION.run:MOTION.walk;
  if(!p.grounded)p.airCarry=Math.max(0,p.airCarry-45*dt);
  const reversing=dir&&Math.sign(p.vx)!==dir&&Math.abs(p.vx)>18;
  p.skid=p.grounded&&reversing&&(p.skid||Math.abs(p.vx)>215);
  if(p.poundTime>=0){p.vx=approach(p.vx,0,850*dt)}
  else if(p.skid){p.vx=approach(p.vx,0,MOTION.skidFriction*dt)}
  else {
   const accel=p.grounded?(dir?MOTION.acceleration:MOTION.releaseFriction):p.dive?360:MOTION.airAcceleration;
   // Let a released airborne runner coast, with deliberate steering available.
   const target=!p.grounded&&dir===Math.sign(p.vx)?Math.max(max,p.airCarry):max;
   if(p.grounded||dir)p.vx=approach(p.vx,dir*target,accel*dt);
   if(dir)p.facing=dir;
  }
  p.boosting=!p.duck&&!p.skid&&Math.abs(p.vx)>MOTION.run+22&&(boostHeld||!p.grounded);
  if(p.buffer>0&&p.coyote>0&&!p.launchQueued){p.launchQueued=true;p.takeoffDelay=MOTION.anticipation}
  if(p.launchQueued){p.takeoffDelay-=dt;if(p.takeoffDelay<=0){if(p.coyote>0)hop();else p.launchQueued=false}}
  if(!p.grounded){p.airTime+=dt;if(p.dive)p.diveTime+=dt;if(p.doubleJump)p.doubleTime+=dt;}
  p.x=clamp(p.x+p.vx*dt,35,areaWidth(s.areaIndex)-35);
  if(p.poundTime>=0){
   p.poundTime+=dt;
   p.vy=p.poundTime<MOTION.poundTuck?p.vy+380*dt:Math.min(1250,Math.max(650,p.vy)+3200*dt);
  }else p.vy=Math.min(1100,p.vy+(p.dive?2250:1650)*dt);
  p.y+=p.vy*dt;
  p.grounded=false;p.platform=null;
  const bodyH=p.duck?88:WORLD.playerHeight;
  // Fireball crates bump open. Wooden loot crates stay solid until shot.
  const solidBlocks=[...s.blocks,...s.lootCrates.filter(b=>!b.broken)];
  for(const b of solidBlocks){
   if(p.y>b.y+1&&p.y-bodyH<b.y+b.h-1){
    if(oldX+WORLD.halfWidth<=b.x&&p.x+WORLD.halfWidth>b.x){p.x=b.x-WORLD.halfWidth;p.vx=0}
    else if(oldX-WORLD.halfWidth>=b.x+b.w&&p.x-WORLD.halfWidth<b.x+b.w){p.x=b.x+b.w+WORLD.halfWidth;p.vx=0}
   }
   const horizontal=p.x+WORLD.halfWidth>b.x&&p.x-WORLD.halfWidth<b.x+b.w;
   if(horizontal&&p.vy<0&&oldY-bodyH>=b.y+b.h-.5&&p.y-bodyH<=b.y+b.h){
    p.y=b.y+b.h+bodyH;p.vy=95;b.bump=.24;
    if(b.kind!=='loot')openCrate(b);
   }
  }
  const surfaces=[{id:'ground',x:0,y:WORLD.ground,w:areaWidth(s.areaIndex)},...s.platforms,...solidBlocks.map((b,i)=>({id:b.kind==='loot'?'loot-'+b.item:'gold-'+i,x:b.x,y:b.y,w:b.w,block:b}))];
  if(p.vy>=0){
   const crossed=surfaces.filter(a=>!(p.dropTimer>0&&a.dropThrough&&Math.abs(a.y-p.dropY)<2)&&p.x+WORLD.halfWidth>a.x&&p.x-WORLD.halfWidth<a.x+a.w&&oldY<=a.y+.8&&p.y>=a.y);
   if(crossed.length){const land=crossed.reduce((a,b)=>a.y<b.y?a:b);p.y=land.y;p.grounded=true;p.platform=land.id;p.vy=0;
    if(p.poundTime>=0){p.poundTime=-1;poundImpact(land.block)}
    if(!wasGrounded){p.land=MOTION.landing;if(p.dive){s.blasts.push({x:p.x,y:p.y-3,life:.24,jump:true});sparks(p.x,p.y-2,5);}}
    p.dive=false;p.diveTime=0;p.diveUsed=false;p.dropping=false;p.dropTimer=0;p.dropY=null;
    p.flip=false;p.flipUsed=false;p.flipAngle=0;p.airJumpUsed=false;p.doubleJump=false;p.doubleTime=0;p.airCarry=0;
    if(s.areaIndex===3&&land.id!=='ground')p.lastSafe={x:clamp(p.x,land.x+30,land.x+land.w-30),y:p.y};
   }
  }
  if(s.areaIndex===3&&p.y>745){Object.assign(p,{x:p.lastSafe.x,y:p.lastSafe.y,vx:0,vy:0,grounded:true,airJumpUsed:false,doubleJump:false,flip:false,flipUsed:false,dive:false,diveTime:0,diveUsed:false,poundTime:-1,throwTime:-1,idleTime:0,dropping:false,dropTimer:0,dropY:null,boosting:false,airCarry:0});message('Back on the roof. Try Jump again in the air.');}
  if(p.y>WORLD.ground){p.y=WORLD.ground;p.vy=0;p.grounded=true;p.flip=false;p.flipUsed=false}
  // First extend into takeoff, then tuck through one compact forward rotation.
  if(p.flip){p.flipElapsed+=dt;p.flipAngle=clamp((p.flipElapsed-.18)/.44,0,1)*Math.PI*2;
   if(p.flipElapsed>.74){p.flip=false;p.flipAngle=0}}
  p.phase+=Math.abs(p.vx)*dt/(Math.abs(p.vx)>215?155:150);
  s.talkAvailable=!!canTalk();
  if(s.areaIndex!==ALLEY&&p.x>WORLD.finish)s.finishVisited=true;
  const highExit=s.areaIndex!==2||p.y<=180;
  if(s.areaIndex===4&&p.x>=PARTY_MARK&&p.grounded){startFinale();return}
  if(p.grounded&&p.x>=areaWidth(s.areaIndex)-48&&highExit)beginTransition(1);
  else if(p.grounded&&p.x<=48&&s.areaIndex>(s.afterParty?ALLEY:0))beginTransition(-1);
 }
 function updateCamera(dt,w,h){
  const p=s.player,cam=s.camera;
  const tx=clamp(p.x-w*.38,0,Math.max(0,areaWidth(s.areaIndex)-w));
  const base=clamp((s.areaIndex===4?DECK_Y:s.areaIndex===3?552:WORLD.ground)-h*.83,0,Math.max(0,WORLD.height-h));
  const ty=Math.min(base,Math.max(-480,p.y-h*.73));
  const blend=1-Math.exp(-6*dt);
  cam.x+=(tx-cam.x)*blend;cam.y+=(ty-cam.y)*blend;
 }
 function step(dt,w=900,h=520){
  if(!s||s.mode==='paused')return;
  if(s.mode==='complete')return;
  s.time+=dt;
  if(s.mode==='finale'){if(!s.afterParty)updateFinale(dt,w,h);return}
  if(s.mode==='transition'){updateTransition(dt,w,h);return}
  if(s.mode==='run')s.elapsed+=dt;
  if(s.messageTime>0){s.messageTime-=dt;if(s.messageTime<=0){s.lastMessage='';emit('message',{text:''})}}
  for(const npc of s.walkers){
   if(s.encounter.status==='talking'&&npc.id===s.encounter.partner)continue;
   npc.x+=npc.dir*npc.speed*dt;npc.phase+=dt*5;
   if(npc.x<npc.lo){npc.x=npc.lo;npc.dir=1}if(npc.x>npc.hi){npc.x=npc.hi;npc.dir=-1}
  }
  if(s.celebrate>0)s.celebrate=Math.max(0,s.celebrate-dt);
  for(const d of s.debris){d.x+=d.vx*dt;d.y+=d.vy*dt;d.vy+=520*dt;d.angle+=d.spin*dt;d.life-=dt}s.debris=s.debris.filter(d=>d.life>0);
  for(const b of s.blasts)b.life-=dt;s.blasts=s.blasts.filter(b=>b.life>0);
  for(const f of s.fizzles){f.age+=dt;f.life-=dt;f.x+=f.vx*dt;f.y-=16*dt}s.fizzles=s.fizzles.filter(f=>f.life>0);
  for(const b of s.blocks)b.bump=Math.max(0,b.bump-dt);
  for(const p of s.particles){p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=340*dt;p.life-=dt}s.particles=s.particles.filter(p=>p.life>0);
  if(s.mode==='run'){
   updatePlayer(dt);updateCamera(dt,w,h);
   if(s.mode==='run'){
    updateThrow(dt);updateLoot(dt);updateFire(dt,w,h);
    const p=s.player;
    const quiet=p.grounded&&Math.abs(p.vx)<9&&!p.duck&&!p.squat&&!p.land&&!p.launchQueued&&p.throwTime<0
     &&!['left','right','down','jump','flip','fire','talk'].some(key=>held.has(key));
    p.idleTime=quiet?p.idleTime+dt:0;
   }
  }else updateCamera(dt,w,h);
 }
 return {reset,press,release,clearInput,nextScene,runMs,setMode:mode,step,advance,skip,talk,get state(){return s},world:WORLD,script};
}
globalThis.StreetGame={create,world:WORLD,script,motion:MOTION,idlePose,areaNames:AREA_NAMES,areaName,areaWidth,alleyIndex:ALLEY,merchTotal,merch:MERCH};
})();
