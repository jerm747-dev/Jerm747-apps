/* v136: authenticated invitations and server-timed lobby countdown. No remote fight yet. */
(()=>{'use strict';
const $=id=>document.getElementById(id),protocol='getdown-match-1';
const labels={'og-jerm':'OG Jerm','kiana':'Kiana','jado':'Jado','eli':'Eli','honest':'Honest','simcity':'SimCity','nige-hood':'Nige Hood','lyfelong':'Lyfelong','jimmy':'Jimmy Legend','manager':'The Manager','jazz':'Jazz','j-read':'J Reed','l-noelle':'L Noelle','idrum':'iDrum','sir-abstraxxx':'Sir Abstraxxx','hookshot-charlie':'Hookshot Charlie','mama-love':'Mama Love','jaycee':'JayCee','g-rod':'G Rod','dramas-key':"Drama’s Key",'rizzy':'Rizzy','dirty-harry':'Dirty Harry','pg':'P.G.','ronnie':'Ronnie','big-kent':'Big Kent','unk-major':'Unk the Major','unk-engineer':'Unk the Engineer','unk-supporter':'Unk the Supporter','fouji':'Fuji','john-henry':'John Henry','chaundra':'Chaundra','wornitha':'Wornitha','dee-dee':'Dee Dee','angela':'Angela','neese':'Neese','kay':'Kay','quinton':'Quinton','kobie-keys':'Kobie','sir-naulte':'Sir Naulte','nitabug':'NitaBug'};
const name=id=>labels[id]||id;
let joinToken='';
try{joinToken=sessionStorage.getItem('jerm747.challenge.join.'+location.search)||'';}catch{}
if(!/^[a-f0-9]{48}$/.test(joinToken)){joinToken=Array.from(crypto.getRandomValues(new Uint8Array(24)),b=>b.toString(16).padStart(2,'0')).join('');try{sessionStorage.setItem('jerm747.challenge.join.'+location.search,joinToken);}catch{}}
let awayGeneration=0,gameLoadStart=0,localAway=false,focusedMatch='',driver=null,matchId='',exchangeBusy=false,acc=0,lastAnimation=0,latestInput='Waiting for input';
let csrf='',session=null,state=null,busy=false,queue=Promise.resolve(),samples=[],offset=0,lastReply=-Infinity,ended=false;
const params=new URLSearchParams(location.search),room=params.get('room'),invite=new URLSearchParams(location.hash.slice(1)).get('invite');
const key=id=>'jerm747.challenge.v136.'+id;
const save=()=>{try{sessionStorage.setItem(key(session.room),JSON.stringify(session));}catch{status('Keep this tab open: this browser cannot save the lobby connection.');}};
function status(s){$('status').textContent=s;}
async function raw(action,extra={}){
 const start=performance.now(),controller=new AbortController(),timer=setTimeout(()=>controller.abort(),4000);
 try{const r=await fetch('/api/challenge.php',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','X-CSRF-Token':csrf},body:JSON.stringify({protocol,...session,action,...extra}),signal:controller.signal,cache:'no-store'});const d=await r.json();if(!r.ok){const e=new Error(d.error||'Lobby unavailable.');e.status=r.status;throw e;}
 const finish=performance.now(),rtt=finish-start;samples.push({rtt,offset:d.serverNow-(start+finish)/2});samples=samples.slice(-10);offset=samples.reduce((a,b)=>a.rtt<b.rtt?a:b).offset;lastReply=finish;return d;
 }finally{clearTimeout(timer);}
}
function render(d){
 state=d;ensureGame();syncMatch(d);$('entry').hidden=$('invitation').hidden=true;$('lobby').hidden=false;
 for(const r of ['host','guest']){const p=d[r];$(r+'-fighter').textContent=p?name(p.fighter):'Waiting for your friend';$(r+'-state').textContent=p?(!p.online?'Connection interrupted':p.ready?'✓ Ready':'Choosing / not ready'): 'Not joined yet';}
 const options=d.fighters.join('|');if($('fighter').dataset.options!==options){$('fighter').replaceChildren(...d.fighters.map(id=>{const o=document.createElement('option');o.value=id;o.textContent=name(id);return o;}));$('fighter').dataset.options=options;}
 $('fighter').value=d[session.role].fighter;$('ready').textContent=d[session.role].ready?'Cancel ready':'I’m ready';$('reset').hidden=!['playing','finished','desync'].includes(d.phase);
 $('sharing').hidden=session.role!=='host';
 if(session.role==='host'&&session.invite){const url=new URL('/groove-squad-challenge.html',location.origin);url.searchParams.set('room',d.room);url.hash='invite='+session.invite;$('share-link').value=url.href;}
 $('share').disabled=$('copy').disabled=!!d.guest;
 if(d.phase==='finished')status('Match finished — both players’ final state checks agree.');
 else if(d.phase==='desync')status('The games went out of sync. Return to the lobby for a rematch.');
 else if(d.phase==='playing')status('Online match · '+(session.role==='host'?'You are Player 1':'You are Player 2'));
 else if(d.phase==='countdown')status('Both ready. Counting down together…');
 else status(d.notice|| (d.guest?'Check your fighter, then both choose “I’m ready”.':'Your lobby is open. Send the invitation to one friend.'));
 controls();tick();
}
function game(){try{return $('online-game').contentWindow?.Jerm747Online;}catch{return null;}}
function ensureGame(){if(!$('online-game').getAttribute('src')){gameLoadStart=performance.now();$('online-game').src='/groove-squad-get-down.html?online=1&v=137';}}
window.Jerm747ChallengeAccess=()=>!!session&&!!state?.liveBattleAvailable&&state.room===session.room&&!ended;
function gameReady(){return !!state&&!!game()?.ready(state.host.fighter,state.guest?.fighter||'kiana');}
function controls(){const stale=performance.now()-lastReply>3000,locked=busy||stale||ended||localAway,playing=['playing','finished','desync'].includes(state?.phase);$('ready').disabled=locked||!state||playing||!gameReady();$('fighter').disabled=locked||!state||playing;$('reset').disabled=locked;$('leave').disabled=busy||ended;$('configure').disabled=playing||!game();}
function stopMatch(){driver=null;matchId='';acc=0;document.body.classList.remove('in-match');$('game-section').hidden=true;game()?.stop();}
function syncMatch(d){
 if(localAway)return;
 if(!d.match){if(driver)stopMatch();return;}
 if(['desync','finished'].includes(d.phase)){document.body.classList.remove('in-match');return;}
 if(d.match.id!==matchId&&gameReady()){
  game().launch(d.match,session.role);matchId=d.match.id;acc=0;
  driver=window.Jerm747Lockstep.create({role:session.role,capture(){const rawInput=game().capture(),x=state?.phase==='playing'?rawInput:{};latestInput=Object.entries(x).filter(([k,v])=>v===true||k==='attack'&&v).map(([k,v])=>k==='attack'?v:k).join(', ')||'Neutral';return x;},step:(a,b)=>game().step(a,b),hash:()=>game().hash(),isDone:()=>game().done()});
  $('game-section').hidden=false;$('your-side').textContent=session.role==='host'?'You control Player 1 · left fighter':'You control Player 2 · right fighter';document.body.classList.add('in-match');
 }
}
async function exchange(){if(exchangeBusy||!driver||ended||document.hidden||!['countdown','playing'].includes(state?.phase))return;exchangeBusy=true;const active=driver,id=matchId;
 try{const d=await run('exchange',{match:id,...active.request(),batch:active.batch()||undefined});if(driver===active&&d?.match?.id===id)active.accept(d);}catch(e){if(e.status===409){localAway=true;stopMatch();status(e.message+' Returning both players to the lobby.');run('reset').then(()=>{localAway=false;}).catch(()=>{});}}finally{exchangeBusy=false;}
}
function animation(t){const dt=lastAnimation?Math.min(.05,(t-lastAnimation)/1000):0;lastAnimation=t;
 if(driver&&state?.phase==='playing'&&!ended&&!document.hidden&&performance.now()-lastReply<1500){acc=Math.min(.1,acc+dt);let limit=6;while(acc>=1/60&&limit-->0){if(!driver.advance(1)){acc=Math.min(acc,1/60);break;}acc-=1/60;}}
 if(driver){const s=driver.state();$('network-status').textContent='Step '+s.frame+' · '+(state?.phase==='desync'?'State mismatch':state?.phase==='finished'?'Final state verified':performance.now()-lastReply>=1500?'Connection interrupted':s.waiting?'Waiting for both input streams':'Inputs connected')+' · Your controls: '+latestInput;}
 if(driver&&state?.phase==='playing'&&focusedMatch!==matchId){focusedMatch=matchId;game()?.focus();}
 requestAnimationFrame(animation);
}
requestAnimationFrame(animation);setInterval(exchange,100);
window.Jerm747ChallengePause=()=>{if(driver)away();};
window.addEventListener('message',async e=>{if(e.origin!==location.origin||e.source!==$('online-game').contentWindow||e.data?.type!=='jerm747-getdown-fullscreen')return;try{if(document.fullscreenElement)await document.exitFullscreen();else await $('online-game').requestFullscreen();}catch{status('Fullscreen is unavailable in this browser.');}});
$('configure').onclick=()=>{$('game-section').hidden=false;$('your-side').textContent='Set up your local Player 1 controls. They drive your assigned fighter online.';game()?.configure();};

function run(action,extra={}){
 const task=async()=>{if(ended)return;busy=true;controls();try{const d=await raw(action,extra);render(d);return d;}catch(e){status(e.name==='AbortError'?'Connection interrupted. Waiting to reconnect…':e.message);if([403,404,410].includes(e.status)){ended=true;stopMatch();$('countdown').textContent='';$('countdown-label').textContent='This lobby is unavailable. Open a new challenge from the game.';}else if(action!=='poll'){lastReply=-Infinity;}throw e;}finally{busy=false;controls();}};
 const result=queue.then(task);queue=result.catch(()=>{});return result;
}
function tick(){
 if(!state||ended)return;if(state.phase==='lobby'&&!gameReady())status(performance.now()-gameLoadStart>30000?'Fighter art or controls could not finish loading. Check that the artwork is installed, then reload.':'Loading fighter art and controls before readying up…');const now=performance.now()+offset,remaining=state.expires-now;$('expiry').textContent=Math.max(0,Math.ceil(remaining/60000))+' min';
 if(remaining<=0){ended=true;stopMatch();status('This challenge expired. Create a new link from the game.');$('countdown').textContent='';$('countdown-label').textContent='';controls();return;}
 if(performance.now()-lastReply>3000||document.hidden){$('countdown').textContent='';$('countdown-label').textContent='Waiting for a fresh connection…';controls();return;}
 if(state.phase==='countdown'){
 const ms=state.startAt-now;$('countdown').textContent=ms>3000?'':ms>0?String(Math.ceil(ms/1000)):'…';$('countdown-label').textContent=ms>3000?'Both ready · countdown starting':ms>0?'Get ready!':'Confirming both players are still connected…';
 }else if(state.phase==='playing'){$('countdown').textContent='';$('countdown-label').textContent='Fight! Both players’ controls are connected.';}else if(state.phase==='finished'){$('countdown').textContent='✓';$('countdown-label').textContent='Match complete · both simulations agree.';}
 else{$('countdown').textContent='';$('countdown-label').textContent='';}controls();
}
$('create').onclick=async()=>{if(busy)return;busy=true;$('create').disabled=true;try{const d=await raw('create');session={room:d.room,role:'host',token:d.token,invite:d.invite};save();history.replaceState(null,'','?room='+d.room);render(d);}catch(e){status(e.message);$('account-links').hidden=false;}finally{busy=false;$('create').disabled=false;controls();}};
$('join').onclick=async()=>{if(busy)return;busy=true;$('join').disabled=true;try{const d=await raw('join',{room,invite,joinToken});session={room:d.room,role:'guest',token:d.token};save();history.replaceState(null,'','?room='+d.room);render(d);}catch(e){status(e.message);$('join').disabled=false;}finally{busy=false;controls();}};
$('fighter').onchange=()=>run('choose',{fighter:$('fighter').value}).catch(()=>{});
$('ready').onclick=()=>{if(state)run('ready',{ready:!state[session.role].ready,revision:state.revision,engine:game()?.fingerprint()}).catch(()=>{});};
$('reset').onclick=()=>run('reset').catch(()=>{});
$('leave').onclick=()=>run('close').then(()=>{ended=true;try{sessionStorage.removeItem(key(session.room));}catch{}location.href='/groove-squad-challenge.html';}).catch(()=>{});
$('copy').onclick=async()=>{try{await navigator.clipboard.writeText($('share-link').value);status('Invitation copied. Send it to one friend.');}catch{$('share-link').select();status('Select and copy the invitation above.');}};
$('share').onclick=async()=>{const url=$('share-link').value;if(navigator.share){try{await navigator.share({title:'Groove Squad Get Down',text:'Join my Groove Squad Get Down online battle!',url});}catch(e){if(e.name!=='AbortError')$('copy').click();}}else $('copy').click();};
function away(){const generation=++awayGeneration;localAway=true;if(driver)stopMatch();if(!session||ended||!csrf)return;lastReply=-Infinity;$('countdown').textContent='';run('away').then(()=>{if(generation===awayGeneration)localAway=false;}).catch(()=>{});}
// On resume, explicitly clear readiness before polling. Merely returning must not silently re-ready a player.
document.addEventListener('visibilitychange',()=>{if(document.hidden)away();else if(session&&!ended)away();});
window.addEventListener('pagehide',()=>{if(session&&csrf&&!ended)fetch('/api/challenge.php',{method:'POST',credentials:'same-origin',keepalive:true,headers:{'Content-Type':'application/json','X-CSRF-Token':csrf},body:JSON.stringify({protocol,...session,action:'away'})}).catch(()=>{});});
setInterval(()=>{tick();if(session&&!ended&&!busy&&!document.hidden&&!exchangeBusy){if(localAway)away();else run('poll').catch(()=>{});}},1000);
setInterval(tick,100);
(async()=>{try{const r=await fetch('/api/me.php',{credentials:'same-origin',cache:'no-store'});const me=await r.json();if(!r.ok||!me.csrf)throw new Error(me.error||'Could not open a session. Reload to try again.');csrf=me.csrf;
 if(room){try{const saved=JSON.parse(sessionStorage.getItem(key(room)));if(saved?.room===room&&saved.token&&['host','guest'].includes(saved.role))session=saved;}catch{}
 if(session){localAway=true;await run('away');localAway=false;return;}
 if(invite&&/^[a-f0-9]{24}$/.test(room)&&/^[a-f0-9]{48}$/.test(invite)){$('invitation').hidden=false;status('Your friend invited you to an online match.');return;}
 status('Reopen the full invitation, or create a new challenge.');}
 else status(me.subscribed?'Create a lobby and invite a friend.':'Log in with a subscription to host. Friends can join your invitation for free.');
 $('entry').hidden=false;$('create').disabled=!me.subscribed;$('account-links').hidden=!!me.subscribed;
 }catch(e){status(e.message);}})();
})();
