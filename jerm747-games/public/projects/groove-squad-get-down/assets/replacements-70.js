/* v146: canonical 70-pose Static and Rokr sets; twelve authored fall contacts. */
(()=>{'use strict';
const data=window.REPLACEMENT_70_FRAMES;
const groups=[['base',9],['ko',12],['punches',12],['kicks',12],['movement',12],['reactions-a',9],['reactions-b',4]];
const p=(sheet,frame)=>({sheet,frame});
const strikes={pHigh:['punches',0,1],pMid:['punches',4,2],pLow:['punches',8,3],kHigh:['kicks',0,4],kMid:['kicks',4,5],kLow:['kicks',8,6]};
function pose(a,moves,time=0){
 if(a.action==='down')return p('ko',a.defeatTime>=0?Math.min(11,Math.floor(a.defeatTime/.1)):11);
 if(a.hitAge>=0&&a.hitAge<.3){
  const t=a.hitAge;if(t>=.24)return p('reactions-b',3);
  if(a.hitHeight==='low')return p('reactions-b',t<.12?1:2);
  if(a.hitHeight==='mid')return t<.12?p('reactions-a',8):p('reactions-b',0);
  return p('reactions-a',t<.12?6:7);
 }
 if(a.attack){
  const spec=moves[a.attack.move],t=a.attack.elapsed/spec.duration;
  const s=strikes[a.attack.move];
  if(s){const [sheet,n,contact]=s;if(t<.16)return p(sheet,n);if(t<.32)return p(sheet,n+1);if(t<.56)return p('base',contact);return p(sheet,n+(t<.78?2:3));}
  return p('base',spec.frame??8);
 }
 if(a.hopping&&a.y<0)return p('reactions-a',a.hopAge<.075?0:a.vy<0?1:a.vy<90?2:3);
 if(a.launch>0)return p('reactions-a',a.launchAge<.025?0:1);
 if(a.y<0)return p('reactions-a',a.vy<0?(a.jumpAge<.2?1:2):3);
 if(a.landAge>=0&&a.landAge<.18)return p('reactions-a',a.landAge<.08?4:5);
 if((a.duckAmount||0)>0)return p('movement',a.duckTarget?(a.duckAmount<.5?8:a.duckAmount<1?9:10):11);
 if(a.action==='block'||a.action==='back-block')return p('base',7);
 if(a.action==='step'||a.action==='backstep'||a.groundedWalk)return p('movement',4+Math.floor((a.gait||0)*4)%4);
 if(a.movePhase==='start')return p('movement',4+(a.moveAge<.06?0:1));
 if(a.movePhase==='stop')return p('movement',a.moveAge<.06?7:0);
 if(a.action==='run')return p('movement',2+Math.floor((a.gait||0)*2)%2);
 return p('movement',Math.floor(time*3.2)%2);
}
for(const [id,who,name] of [['mama-love','static','Static'],['pg','rokr','Rokr']]){
 const frames=data[who];if(!frames)throw Error('Missing '+name+' 70-pose map');
 for(const key of Object.keys(window.ARCADE_MOTION_FRAMES))if(key.startsWith(id+'-')){
  delete window.ARCADE_MOTION_FRAMES[key];delete window.ARCADE_SPRITE_MASKS?.[key];
 }
 delete window.ARCADE_SPRITE_MASKS?.[id+'-base'];
 const src=type=>`images/groove-squad/${who}-70/${who}-${type}.png?v=146`;
 const register=(type,from=type,indices)=>{
  const key=id+'-'+type;window.ARCADE_MOTION_FRAMES[key]=indices?indices.map(n=>frames[from][n]):frames[from];
  window.ARCADE_MOTION_SOURCES[key]=src(from);window.ARCADE_SHEET_HEIGHTS[key]=280;
 };
 window.ARCADE_BASE_FRAMES[id]=frames.base;
 for(const [group]of groups)if(group!=='base')register(group);
 register('motion','movement');register('reaction','reactions-a');register('legs','movement');register('back','movement',[4,5,6,7]);
 const seq=(label,sheet,indices)=>({label,sheet,frames:indices});
 const sequences={idle:seq('Ready / breathing','movement',[0,1]),walk:seq('Step / retreat','movement',[4,5,6,7]),run:seq('Run','movement',[2,3]),duck:seq('Duck and rise','movement',[8,9,10,11]),jump:seq('Jump and land','reactions-a',[0,1,2,3,4,5]),hitHigh:seq('High impact','reactions-a',[6,7]),hitMid:{label:'Middle impact',poses:[p('reactions-a',8),p('reactions-b',0),p('reactions-b',3)]},hitLow:seq('Low impact','reactions-b',[1,2,3]),block:seq('Block','base',[7]),wave:seq('Special release','base',[8]),fall:seq('Twelve distinct fall drawings','ko',Array.from({length:12},(_,n)=>n))};
 for(const [move,[sheet,n,contact]]of Object.entries(strikes))sequences[move]={label:move+' · windup / extension / contact / retraction / guard',poses:[p(sheet,n),p(sheet,n+1),p('base',contact),p(sheet,n+2),p(sheet,n+3)]};
 window.Jerm747FighterSets[id]={baseSrc:src('base'),pose,sequences,groundedArt:true,referenceHeight:280,completedFrames:70,targetFrames:70,canonicalGroups:groups,displayName:name,version:146};
}
})();
