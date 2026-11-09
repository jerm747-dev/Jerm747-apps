'use strict';
// A title action starts a real route or opens the game's own editor. Commands
// are kept in the cabinet so the reusable glass view never owns game state.
const routes = [
 {id:'encore', start:[['street','On the Block'],['trial','Time Trial'],['night','After Party'],['cd','CD Man']]},
 {id:'cd-man', start:[['highway','Highway'],['subway','Subway']]},
 {id:'catalog-clash', start:[['japan','Next stop: Japan'],['kiana','Follow Kiana'],['showdown','The showdown']]},
 null,
 {id:'get-down',start:[['play','Choose fighters']]},
 {id:'flight',start:[['blast','Asteroid Blast'],['free','Free flight'],['race','Nebula Racing'],['track','Arcade track race']]},
 {id:'cyborg-coliseum',start:[['play','Enter coliseum'],['manual','Move list']]},
 {id:'word-search',start:[['play','Play current puzzle'],['setup','Choose a puzzle']]},
 {id:'plugin-twist',start:[['play','Play puzzle'],['help','How to play']]},
 {id:'album-match',start:[['play','Play Album Match'],['keys','Configure keys']]},
 {id:'controller-check',start:[['play','Open controller test']]},
 {id:'beat-room',start:[['play','Enter Beat Room']]},
 {"id": "big-bowl-smash", "start": [["play", "Play Big Bowl Smash"]]},
 {"id": "tic-tac-steel", "start": [["play", "Play Tic-Tac-Steel"]]},
 {"id": "sumi-sudoku", "start": [["play", "Play Sumi Sudoku"]]},
 {id:"gs-fighter-2",start:[["play","Play GS Fighter II"]]}
];
let titleShowing=false, heldByVisor=false, releasePadGate=false;
const entryArt=byId('entry-art'), titleScreen=byId('game-entry');
const cabButton=byId('cabinet-hud');
let diskGameId='', pendingChoice=null;
const portableFullscreen=()=>window.EncoreAndroid?localStorage.getItem('arcade.immersive')!=='off':!!document.fullscreenElement;
function toggleArcadeFullscreen(){
 if(!window.EncoreAndroid)return document.fullscreenElement?document.exitFullscreen():document.documentElement.requestFullscreen();
 const active=!portableFullscreen();localStorage.setItem('arcade.immersive',active?'on':'off');
 window.EncoreAndroid.setImmersive(active);
}
if(window.EncoreAndroid?.setImmersive)window.EncoreAndroid.setImmersive(portableFullscreen());
function optionList(){
 const w=frame?.contentWindow,d=w?.document;
 if(!d)return [];
 const path=w.location.pathname;
 let list=[];
 if(path.includes('/encore/cd-man'))list=[['#instructions','How to play'],['#audio','Toggle sound'],['#cd-touch','Cycle touch controls']];
 else if(current===0)list=[['#instructions','How to play'],['#audio','Toggle sound'],['#front-music','Toggle music'],['#touch-toggle','Cycle touch controls']];
 else if(current===4)list=[['@mapping','Controller mapping']];
 else if(current===5)list=[['#settings','Flight controls'],['#camera-toggle','Switch camera'],['#inputmode','Switch input mode'],['#layout','Change layout'],['#warp','Activate warp']];
 else if(current===6)list=[['#navMoves','Move list'],['#audio','Toggle sound']];
 else if(current===7)list=[['#new','Choose a puzzle'],['#help-button','How to play'],['#reset','Restart puzzle']];
 else if(current===8)list=[['#help','How to play'],['#new','Restart puzzle']];
 else if(current===9)list=[['.am-how + .match-actions button:last-child','Configure keys'],['.am-how + .match-actions button:first-child','New game']];
 else if(current===10)list=[['#rumble','Test rumble']];
 return list.filter(([selector])=>selector==='@mapping'?!!w.Jerm747Controls?.openHelp:
  !!d.querySelector(selector)&&!d.querySelector(selector).disabled);
}
function getVisorMenu(){
 const menu=getGameMenu();
 menu.catalog=gameOrder.map(i=>({id:String(i),title:games[i][0]}));
 menu.active=frame?String(current):null;return menu;
}
function getGameMenu(){
 const format=items=>items.map(([id,label])=>({id,label}));
 return frame?{name:diskGameId==='cd-man'?'CD Man':games[current][0],options:format(optionList())}
  :titleShowing?{name:games[current][0],start:format(routes[current].start)}:{};
}
function sceneSource(){
 if(frame){
  const d=frame.contentDocument;
  const canvas=[...d.querySelectorAll('canvas')].filter(c=>c.width&&c.height&&c.getClientRects().length)
    .sort((a,b)=>b.clientWidth*b.clientHeight-a.clientWidth*a.clientHeight)[0];
  if(canvas)return canvas;
 }
 if(titleShowing&&entryArt.complete&&entryArt.naturalWidth)return entryArt;
 return cabinet.querySelector('.case.active .case-cover')||byId('hero');
}
const visor=Jerm747HUD.mount(document.body,{
 context:'cabinet',cabinetButton:cabButton,getMenu:getVisorMenu,getScene:sceneSource,
 isFullscreen:portableFullscreen,onFullscreen:toggleArcadeFullscreen,
 onOpening(){
  if(!frame)return;
  heldByVisor=true;
  for(const code of activeKeys)key(frame.contentWindow,code,false);
  activeKeys.clear();
  ArcadeSessions.hold(frame);
 },
 onAction(action,{command}){
  heldByVisor=false;releasePadGate=true;
  if(action==='command'&&command?.startsWith('launch:')){
   const target=Number(command.slice(7));
   if(!Number.isInteger(target)||!games[target])return;
   if(frame&&current===target){ArcadeSessions.release(frame);frame.contentWindow.focus();return;}
   if(frame||titleShowing)returnToCabinet();
   select(target);launch();return;
  }
  if(titleShowing){
   if(action==='command'&&routes[current]?.start.some(([id])=>id===command))startRoute(command);
   else returnToCabinet();
   return;
  }
  if(!frame){visor.setContext('cabinet','cabinet');return;}
  if(action==='cabinet'){returnToCabinet();return;}
  if(action==='title'){if(current===3){frame.src=games[3][3];}else openTitle();return;}
  visor.setContext('game',diskGameId);
  ArcadeSessions.release(frame);
  frame.contentWindow.focus();
  if(action==='command'&&optionList().some(([id])=>id===command)){
   if(command==='@mapping')frame.contentWindow.Jerm747Controls.openHelp('pad');
   else frame.contentDocument.querySelector(command)?.click();
  }
 }
});
function setPlaySurface(){
 cabinet.hidden=true;session.hidden=false;
 window.EncoreAndroid?.gameOrientation?.([3,4].includes(current));
}
function openTitle(){
 if(!routes[current])return;
 const old=frame;frame=frameHook=null;old?.remove();
 activeKeys.clear();pendingChoice=null;heldByVisor=false;
 titleShowing=true;
 setPlaySurface();
 session.classList.add('standard');titleScreen.hidden=false;
 diskGameId=routes[current].id;entryArt.src=current>=12 ? shelfArt[current] : games[current][4];
 visor.enable(true);visor.setContext('title',diskGameId);visor.open();
}
function startRoute(id){
 let path=games[current][3], option=id;
 if(current===0){
  if(id==='cd'){path='encore/cd-man/index.html?app=android';diskGameId='cd-man';}
  else path+='&autostart=1&mode='+({trial:'trial',night:'afterparty',street:'street'}[id]);
 }
 if(current===1&&id==='subway')path+='&leg=subway';
 if(current===2&&id==='showdown'){path='catalog-clash-level10.html';localStorage.setItem('arcade-catalog-chapter','10');}
 pendingChoice={option,path:new URL(path,location.href).pathname};
 titleShowing=false;titleScreen.hidden=true;visor.setContext('game',diskGameId);
 loadGame(path);
}
function applyEntryChoice(w){
 const item=pendingChoice;
 if(!item||w.location.pathname!==item.path)return;
 pendingChoice=null;
 const selector=({
  2:{japan:'.chapters button:nth-child(1)',kiana:'.chapters button:nth-child(2)'},
  5:{free:'#mission-free',blast:'#mission-start',track:'#mission-track',race:'#mission-race'},
  6:{play:'#start',manual:'#manual'},7:{setup:'#new'},8:{help:'#help'},9:{keys:'.am-how + .match-actions button:last-child'}
 })[current]?.[item.option];
 if(!selector)return;
 function run(){
  if(frame?.contentWindow!==w||w.document!==doc)return true;
  const button=doc.querySelector(selector);
  if(!button||button.disabled||current===7&&!doc.querySelector('#topic-choice option'))return false;
  button.click();return true;
 }
 const doc=w.document;
 if(run())return;
 const observer=new MutationObserver(()=>{if(run())observer.disconnect();});
 observer.observe(doc.body,{childList:true,subtree:true,attributes:true,attributeFilter:['disabled']});
 w.addEventListener('pagehide',()=>observer.disconnect(),{once:true});
}
function bindVisorGame(w){
 if(current===3){if(heldByVisor)ArcadeSessions.hold(frame);return;}
 diskGameId=w.location.pathname.includes('/cd-man/')?'cd-man':routes[current].id;
 visor.setContext('game',diskGameId);
 if(heldByVisor)w.ArcadeGameClock?.hold();
 w.document.addEventListener('click',e=>{
  if(e.defaultPrevented)return;
  const b=e.target.closest('button');if(!b)return;
  const id=b.id;
  if(current===5&&id==='mission-home'||(current===0||current===1)&&['end-title-button','pause-title-button','end-modes','mode-return','press-start','cd-return'].includes(id)){
   e.preventDefault();e.stopImmediatePropagation();openTitle();return;
  }
  if((current===0||current===1)&&id==='pause'||current===5&&['menu-toggle','controller-pause','modes'].includes(id)){
   e.preventDefault();e.stopImmediatePropagation();visor.open(id==='menu-toggle'?'choices':'main');
  }
 },true);
 applyEntryChoice(w);
}
function detailOpen(w){
 const d=w.document;
 return ['dialog[open]','.tp-sheet:not([hidden])','.match-settings','.journey-pause',
  '#design-card:not([hidden])','#export-modal:not([hidden])'].some(s=>[...d.querySelectorAll(s)].some(e=>e.getClientRects().length))
  ||w.Jerm747Controls?.menuOpen()||current===7&&!!d.querySelector('#exit-focus')?.getClientRects().length;
}
function startKey(){
 if(visor.isOpen){visor.back();return;}
 if(viewer.open){viewer.close();return;}
 if(frame){visor.open();}
 else if(titleShowing)visor.open();else launch();
}
