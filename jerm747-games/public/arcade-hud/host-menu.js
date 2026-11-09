'use strict';
function renderHostMenu() {
  const choices=byId('host-actions'), more=byId('more-actions');
  const title=panel==='main'&&context==='title'&&!!menuSpec.name;
  const options=panel==='choices';
  const items=title?menuSpec.start:options?menuSpec.options:[];
  choices.hidden=!items?.length;
  choices.replaceChildren();
  for(const item of items||[]) {
    const button=byId('primary-action').cloneNode(true);
    button.removeAttribute('id');button.hidden=false;
    button.querySelector('.glass-button__label span').textContent=item.label;
    button.addEventListener('click',()=>closeMenu(context,'command',item.id));
    choices.append(button);
  }
  more.hidden=panel!=='main'||context!=='game'||!menuSpec.options?.length;
  if(title)byId('game-actions').hidden=true;
  if(menuSpec.name&&context!=='cabinet') {
    if(title)byId('hud-heading').textContent=menuSpec.name;
    if(options)byId('hud-heading').textContent='Game options';
    if(panel==='main'&&!title)byId('hud-heading').textContent=menuSpec.canHold===false?'Game menu':'Game paused';
    document.querySelector('.hud-brand').textContent=title?'Jerm747 Arcade':menuSpec.name;
  }else document.querySelector('.hud-brand').textContent='Jerm747 Arcade';
  if(embeddedVisor)byId('hud-fullscreen').hidden=!window.EncoreAndroid&&!document.fullscreenEnabled||byId('hud-fullscreen').hidden;
}
byId('more-actions').addEventListener('click',()=>{showPanel('choices');byId('host-actions').firstElementChild?.focus();});
function navigateHUD(key) {
  if(key==='back'){if(!overlayBack())closeMenu();return;}
  // The tester displays face buttons directly. Start and Android Back leave it.
  if(panel==='controller')return;
  if(key==='cancel'){if(!overlayBack())closeMenu();return;}
  const list=[...byId('visor-controls').querySelectorAll('button:not(:disabled),select:not(:disabled)')]
    .filter(el=>el.getClientRects().length);
  if(!list.length)return;
  const i=list.indexOf(document.activeElement);
  if(key==='accept'){(list[i]||list[0]).click();return;}
  const step=key==='prev'?-1:1;
  list[i<0?0:(i+step+list.length)%list.length].focus();
}
document.addEventListener('keydown',e=>{
  if(!embeddedVisor||!menuOpen||!e.key.startsWith('Arrow')||e.target.closest('#position-map,select')||e.target===stage)return;
  e.preventDefault();navigateHUD(['ArrowUp','ArrowLeft'].includes(e.key)?'prev':'next');
});
