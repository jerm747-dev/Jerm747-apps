'use strict';
const ROW_SHELL='<svg class="glass-button__shell" viewBox="0 0 160 48" preserveAspectRatio="none" aria-hidden="true"><use href="#button-scallop"/></svg>';
const rowIcon=name=>'<svg class="icon" aria-hidden="true"><use href="#i-'+name+'"/></svg>';
const ROW_CHEVRON='<span class="row-chevron" aria-hidden="true">›</span>';
const finishButton = byId('pocket-finish');
// "New" stickers: on the Theme row until a new finish has been tried, and beside a new finish's name.
const NEW_THEMES_KEY = 'jerm747.pocket.newthemes.v1';
const newSticker = () => { const s = document.createElement('b'); s.className = 'new-sticker'; s.textContent = 'New'; return s; };
{
  const css = document.createElement('style');
  css.textContent = '.new-sticker{display:inline-block;margin-left:7px;padding:2px 6px 1px;border-radius:5px;transform:rotate(-4deg);background:linear-gradient(#ffd77d,#e8a463);color:#2a1606;font:800 9px/1.3 system-ui,sans-serif;letter-spacing:.08em;text-transform:uppercase;box-shadow:0 1px 3px #0006;vertical-align:2px}.new-sticker[hidden]{display:none}';
  document.head.append(css);
  finishButton.querySelector('.row-label').append(newSticker());
}
function triedNewTheme() { try { return localStorage.getItem(NEW_THEMES_KEY) === '1'; } catch { return false; } }
function renderFinish() {
  const pocket = embeddedVisor && parent.Jerm747Pocket;
  finishButton.hidden = !pocket || !pocket.finishes || panel!=='pocket';
  if (finishButton.hidden) return;
  const current = pocket.getFinish();
  const isNew = (pocket.newFinishes || []).includes(current);
  if (isNew) { try { localStorage.setItem(NEW_THEMES_KEY, '1'); } catch {} }
  finishButton.querySelector('.row-label .new-sticker').hidden = triedNewTheme();
  const value = finishButton.querySelector('.pref-value');
  value.textContent = pocket.finishLabel ? pocket.finishLabel(current) : pocket.finishes[current];
  if (isNew) value.append(newSticker());
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
musicRow.innerHTML=ROW_SHELL+rowIcon('music')+'<span class="row-label">Game Music</span>'+ROW_CHEVRON;
musicRow.setAttribute('aria-label','Game Music');
byId('game-actions').after(musicRow);
const viewPrefs=()=>embeddedVisor&&parent.Jerm747PlayView;
function controlRow(id,label,click,icon,tail='<span class="pref-value"></span>'){
 const el=document.createElement('button');el.type='button';el.className='overlay-row';el.id=id;el.hidden=true;
 el.innerHTML=ROW_SHELL+rowIcon(icon)+'<span class="row-label"></span>'+tail;
 el.querySelector('.row-label').textContent=label;el.onclick=click;musicRow.after(el);return el;
}
const controlsMenu=controlRow('play-controls','Controls',()=>showPanel('play-controls','play-show'),'sliders',ROW_CHEVRON);
const showControls=controlRow('play-show','Show on-screen controls',()=>{viewPrefs().set('shown',!viewPrefs().shown);renderPlayControls()},'eye');
const follow=controlRow('play-follow','Follow player input',()=>{viewPrefs().set('follow',!viewPrefs().follow);renderPlayControls()},'follow');
const boardView=controlRow('play-board','Full-screen game board',()=>{viewPrefs().cycle();closeMenu(context)},'board','');
function renderPlayControls(){
 const prefs=viewPrefs();controlsMenu.hidden=!prefs||panel!=='main';
 boardView.hidden=!prefs||panel!=='main'||context!=='game'||!prefs.eligible();
 if(prefs)boardView.querySelector('.row-label').textContent=prefs.board?'Return to regular view':'Full-screen game board';
 for(const [row,value] of [[showControls,prefs?.shown],[follow,prefs?.follow]]){
   row.hidden=panel!=='play-controls';row.setAttribute('role','switch');row.setAttribute('aria-checked',String(!!value));row.querySelector('.pref-value').textContent=value?'On':'Off';
 }
 if(panel==='play-controls')byId('hud-heading').textContent='Controls';
}
byId('open-games').insertAdjacentHTML('beforeend',ROW_CHEVRON);

musicRow.addEventListener('click', () => {
  closeMenu(context, 'command', menuSpec.gameMusic ? 'game-music' : 'launch:sound-test');
});

function renderHostMenu() {
  renderPlayControls();
  musicRow.hidden = panel !== 'main' || !(menuSpec.gameMusic || menuSpec.catalog?.some(item => item.id === 'sound-test'));
  renderFinish();renderPocketControls();renderDisplayMenu();
  renderPocketMenu();
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
  const inPanel=panel==='pocket';
  labButton.hidden=!inPanel;directionChoice.hidden=!prefs||!inPanel;
  if(prefs)directionChoice.querySelector('.pref-value').textContent=prefs.mode==='pad'?'D-pad':'Joystick';
}
// 747 Pocket Player submenu: on/off for the running game, plus theme and direction
// control, which are saved once and apply to every game.
const pocketMenu=byId('pocket-menu'),pocketPanel=byId('pocket-panel');
function renderPocketMenu(){
  const pocketApi=embeddedVisor&&parent.Jerm747Pocket;
  const canSwitch=context==='game'&&typeof menuSpec.pocket==='boolean';
  pocketMenu.hidden=panel!=='main'||!pocketApi;
  pocketMenu.querySelector('.pref-value').textContent=canSwitch?(menuSpec.pocket?'On':'Off'):'';
  pocketPanel.hidden=panel!=='pocket';
  const toggle=byId('pocket-view');
  toggle.hidden=!canSwitch;
  toggle.setAttribute('aria-checked',String(menuSpec.pocket===true));
  toggle.querySelector('.pref-value').textContent=menuSpec.pocket?'On':'Off';
  byId('pocket-note').hidden=canSwitch;
  if(panel==='pocket')byId('hud-heading').textContent='747 Pocket Player';
}
pocketMenu.addEventListener('click',()=>showPanel('pocket',byId('pocket-view').hidden?'pocket-finish':'pocket-view'));
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


// Display submenu: website-wide screen controls supplied by the host page (menuSpec.display).
const displayMenu=byId('display-menu'),displayPanel=byId('display-panel');
const orientationNames={auto:'Auto',portrait:'Portrait',landscape:'Landscape'};
function hostOption(command){sendHostState('option',command);}
function renderDisplayMenu(){
  const d=menuSpec.display;
  displayMenu.hidden=panel!=='main'||!d;
  displayPanel.hidden=panel!=='display'||!d;
  // On the website Fullscreen lives under Display, so the main list doesn't repeat it.
  if(d&&panel==='main')byId('hud-fullscreen').hidden=true;
  if(!d||panel!=='display')return;
  byId('hud-heading').textContent='Display';
  byId('display-orientation').querySelector('.pref-value').textContent=orientationNames[d.orientation]||'Auto';
  const full=!!d.fullscreen,fullRow=byId('display-full');
  fullRow.hidden=d.canFullscreen===false;
  fullRow.setAttribute('aria-checked',String(full));fullRow.querySelector('.pref-value').textContent=full?'On':'Off';
  const map=byId('display-map');map.hidden=!d.hasMap;
  map.setAttribute('aria-checked',String(!!d.mapShown));map.querySelector('.pref-value').textContent=d.mapShown?'On':'Off';
  const note=byId('display-note');note.textContent=d.notice||'';note.hidden=!d.notice;
}
displayMenu.addEventListener('click',()=>showPanel('display','display-orientation'));
byId('display-orientation').addEventListener('click',()=>hostOption('display:orientation'));
byId('display-full').addEventListener('click',()=>hostOption('display:fullscreen'));
byId('display-map').addEventListener('click',()=>hostOption('display:map'));
