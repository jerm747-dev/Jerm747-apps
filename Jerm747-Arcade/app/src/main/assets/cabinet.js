'use strict';
const byId = id => document.getElementById(id);
const games = [
 ['Encore','Nige Hood · Returnity','Run the neighborhood, climb to the rooftop party, or take the After Party route.','encore/index.html?app=android','covers/encore.webp'],
 ['CD Man','Returnity · Platformer','Chase the flag from the highway into the subway.','encore/cd-man/index.html?app=android','covers/cd-man.webp'],
 ['Catalog Clash','Groove Squad · Story','An award nomination, a climb with Kiana, and a showdown over OG Jerm’s catalog.','journey/index.html','covers/catalog-clash.webp'],
 ['GS Fighter III','GSX Core · 3D fighter','Take your fighter from character select into the arena.','gs3/game/index.html','covers/gs3.webp'],
 ['Groove Squad Get Down','Groove Squad · 2D fighter','Choose your fighter and take on the squad in the original arcade matchup.','groove-squad-get-down.html','covers/getdown.webp'],
 ['Flight Control Deck','Flight · Arcade','Fly the course, race, or launch Asteroid Blast.','projects/flight-control-deck/index.html','covers/flight.webp'],
 ['Cyborg Coliseum','GS Fighter III · Flight Systems','Lift off on blue thrusters, fire the chest cannon, or land for close combat in the arena.','projects/cyborg-coliseum/index.html','covers/cyborg.webp'],
 ['Word Search','Puzzle','Choose a topic and find the hidden words.','projects/word-search/index.html','covers/word-search.webp'],
 ['Plugin Twist','Puzzle','Swap music tokens or twist a corner of the rack to free up slots.','projects/plugin-twist/index.html','covers/plugin-twist.webp'],
 ['Album Match','Puzzle','Line up matching album tiles and chase a cascade.','projects/album-match/index.html','covers/album-match.webp'],
 ['Controller Check','Controller utility','Check connected buttons, sticks, triggers, and rumble.','projects/controller-check/index.html','covers/controller.webp'],
 ['Beat Room','Music · Virtual boombox','Play the three-oscillator synth, shape a sample and record mapped pads into a 16–64-step pattern.','projects/beat-room/index.html','projects/beat-room/cover.jpg'],
 ["Big Bowl Smash", "Get your crew through all four quarters.", "Hurdle passing fans, dive through openings, and ride empty carts as you guide your crew from the field to the parking lot. Time each crossing before the clock runs out.", "projects/big-bowl-smash/index.html", "projects/big-bowl-smash/case.webp"],
 ["Tic-Tac-Steel", "Etch your next move into steel.", "Take on the CPU or a second player. Play three in a row on the Classic board, line up four on the 5×5 plate, or claim three little boards to win Ultimate.", "projects/tic-tac-steel/index.html", "projects/tic-tac-steel/case.webp"],
 ["Sumi Sudoku", "Ink-brush Sudoku with a watercolor park to rest in.", "Classic Sudoku with Japanese ink-brush styling. Take a break in a living watercolor park inspired by Maruyama Park in Kyoto: 12 painted plants, seasons that turn every 5 minutes, day and night every 12, and tap-to-glow plants with fireflies and info cards.", "projects/sumi-sudoku/index.html", "projects/sumi-sudoku/case.webp"],
 ["GS Fighter II", "Groove Squad · Fighter", "Fourteen fighters, cinematic intros, and the Parallax Run.", "projects/gs-fighter-2/index.html", "projects/gs-fighter-2/cover.jpg"],
 ['Wave Run 747','Racing · Jet ski','Race the jet ski through buoy gates, chase a ghost, or try an endless course.','projects/wave-run-747/index.html','projects/wave-run-747/case.webp'],
 ['Pulse Runner','Arcade · Run and gun','Pick an operator and push through the jungle to the Dustline Outpost.','projects/pulse-runner/index.html','projects/pulse-runner/case.webp']
];
const shelfArt = [
 'encore/assets/encore-sleeve.webp','encore/assets/cd-arcade.webp','images/groove-squad/level10/coat-gift.webp','gs3/game/menu-logo.png',
 'covers/getdown.webp','projects/flight-control-deck/cover.jpg','projects/cyborg-coliseum/cover.webp','projects/word-search/cover.png','projects/plugin-twist/cover.png','projects/album-match/cover.png','covers/controller.webp','projects/beat-room/cover.jpg',
 "projects/big-bowl-smash/cover.webp",
 "projects/tic-tac-steel/cover.webp",
 "projects/sumi-sudoku/cover.webp",
 "projects/gs-fighter-2/cover.jpg",
 "projects/wave-run-747/cover.webp",
 "projects/pulse-runner/cover.webp"
];
// Display order is independent of game IDs used by saves, routes and controls.
const gameOrder=games.map((game,id)=>id).sort((a,b)=>
 Number(games[a][3]==='projects/controller-check/index.html')-Number(games[b][3]==='projects/controller-check/index.html'));
const session = byId('session'), cabinet = byId('cabinet'), list = byId('case-list'), shelf = byId('shelf');
let current = Math.max(0,Math.min(games.length-1,Number(localStorage.getItem('arcade.selection'))||0));
let view = localStorage.getItem('arcade.view') || (Math.min(innerHeight,innerWidth)<650?'list':'shelf');
const backgroundReasons=new Set();
let frame, frameHook, listScroll = Number(sessionStorage.getItem('arcade.scroll')) || 0, nativePads = [], lastFlags = {}, activeKeys = new Set();
const browserPads = navigator.getGamepads?.bind(navigator);
function pads(){return nativePads.length?nativePads:(browserPads?.() || []);}
function gamePads(){
 const connected=pads();
 if(!releasePadGate&&!heldByVisor)return connected;
 return Array.from(connected,p=>p?{id:p.id,index:p.index,mapping:p.mapping,connected:p.connected,timestamp:p.timestamp,
  axes:Array.from(p.axes,()=>0),buttons:Array.from(p.buttons,()=>({pressed:false,touched:false,value:0})),
  vibrationActuator:p.vibrationActuator}:null);
}
function rumble(duration=16,amplitude=65){window.EncoreAndroid?.rumble(duration,amplitude);}
window.EncoreAndroidPads = {update(values){
 nativePads = values.map(pad => ({...pad,vibrationActuator:{type:'dual-rumble',playEffect:(_,v)=>{rumble(v.duration||35,Math.round(100*Math.max(v.strongMagnitude||0,v.weakMagnitude||0)));return Promise.resolve('complete');},reset:()=>{rumble(0,0);return Promise.resolve('complete');}}}));
}};
window.EncoreAndroid?.requestPads();
function stepSelection(delta,focus=false){
 const index=(gameOrder.indexOf(current)+delta+gameOrder.length)%gameOrder.length;
 select(gameOrder[index],true,focus);
}
function select(index,move=false,focus=false){
 current=(index+games.length)%games.length;
 localStorage.setItem('arcade.selection',current);
 const slot=gameOrder.indexOf(current);
 const [name,genre,summary,,cover]=games[current];
 if(view==='shelf')byId('hero').src=shelfArt[current]||cover;byId('open-cover').setAttribute('aria-label','Enlarge '+name+' cover');byId('title').textContent=name;byId('genre').textContent=genre;byId('description').textContent=summary;byId('count').textContent=(slot+1)+' / '+games.length;
 [...shelf.children].forEach((el,i)=>el.setAttribute('aria-pressed',String(i===slot)));
 [...list.children].forEach((el,i)=>el.classList.toggle('active',i===slot));
 const el=(view==='list'?list:shelf).children[gameOrder.indexOf(current)];
 if(move)el.scrollIntoView({block:'nearest',inline:'nearest',behavior:'instant'});
 if(focus)el.focus({preventScroll:true});
}
function setView(next,scroll=true){
 view=next;localStorage.setItem('arcade.view',view);cabinet.classList.toggle('list-view',view==='list');const slider=byId('view-slider');
 slider.value=view==='list'?'0':'1';
 slider.setAttribute('aria-valuetext',view==='list'?'List':'Grid');
 slider.parentElement.dataset.view=view==='list'?'list':'grid';
 select(current,scroll);
}
const newGamePaths = new Set(['wave-run-747','pulse-runner'].map(slug => 'projects/'+slug+'/index.html'));
gameOrder.forEach(i=>{
 const [name,,,,art]=games[i];
 const cart=document.createElement('button');cart.className='cart';const tile=new Image();tile.src=art;tile.alt='';const title=document.createElement('b');title.textContent=name;
 if (newGamePaths.has(games[i][3])) {
   const badge=document.createElement('span');
   badge.className='game-new';badge.textContent='NEW';title.append(badge);
 }
 cart.append(tile,title);cart.onclick=()=>{if(i===current)launch();else select(i,true)};shelf.append(cart);
 const row=document.createElement('button');row.className='case';const bg=new Image();bg.src=art;bg.alt='';bg.className='case-bg';const thumb=bg.cloneNode();thumb.className='case-cover';const arrow=document.createElement('i');arrow.textContent='›';arrow.setAttribute('aria-hidden','true');row.append(bg,thumb,title.cloneNode(true),arrow);row.onclick=()=>{select(i);launch()};list.append(row);
});
byId('view-slider').oninput=e=>setView(e.target.value==='0'?'list':'shelf');
byId('prev').onclick=()=>stepSelection(-1);byId('next').onclick=()=>stepSelection(1);byId('play').onclick=()=>launch();byId('cab-start').onclick=()=>returnToCabinet();
list.addEventListener('scroll',()=>{if(!frame && view==='list' && !cabinet.hidden){listScroll=list.scrollTop;sessionStorage.setItem('arcade.scroll',listScroll)}},{passive:true});
setView(view,false);if(view==='list')requestAnimationFrame(()=>list.scrollTop=listScroll);else select(current,true);
function launch(){
 if(frame||titleShowing||visor.isOpen||viewer.open)return;
 listScroll=list.scrollTop;rumble();
 const saved=ArcadeSessions.take(current);
 if(saved){
  frame=saved.frame;frameHook=frame.contentWindow;diskGameId=saved.data;
  session.classList.toggle('standard',!!routes[current]);setPlaySurface();
  visor.enable(true);visor.setContext('game',diskGameId);
  setPocketGame();ArcadeSessions.release(frame);frameHook.focus();return;
 }
 if(routes[current]){openTitle();return;}
 diskGameId='gs-fighter-iii';visor.enable(true);visor.setContext('game',diskGameId);session.classList.remove('standard');loadGame(games[current][3]);
}
function loadGame(path){
 setPlaySurface();
 frame=document.createElement('iframe');frame.title=games[current][0];
 frame.allow='gamepad; autoplay; fullscreen'+(routes[current]?.id==='beat-room'?'; microphone':'');frame.src=path;
 const owned=frame;
 frame.addEventListener('load',()=>{if(frame===owned)bindGame();else if(owned.hidden)ArcadeSessions.hold(owned);});session.append(frame);
}
function bindGame(){
 if(!frame)return;
 const w=frame.contentWindow;frameHook=w;activeKeys.clear();
 // Expose standard Android inputs to games that normally use the browser Gamepad API.
 if(window.EncoreAndroid){Object.defineProperty(w.navigator,'getGamepads',{configurable:true,value:gamePads});if(!w.navigator.vibrate)Object.defineProperty(w.navigator,'vibrate',{value:n=>{rumble(Array.isArray(n)?n[0]:n);return true;}});}
 // The game owns its existing keyboard shortcuts. Catch Escape before document handlers.
 w.addEventListener('keydown',e=>{if(e.key==='Escape'&&!e.defaultPrevented){e.preventDefault();e.stopImmediatePropagation();backOne();}},true);
 // Game pages can opt out of browser fullscreen: the APK surface is already immersive.
 w.Element.prototype.requestFullscreen=function(){return Promise.resolve()};
 bindVisorGame(w);setPocketGame();if(!visor.isOpen)w.focus();
}
function returnToCabinet(){
 if(!frame&&!titleShowing)return;
 pocketView?.setGame(null,'');
 titleShowing=false;pendingChoice=null;heldByVisor=false;titleScreen.hidden=true;
 visor.setContext('cabinet','cabinet');visor.enable(true);
 const saved=listScroll;if(frame&&!ArcadeSessions.park(current,frame,diskGameId))frame.remove();frame=frameHook=null;activeKeys.clear();session.hidden=true;cabinet.hidden=false;window.EncoreAndroid?.gameOrientation?.(false);requestAnimationFrame(()=>{if(view==='list')list.scrollTop=saved;const el=(view==='list'?list:shelf).children[gameOrder.indexOf(current)];el.focus({preventScroll:true});});rumble(12);
}
function isParkedWindow(w){
 try {while(w&&w!==window){if(w.frameElement?.hidden)return true;w=w.parent;}}catch{}
 return false;
}
window.Arcade={beatRoomOpen:()=>!!frame&&routes[current]?.id==='beat-room'&&!visor.isOpen,returnToCabinet,back:backOne,holding:w=>backgroundReasons.size>0||heldByVisor||!!pocketView?.guideOpen||isParkedWindow(w),
 gameTitle(source){if(frame?.contentWindow!==source||!routes[current])return false;openTitle();return true;},
 background(reason,held){
  if(held)backgroundReasons.add(reason);else backgroundReasons.delete(reason);
  if(!frame)return;
  pocketView?.setHeld(!!backgroundReasons.size || heldByVisor);
  if(backgroundReasons.size){activeKeys.clear();ArcadeSessions.hold(frame);}
  else if(!visor.isOpen)ArcadeSessions.release(frame);
 },
 pause(){if(!frame||visor.isOpen)return;visor.open();},pads};
window.addEventListener('message',e=>{if(!frame||e.origin!==location.origin||e.source!==frame.contentWindow)return;if(['arcade-return','jerm747-catalog-close','jerm747-arcade-close','jerm747-close-game','jerm747-game-close'].includes(e.data?.type))returnToCabinet();if(e.data?.type==='jerm747-catalog-arcade'){returnToCabinet();select(4,true);launch();}});
window.addEventListener('keydown',e=>{if(visor.isOpen||byId('cover-view').open||e.target.id==='view-slider')return;if(frame){if(e.key==='Escape'){e.preventDefault();backOne()}return}if(['ArrowLeft','ArrowRight','ArrowDown','ArrowUp'].includes(e.key)){e.preventDefault();stepSelection(['ArrowLeft','ArrowUp'].includes(e.key)?-1:1,true)}else if(e.key==='Enter'&&!e.repeat && !e.target.closest?.('button'))launch();});
function key(w,code,down){
 const key=code==='Space'?' ':code.startsWith('Key')?code.slice(3).toLowerCase():code;
 (w.document.activeElement||w.document.body).dispatchEvent(new w.KeyboardEvent(down?'keydown':'keyup',{code,key,bubbles:true,cancelable:true}));
}
const maps={8:{0:'KeyA',1:'KeyS',2:'KeyX',3:'KeyH',4:'KeyZ',12:'ArrowUp',13:'ArrowDown',14:'ArrowLeft',15:'ArrowRight'}};
function poll(){
 const all=Array.from(pads()||[]).filter(Boolean),p=all[0],pressed=i=>!!p?.buttons[i]?.pressed;
 const flags={prev:pressed(12)||pressed(14)||p?.axes[1]<-.55||p?.axes[0]<-.55,next:pressed(13)||pressed(15)||p?.axes[1]>.55||p?.axes[0]>.55,a:pressed(0),b:pressed(1),select:pressed(8),start:all.some(p=>p.buttons[9]?.pressed)};
 if(releasePadGate){if(!Object.values(flags).some(Boolean))releasePadGate=false;}
 else if(visor.isOpen){
  if(flags.start&&!lastFlags.start){if(titleShowing){visor.input('accept')}else visor.back();}
  else if(flags.b&&!lastFlags.b)visor.input('cancel');
  else if(flags.a&&!lastFlags.a)visor.input('accept');
  else if(flags.prev&&!lastFlags.prev)visor.input('prev');
  else if(flags.next&&!lastFlags.next)visor.input('next');
 }
 else if(byId('cover-view').open&&(flags.b&&!lastFlags.b||flags.start&&!lastFlags.start))byId('cover-view').close();
 else if(!frame&&!titleShowing&&flags.select&&!lastFlags.select)visor.open();
 else if(flags.start&&!lastFlags.start&&!frame)startKey();
 else if(frame&&pocketView?.systemOpen){}
 else if(!frame&&!byId('cover-view').open){if(flags.prev&&!lastFlags.prev)stepSelection(-1,true);if(flags.next&&!lastFlags.next)stepSelection(1,true);if(flags.a&&!lastFlags.a)launch();}
 else if(frameHook && maps[current]){
  const held=new Set(Object.entries(maps[current]).filter(([button])=>pressed(+button)).map(([,code])=>code));for(const code of held)if(!activeKeys.has(code))key(frameHook,code,true);for(const code of activeKeys)if(!held.has(code))key(frameHook,code,false);activeKeys=held;
 }
 lastFlags=flags;requestAnimationFrame(poll);
}
window.addEventListener('DOMContentLoaded',()=>requestAnimationFrame(poll),{once:true});
window.Arcade.onStart=()=>startKey();

window.Arcade.inGame=()=>Boolean(frame)||titleShowing;

const viewer = byId('cover-view');
byId('open-cover').onclick = () => {
 if(viewer.open)return;
 const img=byId('full-cover'); img.alt=games[current][0]+' cover'; img.src=shelfArt[current];
 viewer.showModal();
};
byId('close-cover').onclick=()=>viewer.close();
byId('game-back').onclick=backOne;
byId('game-hud').onclick=()=>visor.open();
document.querySelector('.game-nav').addEventListener('pointerdown',e=>e.preventDefault());
function backOne(){
 if(pocketView?.closeGuide())return;
 if(visor.back())return;
 if(titleShowing){returnToCabinet();return;}
 if(viewer.open){viewer.close();return;}
 if(!frame){window.EncoreAndroid?.exit();return;}
 if(current!==3&&!detailOpen(frame.contentWindow)){visor.open();return;}
 if(window.backInsideArcadeGame(frame.contentWindow,current)){frame?.contentWindow.focus();return;}
 returnToCabinet();
}
// Keep a vertical pan native. A deliberate sideways swipe changes view only after release.
let gesture=null,ignoreClickUntil=0;
const monitor=document.querySelector('.monitor');
monitor.addEventListener('pointerdown',e=>{
 ignoreClickUntil=0;
 if(!e.isPrimary||e.pointerType==='mouse'||!e.target.closest('#case-list,#spotlight'))return;
 gesture={id:e.pointerId,x:e.clientX,y:e.clientY,view,row:e.target.closest('.case'),cover:e.target.closest('#open-cover')};
});
monitor.addEventListener('pointercancel',()=>gesture=null);
monitor.addEventListener('pointerup',e=>{
 if(!gesture||gesture.id!==e.pointerId)return;
 const g=gesture;gesture=null;const dx=e.clientX-g.x,dy=e.clientY-g.y;
 if(g.cover&&Math.hypot(dx,dy)<9){g.cover.click();return;}
 if(Math.abs(dx)<55||Math.abs(dx)<Math.abs(dy)*1.7)return;
 ignoreClickUntil=performance.now()+480;
 if(g.view==='list'&&g.row)select(gameOrder[[...list.children].indexOf(g.row)]);
 setView(g.view==='list'?'shelf':'list'); 
});
monitor.addEventListener('click',e=>{
 if(performance.now()<ignoreClickUntil){e.preventDefault();e.stopImmediatePropagation();}
},true);
