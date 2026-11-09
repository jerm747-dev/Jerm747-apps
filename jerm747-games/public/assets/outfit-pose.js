/* v113: 70 distinct drawings per alternate outfit, including 12 fall stages. */
window.Jerm747OutfitPose=function(id,a,specs,time=0){
 const n=window.JERM747_OUTFIT_COMBAT[id].names,sensei=id==='og-jerm';
 const p=name=>({sheet:'all',frame:n[name]??0});
 const seq=(names,t)=>p(names[Math.max(0,Math.min(names.length-1,t))]);
 if(a.action==='down')return p('fall-'+Math.min(11,Math.max(0,Math.floor((a.defeatTime||0)/.1))));
 if(a.hitAge>=0&&a.hitAge<.3){const r=a.hitAge>=.12?1:0;return p(a.hitHeight==='high'?'r3-'+(9+r):'r4-'+(a.hitHeight==='low'?2+r:r));}
 if(a.attack){const s=specs[a.attack.move]||{},f=a.attack.elapsed/(s.duration||.4),phase=f<.22?0:f<.55?1:2;
  if(s.kind==='wave')return p(sensei?'r1-'+(f<.4?9:10):'r2-'+(f<.4?8:9));
  if(s.kind==='punch'){const names=sensei?(s.height==='low'?['r0-7','original-3','r1-3']:s.height==='high'?['original-0','r0-2','r0-3']:['original-0','r0-5','r0-6']):(s.height==='low'?['r0-7','r0-8','r0-10']:s.height==='high'?['r1-1','r1-2','r1-3']:['r0-4','r0-5','r0-6']);return seq(names,phase);}
  return seq(sensei?(s.height==='low'?['r1-3','r1-4','r1-5']:s.height==='high'?['r0-9','r0-10','r0-11']:['r0-9','r0-12','r0-13']):(s.height==='low'?['r2-0','r2-1','r2-2']:s.height==='high'?['r1-4','r1-5','r1-6']:['r1-7','r1-8','r1-9']),phase);
 }
 if(a.launch>0)return p(sensei?'r3-2':'r2-4');
 if(a.y<0)return p(sensei?'r3-'+(a.vy<0?3:a.vy<90?4:5):'r3-'+(a.vy<0?4:a.vy<90?5:6));
 if(a.landAge>=0&&a.landAge<.18)return p('r3-'+(a.landAge<.09?7:8));
 if((a.duckAmount||0)>0){
  if(sensei){const t=a.duckAmount;return p(a.duckTarget?(t<.35?'r3-1':t<.8?'r3-7':'r3-2'):(t>.65?'r3-7':'r3-8'));}
  return p(a.duckTarget?'r2-4':'r2-6');
 }
 if(a.action==='block'||a.action==='back-block')return p('original-7');
 if(['run','step','backstep'].includes(a.action)){
  const walk=sensei?(a.action==='run'?['run-0','run-1','run-2','run-3']:['walk-0','walk-1','walk-2','walk-3']):['r3-0','r3-1','r3-2','r3-3','r3-2','r3-1'];
  let i=Math.floor((a.gait||0)*walk.length)%walk.length;if(a.action==='backstep'||(sensei&&a.action==='step'&&(a.lastMovement||a.moveDir||0)*a.facing<0))i=walk.length-1-i;return p(walk[i]);
 }
 if(a.movePhase==='start'||a.movePhase==='stop')return p(sensei?'walk-0':'r3-0');
 return p(Math.floor(time*1.5)%2?'original-0':'r0-0');
};
