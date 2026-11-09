/* Practice-only travel and breakables. Does not modify either combat engine. */
(function(root){'use strict';function create(){let velocity=0,position=0,pending=0,worldTime=0,broken=0;const chunks=new Map(),debris=[];
function populate(){const center=Math.floor(position/650);for(const k of chunks.keys())if(Math.abs(k-center)>2)chunks.delete(k);for(let k=center-2;k<=center+2;k++)if(!chunks.has(k))chunks.set(k,[{x:k*650+240,y:455,r:44,kind:'crate',alive:true},{x:k*650+470,y:315,r:30,kind:'rock',alive:true}]);}
function shatter(target){target.alive=false;broken++;for(let i=0;i<9;i++)debris.push({x:target.x,y:target.y,vx:(i-4)*32,vy:-110-(i%3)*45,life:.65,kind:target.kind});}
function step(run,input,dt,advance){const p=run.battle.player,dir=(input.right?1:0)-(input.left?1:0),wasAir=p.y<-.5;
 if(input.duck||input.block){p.attack=null;p.anim=0;p.cooldown=0;velocity*=Math.max(0,1-dt*18);}
 else{const target=dir*214.5,rate=wasAir?(dir?260:0):(dir?1000:850);if(rate)velocity+=Math.max(-rate*dt,Math.min(rate*dt,target-velocity));}
 if(input.attack==='wave')pending=.16;else pending=Math.max(0,pending-dt);
 if(pending>0&&p.cooldown<=0&&!input.duck&&!input.block){input.attack='wave';pending=0;}
 const oldAttack=p.attack;advance(run,input,dt);
 if(p.attack?.move==='wave'&&p.attack!==oldAttack){p.cooldown=Math.min(p.cooldown,.30);}
 const dx=velocity*dt;position+=dx;p.x=450;p.facing=dir||p.facing;
 if(!p.attack&&!p.guard&&p.y>=0&&Math.abs(velocity)>5){p.action=Math.abs(velocity)>145?'run':'step';p.gait=(p.gait+Math.abs(dx)/96)%1;}
 for(const wave of run.battle.projectiles)wave.x-=dx;
 worldTime+=dt;populate();for(const wave of run.battle.projectiles){if(wave.life<=0)continue;const x=position+wave.x-450,y=420+wave.y-270;for(const targets of chunks.values())for(const t of targets){if(t.alive&&Math.abs(x-t.x)<t.r+22&&Math.abs(y-t.y)<t.r+20){shatter(t);wave.life=0;break;}}}
 for(const d of debris){d.life-=dt;d.x+=d.vx*dt;d.vy+=600*dt;d.y+=d.vy*dt;}while(debris.length&&debris[0].life<=0)debris.shift();return dx;}
function draw(ctx){populate();for(const targets of chunks.values())for(const t of targets){if(!t.alive)continue;const x=300+(t.x-position)*.7;if(x< -60||x>660)continue;ctx.save();ctx.translate(x,t.y);if(t.kind==='crate'){ctx.fillStyle='#805333';ctx.fillRect(-30,-44,60,88);ctx.strokeStyle='#d1a369';ctx.lineWidth=5;ctx.strokeRect(-29,-42,58,84);ctx.beginPath();ctx.moveTo(-25,-37);ctx.lineTo(25,37);ctx.moveTo(25,-37);ctx.lineTo(-25,37);ctx.stroke();}else{ctx.fillStyle='#6c8491';ctx.beginPath();ctx.moveTo(-25,6);ctx.lineTo(-16,-23);ctx.lineTo(13,-29);ctx.lineTo(29,-3);ctx.lineTo(16,24);ctx.lineTo(-16,26);ctx.closePath();ctx.fill();ctx.strokeStyle='#bad6df';ctx.lineWidth=3;ctx.stroke();}ctx.restore();}for(const d of debris){ctx.globalAlpha=Math.max(0,d.life/.65);ctx.fillStyle=d.kind==='crate'?'#d7a76e':'#b7d5df';ctx.fillRect(300+(d.x-position)*.7,d.y,6,6);}ctx.globalAlpha=1;}
return{step,draw,state:()=>({position,velocity,broken,targets:[...chunks.values()].flat().filter(t=>t.alive).length}),reset(){velocity=0;pending=0;},center(){position=0;velocity=0;pending=0;chunks.clear();debris.length=0;}};}
root.Jerm747PracticeRunner={create};})(typeof window==='object'?window:globalThis);
