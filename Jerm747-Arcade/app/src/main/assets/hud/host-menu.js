'use strict';
const finishButton = byId('pocket-finish');
function renderFinish() {
  const pocket = embeddedVisor && parent.Jerm747Pocket;
  finishButton.hidden = !pocket || !pocket.finishes;
  if (!finishButton.hidden) finishButton.querySelector('.pref-value').textContent = pocket.finishes[pocket.getFinish()];
}
finishButton.addEventListener('click', () => {
  const pocket = parent.Jerm747Pocket;
  const choices = Object.keys(pocket.finishes);
  pocket.setFinish(choices[(choices.indexOf(pocket.getFinish()) + 1) % choices.length]);
  renderFinish();
});
const musicRow = document.createElement('button');
musicRow.type = 'button';
musicRow.id = 'hud-game-music';
musicRow.className = 'overlay-row';
musicRow.hidden = true;
musicRow.innerHTML='<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 17V6l11-2v11M9 9l11-2"/><ellipse cx="6" cy="18" rx="3" ry="2.4"/><ellipse cx="17" cy="16" rx="3" ry="2.4"/></svg><span>Game Music</span>';
musicRow.style.textAlign='left';
musicRow.setAttribute('aria-label','Game Music');
byId('game-actions').after(musicRow);
const viewPrefs=()=>embeddedVisor&&parent.Jerm747PlayView;
function controlRow(id,label,click){
 const el=document.createElement('button');el.type='button';el.className='overlay-row';el.id=id;el.hidden=true;
 const title=document.createElement('span'),value=document.createElement('span');title.textContent=label;value.className='pref-value';el.append(title,value);el.onclick=click;musicRow.after(el);return el;
}
const controlsMenu=controlRow('play-controls','Controls',()=>showPanel('play-controls','play-show'));
controlsMenu.lastElementChild.textContent='›';
const showControls=controlRow('play-show','Show on-screen controls',()=>{viewPrefs().set('shown',!viewPrefs().shown);renderPlayControls()});
const follow=controlRow('play-follow','Follow player input',()=>{viewPrefs().set('follow',!viewPrefs().follow);renderPlayControls()});
const boardView=controlRow('play-board','Full-screen game board',()=>{viewPrefs().cycle();closeMenu(context)});
function renderPlayControls(){
 const prefs=viewPrefs();controlsMenu.hidden=!prefs||panel!=='main';
 boardView.hidden=!prefs||panel!=='main'||context!=='game'||!prefs.eligible();
 if(prefs)boardView.firstElementChild.textContent=prefs.board?'Return to regular view':'Full-screen game board';
 for(const [row,value] of [[showControls,prefs?.shown],[follow,prefs?.follow]]){
   row.hidden=panel!=='play-controls';row.setAttribute('role','switch');row.setAttribute('aria-checked',String(!!value));row.lastElementChild.textContent=value?'On':'Off';
 }
 if(panel==='play-controls')byId('hud-heading').textContent='Controls';
}
const openGamesRow=byId('open-games');const chevron=document.createElement('span');chevron.textContent='›';chevron.setAttribute('aria-hidden','true');chevron.style.cssText='margin-inline-start:auto;padding-inline:6px;font-size:1.35em';openGamesRow.append(chevron);

musicRow.addEventListener('click', () => {
  closeMenu(context, 'command', menuSpec.gameMusic ? 'game-music' : 'launch:sound-test');
});

function renderHostMenu() {
  renderPlayControls();
  musicRow.hidden = panel !== 'main' || !(menuSpec.gameMusic || menuSpec.catalog?.some(item => item.id === 'sound-test'));
  renderFinish();renderPocketControls();
  const pocket = byId('pocket-view');
  const canSwitch = panel==='main' && context==='game' && typeof menuSpec.pocket==='boolean';
  pocket.hidden = !canSwitch;
  pocket.setAttribute('aria-checked',String(menuSpec.pocket===true));
  pocket.querySelector('.pref-value').textContent=menuSpec.pocket?'On':'Off';
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
byId('pocket-view').addEventListener('click',()=>closeMenu('game','command','pocket-view'));
byId('more-actions').addEventListener('click',()=>{showPanel('choices');byId('host-actions').firstElementChild?.focus();});
function navigateHUD(key) {
  if(lab.open){if(key==='back')requestLabBack();return;}
  if(key==='back'){if(!overlayBack())closeMenu();return;}
  // The tester displays face buttons directly. Start and Android Back leave it.
  if(panel==='controller')return;
  if(key==='cancel'){if(!overlayBack())closeMenu();return;}
  const list=[...byId('visor-controls').querySelectorAll('button:not(:disabled),select:not(:disabled)')]
    .filter(el=>el.getClientRects().length);
  if(!list.length)return;
  const i=list.indexOf(document.activeElement);
  if(key==='accept'&&context==='title'&&i<0){const start=byId('host-actions').querySelector('button');if(start){start.click();return}}
  if(key==='accept'){(list[i]||list[0]).click();return;}
  const step=key==='prev'?-1:1;
  list[i<0?0:(i+step+list.length)%list.length].focus();
}
document.addEventListener('keydown',e=>{
  if(!embeddedVisor||!menuOpen||!e.key.startsWith('Arrow')||e.target.closest('#position-map,select')||e.target===stage)return;
  e.preventDefault();navigateHUD(['ArrowUp','ArrowLeft'].includes(e.key)?'prev':'next');
});
const lab=byId('pocket-lab'), labFrame=lab.querySelector('iframe'), directionChoice=byId('direction-choice'), labButton=byId('open-workshop');
function renderPocketControls(){
  const prefs=embeddedVisor&&parent.Jerm747Pocket?.getControls?.();
  labButton.hidden=false;directionChoice.hidden=!prefs;
  byId('quick-lab').hidden=panel!=='main'||context!=='game';
  if(prefs)directionChoice.querySelector('.pref-value').textContent=prefs.mode==='pad'?'D-pad':'Joystick';
}
directionChoice.addEventListener('click',()=>{
  const pocket=parent.Jerm747Pocket,prefs=pocket.getControls();
  pocket.saveControls({...prefs,mode:prefs.mode==='pad'?'stick':'pad'});renderPocketControls();
});
labButton.addEventListener('click',()=>{
  lab.showModal();labFrame.src=new URL('../workshops/pocket/index.html?hud=1',location.href).href;
  labFrame.focus();
});
function requestLabBack(){if(lab.open)labFrame.contentWindow?.postMessage({type:'pocket-workshop-back-request'},location.origin);}
function closeLab(){if(lab.open)lab.close();labFrame.removeAttribute('src');renderPocketControls();labButton.focus({preventScroll:true});}
lab.addEventListener('cancel',e=>{e.preventDefault();requestLabBack();});
window.addEventListener('message',e=>{
  if(!lab.open||e.source!==labFrame.contentWindow||e.origin!==location.origin)return;
  if(e.data?.type==='pocket-workshop-back')closeLab();
  if(e.data?.type==='pocket-workshop-applied'){parent.Jerm747Pocket?.refreshControls();renderPocketControls();}
});

byId('quick-lab').onclick=()=>labButton.click();
