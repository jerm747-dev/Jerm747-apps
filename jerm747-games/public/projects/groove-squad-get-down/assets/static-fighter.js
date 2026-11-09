/* v144: Static's 40-pose first playable set. Keep the legacy slot for saved scores. */
(()=>{'use strict';
const id='mama-love',frames=window.STATIC_V144_FRAMES;
if(!frames)throw Error('Static frame map must load first');
window.ARCADE_MOTION_SOURCES??={};window.ARCADE_SHEET_HEIGHTS??={};
for(const key of Object.keys(window.ARCADE_MOTION_FRAMES||{}))if(key.startsWith(id+'-')){
 delete window.ARCADE_MOTION_FRAMES[key];delete window.ARCADE_SPRITE_MASKS?.[key];
}
delete window.ARCADE_SPRITE_MASKS?.[id+'-base'];
const source=group=>'images/groove-squad/static/static-'+group+'.png?v=144';
const register=(type,group,indices)=>{
 const key=id+'-'+type;
 window.ARCADE_MOTION_FRAMES[key]=indices?indices.map(i=>frames[group][i]):frames[group];
 window.ARCADE_MOTION_SOURCES[key]=source(group);window.ARCADE_SHEET_HEIGHTS[key]=280;
};
window.ARCADE_BASE_FRAMES[id]=frames.core;
register('motion','core');register('movement','movement');register('reaction','impact');
register('legs','movement');register('back','movement',[0,1,2,3]);
// Four authored fall contacts, held across the engine's twelve-tick fall window.
register('ko','impact',[8,8,9,9,9,10,10,10,11,11,11,11]);
const p=(sheet,frame)=>({sheet,frame});
function pose(a,moves,time=0){
 if(a.action==='down')return p('ko',a.defeatTime>=0?Math.min(11,Math.floor(a.defeatTime/.1)):11);
 if(a.hitAge>=0&&a.hitAge<.3){
  const offset=a.hitHeight==='high'?0:a.hitHeight==='low'?4:2;
  return p('reaction',a.hitAge<.1?offset:a.hitAge<.2?offset+1:a.hitAge<.26?6:7);
 }
 if(a.attack){
  const move=moves[a.attack.move],progress=a.attack.elapsed/move.duration;
  if(a.attack.move==='wave')return p('motion',progress<.15||progress>.8?0:8);
  const crouched=a.attack.move==='pLow'||a.attack.move==='kLow';
  return p('motion',progress<.18?(crouched?13:9):progress<.66?move.frame:progress<.85?9:0);
 }
 if(a.launch>0)return p('movement',8);
 if(a.y<0)return p('movement',a.vy<0?9:10);
 if(a.landAge>=0&&a.landAge<.18)return p('movement',11);
 if((a.duckAmount||0)>0)return p('motion',13);
 if(a.action==='block'||a.action==='back-block')return p('motion',7);
 if(a.action==='run')return p('movement',4+Math.floor((a.gait||0)*4)%4);
 if(a.action==='step'||a.action==='backstep'||a.groundedWalk)return p('movement',Math.floor((a.gait||0)*4)%4);
 return p('motion',Math.floor(time*3.2)%2?9:0);
}
const seq=(label,sheet,frames)=>({label,sheet,frames});
const sequences={
 idle:seq('Static · ready','motion',[0,9]),
 walk:seq('Static · walk','movement',[0,1,2,3]),
 run:seq('Static · run','movement',[4,5,6,7]),
 jump:seq('Static · jump and land','movement',[8,9,10,11]),
 hitHigh:seq('Static · high impact','reaction',[0,1,6,7]),
 hitMid:seq('Static · middle impact','reaction',[2,3,6,7]),
 hitLow:seq('Static · low impact','reaction',[4,5,6,7]),
 fall:seq('Static · first fall contacts','ko',Array.from({length:12},(_,i)=>i))
};
for(const [move,index] of Object.entries({pHigh:1,pMid:2,pLow:3,kHigh:4,kMid:5,kLow:6,wave:8}))
 sequences[move]=seq('Static · '+move,'motion',[9,index,index,9,0]);
window.Jerm747FighterSets[id]={baseSrc:source('core'),pose,sequences,groundedArt:true,referenceHeight:280,
 completedFrames:40,targetFrames:70,canonicalGroups:[['base',16],['movement',12],['reaction',12]],
 displayName:'Static',version:144};
})();
