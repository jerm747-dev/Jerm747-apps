/* Static workshop: ten authored intermediate drawings, 80 poses in total. */
(()=>{'use strict';
const id='mama-love',set=window.Jerm747FighterSets[id],data=window.GSStaticIntermediateFrames;if(!set||!data)throw Error('Static workshop assets unavailable');
const sheet='intermediates',key=id+'-'+sheet;window.ARCADE_MOTION_FRAMES[key]=data.frames;window.ARCADE_MOTION_SOURCES[key]='/projects/gs-fighter-2/static-intermediates.png';window.ARCADE_SHEET_HEIGHTS[key]=280;
const roundKey=id+'-roundhouse';window.ARCADE_MOTION_FRAMES[roundKey]=window.GSStaticRoundhouseFrames.frames;window.ARCADE_MOTION_SOURCES[roundKey]='/projects/gs-fighter-2/static-roundhouse.png';window.ARCADE_SHEET_HEIGHTS[roundKey]=280;
const p=(sheet,frame)=>({sheet,frame}),old=set.pose;
const walk=[p('movement',4),p(sheet,0),p('movement',5),p(sheet,1)],back=[p('movement',6),p(sheet,4),p('movement',7),p(sheet,5)],run=[p('movement',2),p(sheet,2),p('movement',3),p(sheet,3)];
const roundhouse=[p('kicks',0),p('roundhouse',0),p('kicks',1),p('base',4),p('roundhouse',1),p('kicks',2),p('kicks',3)];
set.pose=(a,moves,time=0)=>{
 if(a.attack?.move==='kHigh'&&!(a.hitAge>=0&&a.hitAge<.3)&&a.action!=='down'){
  const t=a.attack.elapsed/moves.kHigh.duration;return roundhouse[t<.13?0:t<.25?1:t<.32?2:t<.53?3:t<.70?4:t<.86?5:6];
 }
 if(a.action==='down'||a.hitAge>=0&&a.hitAge<.3||a.attack||a.launch>0||(a.duckAmount||0)>0||a.action==='block'||a.action==='back-block'||a.hopping)return old(a,moves,time);
 if(a.y<0){if(a.vy<0)return a.jumpAge<.10?p('reactions-a',1):a.jumpAge<.20?p(sheet,6):p('reactions-a',2);return a.vy<90?p('reactions-a',2):a.vy<300?p(sheet,7):p('reactions-a',3);}
 if(a.landAge>=0&&a.landAge<.18)return old(a,moves,time);
 const n=Math.floor((a.gait||0)*4)%4;
 if(a.action==='run')return run[n];
 if(a.action==='backstep')return back[n];
 if(a.action==='step'||Math.abs(a.moveSpeed||0)>.1)return ((a.moveDir||a.lastMovement||0)*(a.facing||1)<0?back:walk)[n];
 if(a.movePhase==='start')return walk[a.moveAge<.06?0:1];
 if(a.movePhase==='stop')return p('movement',0);
 return p('movement',Math.floor(time*3.2)%2);
};
set.sequences={...set.sequences,kHigh:{label:'Roundhouse high kick · upswing / apex / follow-through',poses:roundhouse},walk:{label:'Forward walk · four contacts/passing poses',poses:walk},backstep:{label:'Backward walk · four contacts/passing poses',poses:back},run:{label:'Forward run · four gait phases',poses:run},jump:{label:'Jump · added rising/falling intermediates',poses:[p('reactions-a',0),p('reactions-a',1),p(sheet,6),p('reactions-a',2),p(sheet,7),p('reactions-a',3),p('reactions-a',4),p('reactions-a',5)]}};
set.canonicalGroups=[...set.canonicalGroups,[sheet,8],['roundhouse',2]];set.completedFrames=80;set.targetFrames=80;
const histories=new WeakMap();let enabled=true;try{enabled=localStorage.getItem('gs-fighter.static.motion-trails')!=='off'}catch{}
window.GSStaticMotionTrail={get:()=>enabled,set(v){enabled=!!v;try{localStorage.setItem('gs-fighter.static.motion-trails',enabled?'on':'off')}catch{}},draw(ctx,a,sprite,time,reduced,paint){
 const h=histories.get(a)||{at:-1,poses:[]};histories.set(a,h);const moving=a.action==='run',air=a.y<0,attack=!!a.attack;
 if(!enabled||reduced||(!moving&&!air&&!attack)){h.poses=[];h.at=-1;return;}
 const strength=moving?.09:attack?.065:.035;
 for(let i=0;i<h.poses.length;i++){const t=h.poses[i],age=time-t.time;if(age>.11)continue;if(Math.abs(a.x-t.x)<1&&t.frame===sprite.frame&&t.sheet===sprite.sheet)continue;const f=t.bounds;ctx.save();ctx.globalAlpha=strength*(1-age/.12);ctx.translate((t.x-a.x)/(a.facing||1),t.y-a.y);if(t.facing!==a.facing)ctx.scale(-1,1);paint(ctx,t.sheet,t.frame,-(f.anchorX??f.w/2)*t.scale,-(f.anchorY??f.h)*t.scale,t.width,t.h);ctx.restore();}
 if(time-h.at>=.045){h.at=time;h.poses.push({...sprite,x:a.x,y:a.y,facing:a.facing,time});if(h.poses.length>2)h.poses.shift();}
}};
window.GSStaticWorkshop={newFrames:10,totalFrames:80,sequences:{walk,back,run}};
})();
