(function(global){'use strict';
const clamp=x=>Math.max(0,Math.min(1,x));
function threat(run,moves){
 if(run.mode!=='fight'||run.battle.readyTime>0)return null;
 const b=run.battle;
 function lethal(attacker,target,damage,height){
  const hp=target===b.player?b.hp:b.bossHp;
  if(hp<=0||target.invulnerable>0)return false;
  if(height==='high'&&target.duckAmount>.65&&attacker.y>-90)return false;
  const guard=target.guard&&target.y>=-.5&&attacker.y>-90;
  return damage*(guard?.2:1)/(run.cinematicDamageScale||1)>=hp; // v72: Short/Medium/Long rounds divide damage
 }
 for(const [a,t,enemy] of [[b.player,b.boss,false],[b.boss,b.player,true]]){
  const atk=a.attack,spec=atk&&moves[atk.move];if(!spec||spec.kind==='wave'||atk.connected)continue;
  const left=spec.duration*.32-atk.elapsed,dx=t.x-a.x;
  const damage=spec.damage*(enemy&&!run.local?run.cinematicEnemyDamage||1:1);
  if(left>0&&left<=.085&&Math.abs(dx)<spec.range&&dx*atk.facing>=-20&&Math.abs(a.y-t.y)<90&&lethal(a,t,damage,spec.height))return{key:atk,actor:a,move:atk.move};
 }
 for(const w of b.projectiles){
  const t=w.owner==='player'?b.boss:b.player,a=w.owner==='player'?b.player:b.boss,dx=t.x-w.x,low=t.duckAmount>.65;
  if(dx*Math.sign(w.vx)<0||Math.abs(dx)>35+Math.abs(w.vx)*.085||Math.abs(w.y-((low?310:270)+t.y))>=(low?34:64))continue;
  if(lethal(a,t,w.damage,'mid'))return{key:w,actor:a,move:'wave'};
 }
 return null;
}
function create({moves,names={},reduced=false,onCelebrate=()=>{}}){
 let tracked=null,phase='idle',lead=null,leadAge=0,freeze=0,hit=null,celebration=0,started=false,done=false,slowFall=false;
 function reset(run){tracked=run;phase='idle';lead=null;leadAge=0;freeze=0;hit=null;celebration=0;started=false;done=false;slowFall=false;}
 function celebrate(run){if(started)return;started=true;phase='celebrate';celebration=0;onCelebrate(run);}
 function step(run,input,wallDt,advance){
  if(tracked!==run||run.mode==='fight'&&started)reset(run);
  if(done)return true;
  const dt=Math.min(.05,Math.max(0,wallDt));if(run.mode!=='fight')run.battle.events=[];
  if(started){celebration+=dt;if(celebration>=(reduced?.65:1.1)){done=true;phase='done';return true}return false;}
  if(freeze>0){freeze=Math.max(0,freeze-dt);phase='impact';return false;}
  const before=run.mode;let scale=1,candidate=null;
  if(run.mode==='fight'){
   candidate=threat(run,moves);
   if(candidate&&candidate.key!==lead?.key){lead=candidate;leadAge=0;}
   if(!reduced&&candidate&&leadAge<.32){scale=.3;phase='lead';leadAge+=dt;}else phase='idle';
  }else if(run.mode==='knockout'){
   phase='fall';const t=clamp((run.knockout.elapsed-.55)/.25);
   if(slowFall&&!reduced&&run.knockout.elapsed<.8)scale=.65+.35*t;
  }
  // Only simulation time slows; score logic and collision decisions stay in the engine.
  advance(run,input,dt*scale);
  if(before==='fight'&&run.mode==='knockout'){
   slowFall=run.battle.hp<=0||run.battle.bossHp<=0;
   hit=slowFall?candidate||lead:null;freeze=!reduced&&slowFall?.065:0;phase=slowFall?'impact':'fall';
  }
  if(run.mode==='round-over')celebrate(run);
  return false;
 }
 function pose(actor,run){return hit&&actor===hit.actor&&run.mode==='knockout'&&run.knockout.elapsed<.18?moves[hit.move]?.frame:null;}
 function label(run){if(run.outcome==='draw')return['DRAW','Replay the round'];if(run.outcome==='win')return['YOU WON',names[run.member]||run.member];return run.local?['YOU WON',(names[run.battle.opponent]||run.battle.opponent)+' · Player 2']:['YOU LOST','Your next chance is coming'];}
 function draw(ctx,run,width,height){
  if(tracked!==run)return;
  ctx.save();ctx.setTransform(1,0,0,1,0,0);
  if(phase==='impact'&&!reduced){ctx.strokeStyle='rgba(255,211,121,.65)';ctx.lineWidth=6;ctx.strokeRect(5,5,width-10,height-10);}
  if(started&&!done){
   const p=clamp(celebration/(reduced?.65:1.1)),win=run.outcome==='win'||run.local&&run.outcome==='loss',cx=width/2,cy=height*.38;
   const pop=reduced?1:.94+.06*clamp(p/.18);const w=Math.min(width-24,650)*pop,h=Math.min(height*.62,250)*pop,top=cy-h/2;
   ctx.fillStyle='#101728ee';ctx.fillRect(cx-w/2,top,w,h);ctx.strokeStyle=win?'#ffd47d':'#80dcf2';ctx.lineWidth=2;ctx.strokeRect(cx-w/2,top,w,h);
   const [title,member]=label(run),reward=run.roundReward?.total||0;
   ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle=win?'#ffd47d':'#80dcf2';ctx.font=`900 italic ${Math.max(32,Math.min(68,width*.082))}px Impact,system-ui`;ctx.fillText(title,cx,top+h*.22);
   ctx.fillStyle='#f6f8ff';ctx.font=`600 ${Math.max(12,Math.min(18,width*.03))}px system-ui`;ctx.fillText(member,cx,top+h*.43);
   const earned=run.outcome==='win';const shown=reduced?reward:Math.round(reward*(1-Math.pow(1-clamp(p/.72),3)));
   ctx.fillStyle='#fff2ba';ctx.font=`900 italic ${Math.max(28,Math.min(48,width*.058))}px Impact,system-ui`;ctx.fillText(earned?(reward?'+'+shown.toLocaleString()+' POINTS':'MAX SCORE'):run.local&&win?'+1 ROUND WIN':run.score.toLocaleString()+' POINTS SO FAR',cx,top+h*.66);
   ctx.fillStyle='#b8c9df';ctx.font=`500 ${Math.max(11,Math.min(15,width*.024))}px system-ui`;ctx.fillText(earned?(run.roundReward?.matchup?'Round bonus + matchup clear':'Round bonus · health + time'):'Keep your voice in the game',cx,top+h*.87);
   if(!reduced&&win)for(let n=0;n<18;n++){
    const angle=n*Math.PI*2/18,r=Math.min(width*.48,w*.54+p*40),x=cx+Math.cos(angle)*r,y=cy+Math.sin(angle)*r*.55-p*30;if(x>cx-w/2-8&&x<cx+w/2+8&&y>top-8&&y<top+h+8)continue;
    ctx.globalAlpha=1-p*.7;ctx.fillStyle=n%3===0?'#7cecff':n%3===1?'#ffd66e':'#ff84db';ctx.beginPath();ctx.arc(x,y,5+(n%4),0,Math.PI*2);ctx.fill();
   }
  }
  ctx.restore();
 }
 return{step,pose,draw,reset,state:()=>({phase,celebration,done,slowFall})};
}
global.Jerm747RoundFinale={create,threat};
if(typeof module!=='undefined')module.exports={create,threat};
})(typeof window!=='undefined'?window:globalThis);
