/* Optional before/after-apex drawings. Actor physics and combat timing stay in the engine. */
(()=>{'use strict';
const registry=window.Jerm747JumpFrames||{},looks=window.Jerm747JumpLooks||{},p=(sheet,frame)=>({sheet,frame});
function register(id,data,type){
 const key=id+'-'+type;
 window.ARCADE_MOTION_FRAMES[key]=data.frames;
 window.ARCADE_MOTION_SOURCES[key]=data.source;
 window.ARCADE_SHEET_HEIGHTS[key]=!data.introducedBuild?(window.Jerm747FighterSets?.[id]?.referenceHeight||data.referenceHeight):data.referenceHeight;
}
for(const [id,data] of Object.entries(registry))register(id,data,'jump-apex');
for(const [id,data] of Object.entries(looks))register(id,data,'jump-apex-alt');
function pose(id,a,fallback,look=0){
 const data=(look===1?looks:registry)[id],type=look===1?'jump-apex-alt':'jump-apex';
 if(!data||!window.Jerm747ArcadeArt?.get(id,type)||!(a.y<0)||a.attack||a.action==='down'||a.action==='block'||a.action==='back-block'||a.guard||(a.hitAge>=0&&a.hitAge<.3)||a.launch>0||a.hopping||a.duckAmount>0)return fallback;
 // Retain Static's approved rise/fall timing from the GS Fighter pilot.
 if(id==='mama-love'&&look!==1){
  if(a.vy<0&&a.jumpAge>=.10&&a.jumpAge<.20)return p(type,0);
  if((a.vy<0&&a.jumpAge>=.20)||(a.vy>=0&&a.vy<90))return p('reactions-a',2);
  if(a.vy>=90&&a.vy<300)return p(type,1);
 }else{
  if(a.vy>=-220&&a.vy<-40)return p(type,0);
  if(a.vy>40&&a.vy<=220)return p(type,1);
  // Retain the 13 imported GS Fighter apex choices from build188.
  if(!data.introducedBuild&&look!==1&&a.vy>=-40&&a.vy<=40)return p('reactions-a',2);
  }
 return fallback;
}
for(const [id] of Object.entries(registry)){
 const set=window.Jerm747FighterSets?.[id];if(!set||set.jumpTransitionFrames)continue;
 const original=set.pose;
 set.pose=(a,moves,time)=>pose(id,a,original(a,moves,time));
 set.sequences={...set.sequences,jump:{label:'Jump · before and after apex',poses:[p('reactions-a',0),p('reactions-a',1),p('jump-apex',0),p('reactions-a',2),p('jump-apex',1),p('reactions-a',3),p('reactions-a',4),p('reactions-a',5)]}};
 // These optional drawings do not turn a failed image into a blocked match start.
 set.jumpTransitionFrames=2;
 set.supplementalGroups=[...(set.supplementalGroups||[]),['jump-apex',2]];
}
window.Jerm747JumpTransitions={pose,fighters:Object.keys(registry),alternateFighters:Object.keys(looks),version:189};
})();
