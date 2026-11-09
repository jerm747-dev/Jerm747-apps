function createCatalogBattle(member='og-jerm') {
 return {member,phase:1,hp:120,bossHp:180,managerHp:90,energy:100,t:0,mode:'fight',message:'Protect your catalog.',player:{x:220,y:0,vy:0,facing:1,action:'idle',anim:0,cooldown:0,guard:false,invulnerable:0},boss:{x:720,y:0,vy:0,facing:-1,action:'idle',anim:0,cooldown:.9,windup:0,pending:null},manager:{x:830,action:'idle',anim:0,cooldown:2.7},projectiles:[],effects:[],assists:{jado:false,eli:false},assist:null,charge:0,chargeSteps:0,finisherTime:0,finisherHits:0,comboStarted:false,fightBanner:1.2,events:[]};
}
const CATALOG_MOVES={pHigh:{kind:'punch',height:'high',damage:9,range:128,cost:0,duration:.3,frame:1},pMid:{kind:'punch',height:'mid',damage:11,range:122,cost:0,duration:.34,frame:2},pLow:{kind:'punch',height:'low',damage:8,range:116,cost:0,duration:.3,frame:3},kHigh:{kind:'kick',height:'high',damage:15,range:168,cost:5,duration:.46,frame:4},kMid:{kind:'kick',height:'mid',damage:13,range:155,cost:4,duration:.4,frame:5},kLow:{kind:'kick',height:'low',damage:10,range:148,cost:3,duration:.36,frame:6},wave:{kind:'wave',height:'mid',damage:18,range:900,cost:20,duration:.45,frame:8}};
function catalogHit(battle,target,damage,source,height='mid'){
 if(target==='player'){
  if(battle.player.invulnerable>0)return;
  const guarded=battle.player.guard&&(height!=='low'||battle.player.action==='block');
  battle.hp=Math.max(0,battle.hp-damage*(guarded?.16:1));battle.player.invulnerable=guarded?.16:.48;
  battle.effects.push({kind:guarded?'block':'hit',x:battle.player.x,y:height==='high'?205:height==='low'?325:270,life:.24,color:guarded?'#80f2ed':'#ffa69a'});
 }else{
  const x=target==='manager'?battle.manager.x:battle.boss.x;
  if(target==='manager')battle.managerHp=Math.max(0,battle.managerHp-damage);else battle.bossHp=Math.max(0,battle.bossHp-damage);
  battle.effects.push({kind:'hit',x,y:height==='high'?205:height==='low'?325:270,life:.3,color:'#f7df8e'});
 }
}
function catalogAttack(battle,move){
 const spec=CATALOG_MOVES[move],p=battle.player;if(battle.mode!=='fight'||!spec||p.cooldown>0||battle.energy<spec.cost)return false;
 p.action=move;p.anim=spec.duration;p.cooldown=spec.duration+.08;battle.energy-=spec.cost;battle.events.push({type:'attack',move});
 if(spec.kind==='wave'){battle.projectiles.push({owner:'player',x:p.x+35*p.facing,y:268+p.y,vx:460*p.facing,damage:spec.damage,life:2.2,color:catalogMemberColor(battle.member)});return true;}
 for(const target of battle.phase===2&&battle.managerHp>0?['boss','manager']:['boss']){
  const enemy=target==='boss'?battle.boss:battle.manager;const distance=enemy.x-p.x;
  if(Math.abs(distance)<spec.range&&distance*p.facing>=-20&&Math.abs(p.y-(enemy.y||0))<90)catalogHit(battle,target,spec.damage,'player',spec.height);
 }
 return true;
}
function catalogAssist(battle,id){
 if(battle.mode!=='fight'||battle.assists[id]||!['jado','eli'].includes(id)||battle.assist)return false;
 battle.assists[id]=true;battle.assist={id,t:0,hits:0,x:Math.max(80,battle.boss.x-100)};battle.message=id==='jado'?'Jado: Let’s bring the drums!':'Eli: We’re with you, OG!';return true;
}
function catalogMemberColor(id){return {jado:'#ffb770',eli:'#88dcff',kiana:'#cb8aff',honest:'#7bedd1',simcity:'#d194ff','nige-hood':'#ff977c',lyfelong:'#69a8ff',manager:'#f5ce70',jimmy:'#ffe7bc'}[id]||'#73f5f1';}
function catalogBeginFinale(battle){
 battle.phase=3;battle.mode='fight';battle.member='coat';battle.hp=Math.max(65,battle.hp);battle.bossHp=100;battle.managerHp=0;battle.projectiles=[];battle.player.x=240;battle.boss.x=690;battle.player.invulnerable=3;battle.player.guard=false;battle.player.action='idle';battle.player.anim=0;battle.boss.cooldown=1.5;battle.charge=0;battle.fightBanner=1.4;battle.message='Take two steps. Hold Gather, then release when the catalog is full.';
}
function catalogCharge(battle,held,dt){
 if(battle.phase!==3||battle.mode!=='fight')return;
 if(held&&battle.chargeSteps>=2){battle.charge=Math.min(1,battle.charge+dt/.95);battle.player.action='gather';battle.player.anim=.1;}
 else if(!held&&battle.charge>0){if(battle.charge>=.95){battle.mode='finisher';battle.finisherTime=0;battle.finisherHits=0;battle.comboStarted=true;battle.projectiles=[];battle.message='Your whole catalog. Your own voice.';}else{battle.message='Keep holding until the catalog is full.';battle.charge=0;}}
}
function catalogStep(battle,input,dt){
 dt=Math.min(Math.max(dt,0),.05);battle.events=[];if(battle.mode==='coat'||battle.mode==='lost'||battle.mode==='won')return;
 battle.t+=dt;battle.fightBanner=Math.max(0,battle.fightBanner-dt);battle.effects=battle.effects.filter(effect=>(effect.life-=dt)>0);
 if(battle.mode==='finisher'){
  battle.finisherTime+=dt;const hitTimes=[.25,.55,.85,1.15,1.7];
  while(battle.finisherHits<5&&battle.finisherTime>=hitTimes[battle.finisherHits]){const n=++battle.finisherHits;battle.player.x=battle.boss.x-90;battle.player.facing=1;battle.player.action=n===5?'pHigh':n%2?'pMid':'kMid';battle.player.anim=.3;battle.boss.action='hit';battle.boss.anim=.3;battle.bossHp=Math.max(0,100-n*20);battle.effects.push({kind:n===5?'final':'hit',x:battle.boss.x,y:255,life:n===5?.75:.25,color:'#ffe6a0'});battle.events.push({type:'finisherHit',n});if(n===5){battle.boss.x=Math.min(835,battle.boss.x+100);battle.boss.action='down';battle.message='Jimmy falls back onto the arena floor.';}}
  if(battle.finisherTime>2.8){battle.mode='won';battle.events.push({type:'won'});}return;
 }
 const p=battle.player,b=battle.boss;p.cooldown=Math.max(0,p.cooldown-dt);p.anim=Math.max(0,p.anim-dt);p.invulnerable=Math.max(0,p.invulnerable-dt);b.anim=Math.max(0,b.anim-dt);battle.manager.anim=Math.max(0,battle.manager.anim-dt);battle.energy=Math.min(100,battle.energy+dt*11);
 p.guard=!!input.block&&p.y>=-.5;if(p.guard){p.action='block';p.anim=.1;}
 const movement=(input.right?1:0)-(input.left?1:0);let step=Math.abs(movement)*dt*195;
 if(!p.guard&&!input.gather&&p.anim<=0){p.x=Math.max(60,Math.min(840,p.x+movement*dt*195));if(movement){p.facing=movement;p.action='run';if(battle.phase===3)battle.chargeSteps=Math.min(2,battle.chargeSteps+step/20);}else p.action='idle';}
 if(input.jump&&p.y>=-.5){p.vy=-460;p.y=-1;battle.events.push({type:'jump'});}input.jump=false;
 if(p.y<0){p.vy+=1150*dt;p.y+=p.vy*dt;if(p.y>=0){p.y=0;p.vy=0;battle.events.push({type:'land'});}else if(p.anim<=0)p.action=p.vy<0?'jump':'fall';}
 if(input.attack){catalogAttack(battle,input.attack);input.attack=null;}
 if(input.assist){catalogAssist(battle,input.assist);input.assist=null;}
 if(battle.assist){const assist=battle.assist;assist.t+=dt;while(assist.hits<4&&assist.t>=.18+assist.hits*.16){assist.hits++;catalogHit(battle,'boss',8,assist.id);battle.events.push({type:'assistHit',id:assist.id});}if(assist.t>1.05)battle.assist=null;}
 for(const wave of battle.projectiles){wave.x+=wave.vx*dt;wave.life-=dt;if(wave.owner==='player'){const target=battle.phase===2&&battle.managerHp>0&&Math.abs(wave.x-battle.manager.x)<38?'manager':'boss';const enemy=target==='boss'?b:battle.manager;if(Math.abs(wave.x-enemy.x)<38&&Math.abs(wave.y-(270+(enemy.y||0)))<80){catalogHit(battle,target,wave.damage,'player');wave.life=0;}}else if(Math.abs(wave.x-p.x)<35&&Math.abs(wave.y-(270+p.y))<64){catalogHit(battle,'player',wave.damage,'boss');wave.life=0;}}
 battle.projectiles=battle.projectiles.filter(wave=>wave.life>0&&wave.x>-80&&wave.x<1000);
 b.facing=p.x<b.x?-1:1;b.cooldown-=dt;
 if(b.windup>0){b.windup-=dt;if(b.windup<=0){if(b.pending==='wave')battle.projectiles.push({owner:'boss',x:b.x+b.facing*40,y:270,vx:b.facing*330,damage:battle.phase===3?8:12,life:3,color:'#ff93c9'});else if(Math.abs(b.x-p.x)<160&&p.y>-85)catalogHit(battle,'player',battle.phase===3?6:11,'boss',b.pending==='kLow'?'low':'mid');b.action=b.pending;b.anim=.35;b.pending=null;b.cooldown=battle.phase===3?1.15:.65;}}
 else if(b.cooldown<=0){b.pending=Math.abs(b.x-p.x)>200?'wave':Math.floor(battle.t*2)%3===0?'kLow':'pMid';b.windup=.45;b.action='block';b.anim=.45;}
 else if(Math.abs(b.x-p.x)>112&&b.anim<=0){b.x=Math.max(70,Math.min(850,b.x+b.facing*dt*(battle.phase===3?55:85)));b.action='run';}else if(b.anim<=0)b.action='idle';
 if(battle.phase===2&&battle.managerHp>0){const m=battle.manager;m.cooldown-=dt;const direction=p.x<m.x?-1:1;if(Math.abs(m.x-p.x)>120)m.x=Math.max(70,Math.min(850,m.x+direction*dt*70));if(m.cooldown<=0){m.action='wave';m.anim=.4;battle.projectiles.push({owner:'manager',x:m.x+direction*35,y:270,vx:direction*280,damage:7,life:3,color:'#e3bb65'});m.cooldown=2.7;}}
 catalogCharge(battle,!!input.gather,dt);
 if(battle.hp<=0){battle.mode='lost';battle.events.push({type:'lost'});return;}
 if(battle.phase===1&&battle.bossHp<=0){battle.phase=2;battle.bossHp=140;battle.managerHp=90;battle.manager.x=810;battle.boss.x=Math.min(700,battle.boss.x);battle.hp=Math.min(120,battle.hp+25);battle.player.invulnerable=2;battle.projectiles=[];battle.message='The Manager: Jimmy, let me help you put this catalog in order.';battle.events.push({type:'managerArrival'});}
 else if(battle.phase===2&&battle.bossHp<=0){battle.mode='coat';battle.projectiles=[];battle.events.push({type:'coat'});}
 // The third health bar waits at one HP for the catalog finish; normal hits remain useful.
 if(battle.phase===3&&battle.mode==='fight')battle.bossHp=Math.max(1,battle.bossHp);
}
if(typeof module!=='undefined')module.exports={createCatalogBattle,catalogStep,catalogAttack,catalogAssist,catalogBeginFinale,catalogCharge,CATALOG_MOVES};

const ARCADE_FIGHTERS=["og-jerm", "kiana", "jado", "eli", "honest", "simcity", "nige-hood", "lyfelong", "jimmy", "manager", "jazz", "j-read", "l-noelle", "idrum", "sir-abstraxxx", "hookshot-charlie", "mama-love", "jaycee", "g-rod", "dramas-key", "rizzy", "dirty-harry", "pg", "ronnie", "big-kent", "unk-major", "unk-engineer", "unk-supporter", "fouji", "john-henry", "chaundra", "wornitha", "dee-dee", "angela", "neese", "kay", "quinton", "kobie-keys", "sir-naulte", "nitabug"];
/* v95 · Easy unchanged. Medium a little easier (3 opponents, same round time). Hard tougher with ~20% longer rounds (5 opponents). time = round clock factor. */
const ARCADE_DIFFICULTIES={easy:{count:1,label:'Easy',speed:88,wait:1.05,windup:.5,damage:.85,time:1},medium:{count:3,label:'Medium',speed:104,wait:.88,windup:.46,damage:.94,time:1},hard:{count:5,label:'Hard',speed:132,wait:.58,windup:.32,damage:1.18,time:1.2}};
const ARCADE_PROFILES={rayburn:['pHigh','kMid','wave'],sheila:['kHigh','kLow','wave'],tank:['pHigh','kMid','wave'],billie:['kHigh','kLow','wave'],major:['pHigh','kLow','wave'],cyon:['pMid','kHigh','wave'],'og-jerm':['pMid','kMid','wave'],kiana:['kHigh','kLow','wave'],jado:['pHigh','pMid','wave'],eli:['kMid','pMid','wave'],honest:['pLow','kLow','wave'],simcity:['kHigh','pHigh','wave'],'nige-hood':['pMid','kHigh','wave'],lyfelong:['pHigh','kMid','wave'],manager:['pLow','kLow','wave'],jimmy:['pHigh','kHigh','wave']};
Object.assign(ARCADE_PROFILES,{jazz:["kHigh","kMid","wave"],"j-read":["pHigh","pMid","wave"],"l-noelle":["pMid","kLow","wave"]});
Object.assign(ARCADE_PROFILES,{jazz:["kHigh","kMid","wave"],"j-read":["pHigh","pMid","wave"],"l-noelle":["pMid","kLow","wave"]});
Object.assign(ARCADE_PROFILES,{jazz:["kHigh","kMid","wave"],"j-read":["pHigh","pMid","wave"],"l-noelle":["pMid","kLow","wave"]});
Object.assign(ARCADE_PROFILES,{"idrum": ["pHigh", "kMid", "wave"], "sir-abstraxxx": ["pMid", "kLow", "wave"], "hookshot-charlie": ["kHigh", "pLow", "wave"], "mama-love": ["pHigh", "kMid", "wave"], "jaycee": ["pMid", "kLow", "wave"], "g-rod": ["kHigh", "pLow", "wave"], "dramas-key": ["pHigh", "kMid", "wave"], "rizzy": ["pMid", "kLow", "wave"], "dirty-harry": ["kHigh", "pLow", "wave"], "pg": ["pHigh", "kMid", "wave"], "ronnie": ["pMid", "kLow", "wave"], "big-kent": ["kHigh", "pLow", "wave"], "unk-major": ["pHigh", "kMid", "wave"], "unk-engineer": ["pMid", "kLow", "wave"], "unk-supporter": ["kHigh", "pLow", "wave"], "fouji": ["pHigh", "kMid", "wave"], "john-henry": ["pMid", "kLow", "wave"], "chaundra": ["kHigh", "pLow", "wave"], "wornitha": ["pHigh", "kMid", "wave"], "dee-dee": ["pMid", "kLow", "wave"], "angela": ["kHigh", "pLow", "wave"], "neese": ["pHigh", "kMid", "wave"], "kay": ["pMid", "kLow", "wave"], "quinton": ["kHigh", "pLow", "wave"], "kobie-keys": ["pHigh", "kMid", "wave"], "sir-naulte": ["pMid", "kLow", "wave"], "nitabug": ["kHigh", "pLow", "wave"]});
for(const [from,to]of Object.entries({"major":"unk-major","cyon":"ronnie","sheila":"unk-engineer","rayburn":"unk-supporter","tank":"dee-dee","billie":"angela"}))if(ARCADE_PROFILES[from])ARCADE_PROFILES[to]=ARCADE_PROFILES[from];
const ARCADE_JUMP=670,ARCADE_GRAVITY=1150;
/* v116 · Fixed 60-steps-a-second simulation. The fight always advances in exact 1/60 s steps (any screen refresh rate:
   30, 60, 120, 144 Hz…), several steps in one frame if the device falls behind, none if it's ahead. Same inputs → same fight
   on every device, which is the base for online play later. arcadeSyncHash() fingerprints the fight state; ?synctest=1 runs a check. */
const ARCADE_STEP=1/60,ARCADE_SYNC_REFERENCE='c90580d4'; /* update with `node --test scripts/getdown-sync.test.cjs` if fight rules change */
function createArcadeClock(step=ARCADE_STEP,maxSteps=6){let acc=0;return{step,reset(){acc=0;},advance(wallDt,speed,fn){acc+=Math.max(0,wallDt||0)*(speed||1);let n=0;while(acc>=step-1e-9&&n<maxSteps){acc-=step;n++;if(fn(step)===false)break;}if(n>=maxSteps&&acc>step)acc=step;return n;},get backlog(){return acc;}};}
/* sin(πt) for 0≤t≤1 from + − × ÷ only (Bhaskara), so every browser gets the exact same number; within 0.2% of Math.sin */
function arcadeSinPi(t){const u=t*(1-t);return 16*u/(5-4*u);}
function arcadeSyncHash(run){const s=JSON.stringify(run,(k,v)=>k==='events'||k==='seats'||k==='selectedLooks'||k==='rankedToken'||k==='effects'?undefined:v);let h=0x811c9dc5;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,0x01000193)>>>0;}return('0000000'+h.toString(16)).slice(-8);}
/* Scripted check: a CPU fight plus a pseudo-random Player 1, stepped frame by frame. Same build → same fingerprint everywhere. */
function arcadeSyncSelfTest(opts={}){const W=typeof window!=='undefined'?window:null,saved=W?[W.JERM747_ROUND_SCALE,W.__gdRanked,W.__gdPool]:null;if(W){W.JERM747_ROUND_SCALE=1;W.__gdRanked=false;W.__gdPool=null;}try{return arcadeSyncRun(opts);}finally{if(W){[W.JERM747_ROUND_SCALE,W.__gdRanked,W.__gdPool]=saved;}}}
function arcadeSyncRun(opts){const seconds=opts.seconds||150,seed=opts.seed||74702;const play=(feed)=>{const run=createArcadeRun('og-jerm','medium',seed,{opponent:'kiana',human1:true,human2:false});let r=seed>>>0||1;const rnd=()=>{r^=r<<13;r^=r>>>17;r^=r<<5;r>>>=0;return r/4294967296;};const moves=['pHigh','pMid','pLow','kHigh','kMid','kLow','wave'];const input={player2:{}};let hold=0,dir=0,marks=[];const total=Math.round(seconds/ARCADE_STEP);let stepped=0;const tick=()=>{if(hold<=0){const x=rnd();dir=x<.35?-1:x<.7?1:0;hold=6+Math.floor(rnd()*30);input.block=rnd()<.12;input.duck=rnd()<.08;}hold--;input.left=dir<0;input.right=dir>0;if(rnd()<.06)input.attack=moves[Math.floor(rnd()*moves.length)];if(rnd()<.02)input.jump=true;arcadeStep(run,input,ARCADE_STEP);if(run.mode==='round-over'&&!arcadeAdvance(run))return false;stepped++;if(stepped%600===0)marks.push(arcadeSyncHash(run));return run.mode!=='complete';};feed(tick,total);return{hash:arcadeSyncHash(run),marks,steps:stepped,mode:run.mode,score:run.score};};
 const direct=play((tick,total)=>{for(let i=0;i<total;i++)if(tick()===false)break;});
 const frames=(pattern)=>play((tick,total)=>{const clock=createArcadeClock(ARCADE_STEP,64);let done=0,i=0,stop=false;while(done<total&&!stop){const n=clock.advance(pattern[i++%pattern.length],1,()=>{if(done>=total)return false;done++;if(tick()===false){stop=true;return false;}});if(!n&&i>total*20)break;}});
 const at30=frames([1/30]),at144=frames([1/144]),jitter=frames([1/60,1/45,1/90,1/60,1/24,1/120]);
 const ok=[at30,at144,jitter].every(x=>x.hash===direct.hash);return{ok,hash:direct.hash,marks:direct.marks,steps:direct.steps,score:direct.score,checks:{direct:direct.hash,'30fps':at30.hash,'144fps':at144.hash,jitter:jitter.hash}};}
function arcadeRandom(run){let n=run.rng|0;n^=n<<13;n^=n>>>17;n^=n<<5;run.rng=n>>>0;return run.rng/4294967296;}
function createArcadeRun(member='og-jerm',difficulty='easy',seed=Date.now(),options={}){
 if(!ARCADE_FIGHTERS.includes(member))member='og-jerm';if(!ARCADE_DIFFICULTIES[difficulty])difficulty='easy';
 const run={local:options.local===true,human1:options.human1!==false,human2:options.human2??options.local===true,chosenOpponent:ARCADE_FIGHTERS.includes(options.opponent)?options.opponent:null,member,difficulty,rng:(seed>>>0)||747,queue:(typeof window!=='undefined'&&window.__gdPool?window.__gdPool():ARCADE_FIGHTERS).filter(id=>id!==member),opponentIndex:0,round:1,wins:0,losses:0,ties:0,roundsWon:0,matchesWon:0,score:0,mode:'ready',outcome:null,battle:null,events:[],results:[]};
 for(let i=run.queue.length-1;i>0;i--){const j=Math.floor(arcadeRandom(run)*(i+1));[run.queue[i],run.queue[j]]=[run.queue[j],run.queue[i]];}run.queue=run.queue.slice(0,ARCADE_DIFFICULTIES[difficulty].count);if(run.chosenOpponent||run.local)run.queue=[run.chosenOpponent||ARCADE_FIGHTERS.find(id=>id!==member)];arcadeStartRound(run);return run;
}
function arcadeStartRound(run){const actor=(x,facing,id)=>({groundedWalk:["angela", "billie", "chaundra", "cyon", "dee-dee", "eli", "honest", "jado", "john-henry", "kay", "kiana", "lyfelong", "major", "mama-love", "manager", "neese", "nige-hood", "nitabug", "og-jerm", "pg", "rayburn", "ronnie", "sheila", "simcity", "tank", "unk-engineer", "unk-major", "unk-supporter", "wornitha"].includes(id),/* v113: grounded steps, no auto-hop, no lean/bob for the original squad (Jimmy keeps his hop) */x,y:0,vy:0,facing,action:'idle',anim:0,cooldown:0,guard:false,invulnerable:0,windup:0,pending:null,attack:null,launch:0,launchAge:0,jumpAge:0,landAge:-1,hitAge:-1,hitHeight:'mid',hitDirection:0,movePhase:'idle',moveAge:0,lastMovement:0,duckAmount:0,duckTarget:false,defeatTime:-1,movePress:0,moveDir:0,stepDistance:0,stepRemaining:0,hopSpent:false,hopping:false,hopAge:0,hopDir:0,hopSpeed:0,moveSpeed:0,gait:0});run.battle={member:run.member,opponent:run.queue[run.opponentIndex],hp:120,bossHp:120,energy:100,bossEnergy:100,t:0,timeLeft:Math.round(75*arcadeRoundScale()*(ARCADE_DIFFICULTIES[run.difficulty]?.time||1)),mode:'fight',player:actor(220,1,run.member),boss:actor(720,-1,run.queue[run.opponentIndex]),projectiles:[],effects:[],events:[],fightBanner:1.2,readyTime:.9,blockPoints:0};run.battle.boss.cooldown=run.human2?0:1.4;run.battle.player.cooldown=run.human1?0:1.4;run.mode='fight';run.outcome=null;run.roundReward=null;run.events=[];}function arcadeRoundScale(){try{const v=typeof window!=='undefined'?+window.JERM747_ROUND_SCALE:1;return v>=1&&v<=2?v:1;}catch(e){return 1;}}function arcadeImpact(run,target,damage,height='mid'){
 const b=run.battle,a=target==='player'?b.player:b.boss,other=target==='player'?b.boss:b.player;if(a.invulnerable>0)return false;
 if((a.duckAmount||0)>.65&&height==='high'&&other.y>-90)return false;
 const guarded=a.guard&&a.y>=-.5&&other.y>-90,amount=Math.min(target==='player'?b.hp:b.bossHp,damage*(guarded?.2:1)/arcadeRoundScale());
 if(target==='player')b.hp=Math.max(0,b.hp-amount);else{b.bossHp=Math.max(0,b.bossHp-amount);run.score=Math.min(100000,run.score+Math.round(amount*10));}
 a.invulnerable=guarded?.14:.34;if(!guarded){a.action='hit';a.anim=.3;a.hitAge=0;a.hitHeight=height;a.hitDirection=a.x>=other.x?1:-1;a.attack=null;a.windup=0;a.pending=null;a.launch=0;a.duckTarget=false;a.cooldown=Math.max(a.cooldown,.32);}
 b.effects.push({kind:guarded?'block':'hit',x:a.x,y:(height==='high'?205:height==='low'?325:270)+a.y,life:.24,color:guarded?'#8ff5ed':'#ffe29b'});
 b.events.push({type:guarded?'block':'hit',target,height});if(target==='player'&&guarded&&b.blockPoints<100){run.score+=5;b.blockPoints+=5;}return true;
}
function arcadeAttack(run,move,enemy=false){
 const b=run.battle,a=enemy?b.boss:b.player,spec=CATALOG_MOVES[move],energy=enemy?'bossEnergy':'energy';
 if(run.mode!=='fight'||b.readyTime>0||!spec||a.cooldown>0||b[energy]<spec.cost||a.guard||a.hitAge>=0&&a.hitAge<.3)return false;
 a.duckTarget=false;a.duckAmount=0;a.action=move;a.anim=spec.duration;a.cooldown=spec.duration+.08;a.attack={move,elapsed:0,connected:false,facing:a.facing};b[energy]-=spec.cost;b.events.push({type:'attack',target:enemy?'boss':'player',move});return true;
}
function arcadeResolveAttack(run,a,enemy,dt){
 const attack=a.attack;if(!attack)return;const spec=CATALOG_MOVES[attack.move];attack.elapsed+=dt;
 const contact=spec.duration*.32;
 if(!attack.connected&&attack.elapsed>=contact){attack.connected=true;const b=run.battle,target=enemy?b.player:b.boss,damage=spec.damage*((enemy?!run.human2:!run.human1)?ARCADE_DIFFICULTIES[run.difficulty].damage:1);
  if(spec.kind==='wave')b.projectiles.push({owner:enemy?'boss':'player',x:a.x+attack.facing*35,y:268+a.y,vx:attack.facing*((enemy?!run.human2:!run.human1)?350:460),damage,life:2.7,color:catalogMemberColor(enemy?b.opponent:run.member)});
  else{const distance=target.x-a.x;if(Math.abs(distance)<spec.range&&distance*attack.facing>=-20&&Math.abs(a.y-target.y)<90)arcadeImpact(run,enemy?'player':'boss',damage,spec.height);}
 }
 if(attack.elapsed>=spec.duration){a.attack=null;}
}
// Digital presses build from a small step to one committed low hop, then a run.
// Stick magnitude selects an intensity; footfall phase advances with distance.
const ARCADE_MOVEMENT={step:75,hop:132,run:214.5,stepLength:8,hopAt:.16,runAt:.48,hopJump:180,stride:96};
function arcadeResetMovement(a){a.movePress=0;a.moveDir=0;a.stepDistance=0;a.stepRemaining=0;a.hopSpent=false;a.moveSpeed=0;a.lastMovement=0;}
function arcadeMove(a,movement,dt,analog=null,cap=ARCADE_MOVEMENT.run){
 const M=ARCADE_MOVEMENT,previous=a.moveDir||0;
 if(movement&&movement!==previous){a.movePress=0;a.stepDistance=0;a.stepRemaining=0;a.hopSpent=a.hopping;a.moveDir=movement;a.movePhase='step';a.moveAge=0;a.gait=0;}
 if(movement)a.movePress+=dt;
 if(!movement&&previous){if(a.movePress<M.hopAt&&!a.hopping)a.stepRemaining=Math.max(0,M.stepLength-a.stepDistance);a.moveDir=0;a.movePhase='stop';a.moveAge=0;a.moveSpeed=0;}
 if(!movement&&!a.hopping&&!(a.stepRemaining>0)){if(a.movePhase==='hop'){a.movePhase='stop';a.moveAge=0;}a.moveAge+=dt;if(a.moveAge>=.12)a.movePhase='idle';a.action='idle';a.moveSpeed=0;a.movePress=0;a.hopSpent=false;a.lastMovement=0;return;}
 const retreat=movement*a.facing<0,amount=Number.isFinite(analog)?Math.abs(analog):null;
 let intensity=amount===null?(a.movePress<M.hopAt?1:a.movePress<M.runAt?2:3):(amount<.38?1:amount<.72?2:3);
 if(amount!==null&&intensity===2&&a.hopSpent&&!a.hopping){a.hopAge+=dt;if(a.hopAge>=.52)a.hopSpent=false;}
 // A high jump remains separate and allows immediate air steering.
 if(a.y<0&&!a.hopping){a.moveSpeed=movement?cap:0;a.hopSpent=true;const dx=movement*a.moveSpeed*dt;a.x=Math.max(60,Math.min(840,a.x+dx));a.action=a.vy<0?'jump':'fall';return;}
 if(!a.groundedWalk&&movement&&intensity>=2&&a.movePress>=M.hopAt&&!a.hopSpent&&a.launch<=0){a.hopping=true;a.hopSpent=true;a.hopAge=0;a.hopDir=movement;a.hopSpeed=Math.min(M.hop,cap);a.y=-.01;a.vy=-M.hopJump;a.landAge=-1;a.movePhase='hop';}
 let direction=movement,speed=0,dx=0;
 if(a.hopping){direction=a.hopDir;speed=a.hopSpeed;a.action='hop';a.movePhase='hop';}
 else if(a.stepRemaining>0&&!movement){direction=previous||a.lastMovement;speed=Math.min(M.step,cap);a.action='step';a.movePhase='step';}
 else if(intensity===3&&a.movePress>=M.runAt){const target=cap;a.moveSpeed=Math.min(target,Math.max(Math.min(M.hop,cap),a.moveSpeed)+dt*700);speed=a.moveSpeed;a.action=retreat?'backstep':'run';a.movePhase='run';}
 else{speed=Math.min(M.step,cap);a.action='step';a.movePhase='step';}
 dx=direction*speed*dt;if(!movement&&!a.hopping&&a.stepRemaining>0){dx=direction*Math.min(a.stepRemaining,Math.abs(dx));a.stepRemaining=Math.max(0,a.stepRemaining-Math.abs(dx));}
 const oldX=a.x;a.x=Math.max(60,Math.min(840,a.x+dx));const distance=Math.abs(a.x-oldX);a.gait=(a.gait+distance/(a.action==='step'?64:M.stride))%1;a.stepDistance+=distance;a.moveSpeed=speed;a.moveAge+=dt;if(direction)a.lastMovement=direction;
 if(!movement&&!a.hopping&&a.stepRemaining===0){a.movePhase='stop';a.moveAge=0;a.action='idle';a.moveSpeed=0;a.lastMovement=0;}
}
function arcadePose(a,time=0){
 if(a.action==='down')return a.defeatTime>=0?{sheet:'ko',frame:Math.min(11,Math.floor(a.defeatTime/.1))}:{sheet:'base',frame:0};
 if(a.hitAge>=0&&a.hitAge<.3){const t=a.hitAge,offset=a.hitHeight==='high'?8:a.hitHeight==='low'?12:10;return{sheet:'reaction',frame:t<.09?offset:t<.18?offset+1:t<.24?14:15};}
 if(a.attack){const spec=CATALOG_MOVES[a.attack.move],f=a.attack.elapsed/spec.duration;if(spec.kind!=='wave'){const n=spec.kind==='punch'?8:12;if(f<.16)return{sheet:'motion',frame:n};if(f<.32)return{sheet:'motion',frame:n+1};if(f>=.56)return{sheet:'motion',frame:n+(f<.78?2:3)};}return{sheet:'base',frame:spec.frame};}
 if(a.hopping&&a.y<0)return{sheet:'legs',frame:a.hopAge<.075?1:a.vy<0?3:a.vy<90?2:0};
 if(a.launch>0)return{sheet:'reaction',frame:a.launchAge<.025?0:1};
 if(a.y<0)return{sheet:'reaction',frame:a.vy<0?(a.jumpAge<.2?2:3):(a.vy<280?4:5)};
 if(a.landAge>=0&&a.landAge<.18)return{sheet:'reaction',frame:a.landAge<.08?6:7};
 if((a.duckAmount||0)>0)return{sheet:'legs',frame:a.duckTarget?(a.duckAmount<.5?4:a.duckAmount<1?5:6):(a.duckAmount>.5?7:8)};
 if(a.action==='back-block')return{sheet:'back',frame:4+Math.floor((a.gait||0)*2)%2};
 if(a.action==='backstep')return{sheet:'back',frame:Math.floor((a.gait||0)*4)%4};
 if(a.groundedWalk&&a.action==='step')return{sheet:'back',frame:Math.floor((a.gait||0)*4)%4};
 if(a.action==='step')return{sheet:'back',frame:a.movePress<ARCADE_MOVEMENT.hopAt||a.stepRemaining>0?Math.min(1,Math.floor((a.stepDistance||0)/4)):Math.floor((a.gait||0)*4)%4};
 if(a.action==='block')return{sheet:'base',frame:7};
 if(a.movePhase==='start')return{sheet:'motion',frame:a.moveAge<.06?2:3};
 if(a.movePhase==='stop')return{sheet:'motion',frame:a.moveAge<.06?6:7};
 if(a.action==='run')return{sheet:'legs',frame:Math.floor((a.gait||0)*4)%4};
 return{sheet:'motion',frame:Math.floor(time*3.2)%2};
}
function arcadeSettle(run){const b=run.battle;if(run.mode!=='fight')return;const scoreBefore=run.score;const outcome=b.hp===b.bossHp?'draw':b.hp>b.bossHp?'win':'loss';run.outcome=outcome;run.mode='round-over';b.mode='round-over';b.projectiles=[];for(const a of[b.player,b.boss]){a.guard=false;a.duckTarget=false;a.duckAmount=0;a.attack=null;a.hitAge=-1;a.launch=0;a.movePhase='idle';a.hopping=false;arcadeResetMovement(a);}
 if(outcome==='win'){run.wins++;run.roundsWon++;run.score=Math.min(100000,run.score+500+Math.round(b.hp)*3+Math.ceil(b.timeLeft)*2);b.boss.action='down';b.player.action='idle';}else if(outcome==='loss'){run.losses++;b.player.action='down';}else run.ties++;
 run.results.push({opponent:b.opponent,round:run.round,outcome,hp:Math.round(b.hp),score:run.score});if(run.wins===2){run.matchesWon++;run.score=Math.min(100000,run.score+750);}run.roundReward={total:run.score-scoreBefore,matchup:outcome==='win'&&run.wins===2};run.events.push({type:'roundEnd',outcome,matchWon:run.wins===2,matchLost:run.losses===2});if(outcome!=='draw'){const loser=outcome==='win'?b.boss:b.player,other=outcome==='win'?b.player:b.boss;loser.facing=other.x<loser.x?-1:1;loser.defeatTime=0;run.knockout={elapsed:0,actor:outcome==='win'?'boss':'player',fromX:loser.x,fromY:loser.y,toX:Math.max(100,Math.min(800,loser.x-loser.facing*110))};run.mode='knockout';b.mode='knockout';}
}
function arcadeAdvance(run){if(run.mode!=='round-over')return false;if(run.losses===2){run.mode='complete';run.outcome='loss';return true;}if(run.wins===2){if(run.opponentIndex===run.queue.length-1){run.mode='complete';run.outcome='win';run.score=Math.min(100000,run.score+1000*run.queue.length);return true;}run.opponentIndex++;run.wins=0;run.losses=0;run.ties=0;run.round=1;}else run.round++;arcadeStartRound(run);return true;}
function arcadeHuman(p,a,input,dt){
 // Block/duck cancel a low traveling hop; they do not teleport a full jump.
 if((input.block||input.duck)&&p.hopping){p.hopping=false;p.y=0;p.vy=0;p.landAge=-1;arcadeResetMovement(p);}
 const wantDuck=!!input.duck&&p.y>=-.5&&!p.attack&&p.hitAge<0&&p.launch<=0;p.duckTarget=wantDuck;
 p.duckAmount=Math.max(0,Math.min(1,(p.duckAmount||0)+(wantDuck?1:-1)*dt/.14));
 if(input.jump&&!wantDuck&&!input.block)p.duckAmount=0;
 p.guard=(!!input.block||p.duckAmount>0||wantDuck)&&p.y>=-.5&&!p.attack&&p.hitAge<0;
 if(!p.guard&&!p.attack&&p.hitAge<0&&(p.action==='block'||p.action==='back-block'))p.anim=0;
 const tap=input.tapDirection||0;input.tapDirection=0;const movement=input.left&&input.right?0:((input.right?1:0)-(input.left?1:0)||tap);if(!p.attack&&p.hitAge<0)p.facing=a.x<p.x?-1:1;
 const guardRetreat=p.guard&&!!input.block&&movement*p.facing<0&&p.duckAmount===0&&!wantDuck;
 if(p.guard){p.action='block';p.anim=p.duckAmount>0?0:.08;arcadeResetMovement(p);if(guardRetreat){const old=p.x;p.x=Math.max(60,Math.min(840,p.x+movement*dt*107.25));p.action='back-block';p.gait=(p.gait+Math.abs(p.x-old)/48)%1;}}
 else if(p.anim<=0&&!p.attack&&p.hitAge<0)arcadeMove(p,movement,dt,input.moveAxis);
 else arcadeResetMovement(p);
 if(input.jump&&(p.y>=-.5||p.hopping)&&!p.guard&&p.launch<=0&&p.hitAge<0){p.hopping=false;p.launch=.05;p.launchAge=0;p.stepRemaining=0;p.hopSpent=true;}input.jump=false;
}
function arcadeCPU(run,a,p,enemy,dt){const b=run.battle,cfg=ARCADE_DIFFICULTIES[run.difficulty],level=run.difficulty==='hard'?2:run.difficulty==='medium'?1:0;
 // Seeded decisions keep replay/online simulations reproducible. Movement speed and strike timing stay unchanged.
 if(!a.ai)a.ai={style:Math.floor(arcadeRandom(run)*3),next:5+arcadeRandom(run)*4,lastMove:null,streak:0};
 const ai=a.ai;if(b.t>=ai.next){ai.style=(ai.style+1+Math.floor(arcadeRandom(run)*2))%3;ai.next=b.t+6+arcadeRandom(run)*5;}
 if(a.attack||a.hitAge>=0)return;
 a.facing=p.x<a.x?-1:1;const distance=Math.abs(a.x-p.x),energy=enemy?b.bossEnergy:b.energy;
 if(a.windup>0){a.windup-=dt;if(a.windup<=0){a.guard=false;a.cooldown=0;arcadeAttack(run,a.pending,enemy);a.pending=null;a.cooldown+=cfg.wait*(.85+arcadeRandom(run)*.3);}return;}
 if(a.cooldown<=0){
  const r=arcadeRandom(run),blockChance=[.12,.25,.16][ai.style]+(p.attack?.move? .08+level*.025:0),jumpChance=.025+level*.015;
  if(r<blockChance&&distance<235){a.guard=true;a.duckTarget=(p.attack?.move?.endsWith('Low')||arcadeRandom(run)<.35);a.action='block';a.anim=.24+arcadeRandom(run)*.25;a.cooldown=a.anim+.08;return;}
  if(r>1-jumpChance&&a.y===0){a.guard=false;a.duckTarget=false;a.duckAmount=0;a.hopping=false;a.hopSpent=true;a.launch=.05;a.launchAge=0;a.cooldown=.45;return;}
  a.guard=false;a.duckTarget=false;
  if(distance>225&&arcadeRandom(run)<.6){a.cooldown=.16+arcadeRandom(run)*.2;}
  else{
   const profile=ARCADE_PROFILES[enemy?b.opponent:b.member]||['pMid','kMid','wave'],physical=['pHigh','pMid','pLow','kHigh','kMid','kLow'];
   const pool=[...physical,...Array.from({length:3-level},()=>profile.filter(x=>x!=='wave')).flat()];
   let move=distance>195&&energy>=20?'wave':pool[Math.floor(arcadeRandom(run)*pool.length)];
   if(distance>140&&energy>=20&&arcadeRandom(run)<.08+level*.035)move='wave';
   if(move===ai.lastMove&&ai.streak>=2){const alternatives=physical.filter(x=>x!==move);move=alternatives[Math.floor(arcadeRandom(run)*alternatives.length)];}
   ai.streak=move===ai.lastMove?ai.streak+1:1;ai.lastMove=move;a.pending=move;
   a.windup=cfg.windup*(.92+arcadeRandom(run)*.16);a.action='block';a.anim=a.windup;return;
  }
 }
 if(a.anim<=0){a.guard=false;a.duckTarget=false;const reach=[108,145,190][ai.style],retreat=distance<reach-28&&ai.style!==0;arcadeMove(a,distance>reach+12?a.facing:retreat?-a.facing:0,dt,null,cfg.speed);}else arcadeResetMovement(a);
}
/* build173: swept, ordered opposing-wave contacts; a cancelled wave never damages a fighter. */
function arcadeClashWaves(b,dt){
 const hits=[];
 for(let i=0;i<b.projectiles.length;i++)for(let j=i+1;j<b.projectiles.length;j++){
  const a=b.projectiles[i],c=b.projectiles[j],dx=c.x-a.x,relative=a.vx-c.vx;
  if(a.life<=0||c.life<=0||a.owner===c.owner||a.vx*c.vx>=0||Math.abs(a.y-c.y)>36)continue;
  if(Math.abs(dx)>30&&dx*relative<=0)continue;
  const t=Math.abs(dx)<=30?0:(Math.abs(dx)-30)/Math.abs(relative);
  if(t<=dt&&t<a.life&&t<c.life)hits.push({a,c,t,i,j});
 }
 hits.sort((a,c)=>a.t-c.t||a.i-c.i||a.j-c.j);
 for(const {a,c,t}of hits){if(a.life<=0||c.life<=0)continue;const x=(a.x+a.vx*t+c.x+c.vx*t)/2,y=(a.y+c.y)/2;a.life=c.life=0;b.effects.push({x,y,life:.28,color:'#baf9ff',kind:'wave-clash'});b.events.push({type:'wave-clash',x,y});}
}
function arcadeStep(run,input,dt){dt=Math.min(.05,Math.max(0,dt));run.events=[];if(run.mode==='knockout'){const b=run.battle,k=run.knockout,a=b[k.actor];k.elapsed+=dt;b.t+=dt;a.defeatTime=k.elapsed;const travel=Math.min(1,k.elapsed/.8);a.x=k.fromX+(k.toX-k.fromX)*travel;a.y=travel<1?k.fromY*(1-travel)-arcadeSinPi(travel)*65:0;a.vy=0;b.effects=b.effects.filter(e=>(e.life-=dt)>0);for(const actor of[b.player,b.boss])actor.invulnerable=Math.max(0,actor.invulnerable-dt);input.attack=null;input.jump=false;if(input.player2){input.player2.attack=null;input.player2.jump=false;}if(k.elapsed>=1.5){run.mode='round-over';b.mode='round-over';a.y=0;}return;}if(run.mode!=='fight')return;const b=run.battle;b.events=[];b.fightBanner=Math.max(0,b.fightBanner-dt);b.readyTime=Math.max(0,b.readyTime-dt);if(b.readyTime>0){input.tapDirection=0;if(input.player2)input.player2.tapDirection=0;input.attack=null;input.jump=false;if(input.player2){input.player2.attack=null;input.player2.jump=false;}return;}
 b.t+=dt;b.timeLeft=Math.max(0,b.timeLeft-dt);b.effects=b.effects.filter(e=>(e.life-=dt)>0);const p=b.player,a=b.boss,cfg=ARCADE_DIFFICULTIES[run.difficulty];
 for(const actor of[p,a]){actor.cooldown=Math.max(0,actor.cooldown-dt);actor.anim=Math.max(0,actor.anim-dt);actor.invulnerable=Math.max(0,actor.invulnerable-dt);if(actor.hitAge>=0){actor.hitAge+=dt;if(actor.hitAge<.18)actor.x+=actor.hitDirection*90*dt;else if(actor.hitAge<.3)actor.x-=actor.hitDirection*30*dt;else actor.hitAge=-1;}if(actor.landAge>=0)actor.landAge+=dt;actor.x=Math.max(60,Math.min(840,actor.x));}
 b.energy=Math.min(100,b.energy+dt*13);b.bossEnergy=Math.min(100,b.bossEnergy+dt*13);
 for(const [actor,other,human,state] of [[p,a,run.human1,input],[a,p,run.human2,input.player2||(input.player2={})]]){if(human)arcadeHuman(actor,other,state,dt);else{state.attack=null;state.jump=false;const target=actor.duckTarget&&actor.y>=-.5&&actor.hitAge<0?1:0;actor.duckAmount=Math.max(0,Math.min(1,actor.duckAmount+(target?1:-1)*dt/.14));}}
 for(const actor of[p,a]){if(actor.launch>0){actor.launchAge+=dt;actor.launch-=dt;if(actor.launch<=0){actor.y=Math.min(-1,actor.y);actor.vy=-ARCADE_JUMP;actor.jumpAge=0;actor.landAge=-1;b.events.push({type:'jump',target:actor===p?'player':'boss'});}}if(actor.y<0){if(actor.hopping)actor.hopAge+=dt;actor.jumpAge+=dt;actor.vy+=ARCADE_GRAVITY*dt;actor.y+=actor.vy*dt;if(actor.y>=0){const hopped=actor.hopping;actor.y=0;actor.vy=0;actor.hopping=false;actor.landAge=hopped?-1:0;b.events.push({type:'land',target:actor===p?'player':'boss'});}else if(actor.anim<=0)actor.action=actor.hopping?'hop':actor.vy<0?'jump':'fall';}}
 if(run.human1&&input.attack){arcadeAttack(run,input.attack);input.attack=null;}if(run.human2&&input.player2?.attack){arcadeAttack(run,input.player2.attack,true);input.player2.attack=null;}input.assist=null;input.gather=false;
 const trade=p.attack&&a.attack&&!p.attack.connected&&!a.attack.connected&&p.attack.elapsed+dt>=CATALOG_MOVES[p.attack.move].duration*.32&&a.attack.elapsed+dt>=CATALOG_MOVES[a.attack.move].duration*.32,secondAttack=a.attack;
 arcadeResolveAttack(run,p,false,dt);if(trade&&!a.attack){a.attack=secondAttack;arcadeResolveAttack(run,a,true,dt);a.attack=null;}else arcadeResolveAttack(run,a,true,dt);
 if(!run.human1)arcadeCPU(run,p,a,false,dt);if(!run.human2)arcadeCPU(run,a,p,true,dt);
 if(Math.abs(a.x-p.x)<55&&Math.abs(a.y-p.y)<65){const middle=(a.x+p.x)/2,direction=p.x<=a.x?1:-1;p.x=Math.max(60,Math.min(840,middle-direction*28));a.x=Math.max(60,Math.min(840,middle+direction*28));}
 arcadeClashWaves(b,dt);
 for(const wave of b.projectiles){if(wave.life<=0)continue;wave.x+=wave.vx*dt;wave.life-=dt;const target=wave.owner==='player'?a:p;if(Math.abs(wave.x-target.x)<35&&Math.abs(wave.y-((target.duckAmount>.65?310:270)+target.y))<(target.duckAmount>.65?34:64)){arcadeImpact(run,wave.owner==='player'?'boss':'player',wave.damage);wave.life=0;}}
 b.projectiles=b.projectiles.filter(w=>w.life>0&&w.x>-80&&w.x<1000);if(b.hp<=0||b.bossHp<=0||b.timeLeft<=0)arcadeSettle(run);
}
if(typeof module!=='undefined')module.exports={ARCADE_SYNC_REFERENCE,ARCADE_STEP,createArcadeClock,arcadeSinPi,arcadeSyncHash,arcadeSyncSelfTest,ARCADE_FIGHTERS,ARCADE_DIFFICULTIES,ARCADE_JUMP,ARCADE_GRAVITY,createArcadeRun,arcadeAttack,arcadeStep,arcadeAdvance,arcadeSettle,arcadeImpact,arcadePose,ARCADE_MOVEMENT};
