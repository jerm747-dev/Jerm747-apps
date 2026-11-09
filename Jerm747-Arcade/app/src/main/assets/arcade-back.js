'use strict';
window.backInsideArcadeGame=function(w,index){
 const d=w.document, path=w.location.pathname;
 const navigate=relative=>w.location.replace(new URL(relative,w.location.href).href);
 const visible=selector=>{const e=d.querySelector(selector);return e?.getClientRects().length?e:null};
 const hit=selector=>{const e=visible(selector);if(!e||e.disabled)return false;e.click();return true};
 if(hit('.tp-sheet:not([hidden]) [data-x="done"]'))return true;
 if(w.Jerm747Controls?.menuOpen()){w.Jerm747Controls.back();return true}
 if(index===4){
  const expanded=[...d.querySelectorAll('.player-slots button[aria-expanded="true"]')].reverse().find(e=>e.getClientRects().length);
  if(expanded){expanded.click();return true;}
 }
 if(w.arcadeMenuBack)return w.arcadeMenuBack();
 if(path.includes('/encore/')){
  if(!w.EncoreApp)return false;
  if(path.includes('/cd-man/')){
   if(d.querySelector('#help[open]')||d.querySelector('#game')?.dataset.panel==='pause'){w.EncoreApp.back();return true;}
   if(index===0){
    const returnMenu=new URL(w.location.href).searchParams.get('return')==='modes'?'&menu=modes':'';
    navigate('../index.html?from=cdman&app=android'+returnMenu);return true;
   }
   return false;
  }
  if(!d.querySelector('#help[open],#ending[open]')&&d.querySelector('#game')?.dataset.screen==='title')return false;
  w.EncoreApp.back();return true;
 }
 if(index===3){
  if(path.endsWith('Fighter-Select.html')){
   if(w.GSMatrixWorkshop?.state.open)w.GSMatrixWorkshop.touch.close();
   else navigate('game/index.html?menu=modes');
   return true;
  }
  if(path.includes('/gsx-core/')){navigate(new URL(w.location.href).searchParams.get('return')==='modes'?'../game/index.html?menu=modes':'../game/index.html');return true;}
  if(w.FighterLab?.demoPlaying){w.FighterLab.exitDemo();return true;}
  if(w.FighterLab?.selection?.isOpen){w.FighterLab.selection.close(null);return true;}
  if(w.GSFPlayerMenu?.isOpen){w.GSFPlayerMenu.back();return true;}
  if(w.GSFPostFight?.active){w.GSFPostFight.back();return true;}
  if(w.GSFLoading?.busy)return true;
  if(w.FighterLab&&!w.FighterLab.titleOpen){w.GSFPlayerMenu?.open();return true;}
  return false;
 }
 if(index===6)return hit('dialog[open] #close');
 if(index===7)return hit('#close-help')||hit('#cancel-setup')||hit('#exit-focus');
 if(index===8)return hit('#close')||hit('#cancel');
 if(index===9)return hit('.match-settings > button:last-child');
 return false;
};
