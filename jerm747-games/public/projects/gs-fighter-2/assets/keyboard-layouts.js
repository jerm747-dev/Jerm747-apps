/* Jerm747 arcade keyboard layouts (v51). Shared by Groove Squad Get Down and Squad Arcade.
   Down arrow ducks and blocks. The choice is saved on this device. */
(function () {
  'use strict';
  var KEY = 'gs-fighter.arcade.keys';
  var arrows = { ArrowLeft: 'left', ArrowRight: 'right', KeyF: 'block', ArrowDown:'duck', ShiftLeft: 'block', ShiftRight: 'block' };
  function copy(o) { var r = {}; for (var k in o) r[k] = o[k]; return r; }
  var LAYOUTS = {
    asd: {
      label: 'Arrows + A S D / Z X C',
      held: copy(arrows),
      jump: ['ArrowUp', 'Space'],
      moves: { KeyA: 'pHigh', KeyS: 'pMid', KeyD: 'pLow', KeyZ: 'kHigh', KeyX: 'kMid', KeyC: 'kLow', KeyV: 'wave' },
      legend: '← → move · ↑ jump · A S D punch high/mid/low · Z X C kick high/mid/low · F block · V V-Wave · ↓ duck · P pause'
    },
    sdf: {
      label: 'Fight stick: S D G / Z X C',
      held: copy(arrows),
      jump: ['ArrowUp', 'Space'],
      moves: { KeyS: 'pHigh', KeyD: 'pMid', KeyG: 'pLow', KeyZ: 'kHigh', KeyX: 'kMid', KeyC: 'kLow', KeyV: 'wave' },
      legend: '← → move · ↑ jump · S D G punch high/mid/low · Z X C kick high/mid/low · F block · V V-Wave · ↓ duck · P pause'
    },
    classic: {
      label: 'Classic',
      held: { KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right', ArrowDown:'duck', KeyF:'block', ShiftLeft: 'block', ShiftRight: 'block' },
      jump: ['Space', 'ArrowUp', 'KeyW'],
      moves: { KeyU: 'pHigh', KeyI: 'pMid', KeyO: 'pLow', KeyJ: 'kHigh', KeyK: 'kMid', KeyL: 'kLow', KeyV: 'wave' },
      legend: 'A D or ← → move · W / ↑ / Space jump · U I O punch · J K L kick · F / Shift block · V V-Wave · ↓ duck · P pause'
    }
  };
  var DEFAULT = 'asd', CUSTOM_KEY='gs-fighter.arcade.customKeys.v1', custom={},custom2={},CUSTOM2_KEY='gs-fighter.arcade.player2Keys.v1';
 var SECOND={label:'Player 2',legend:'J L move · I jump · K duck · U block · O V-Wave · 1 2 3 punch · 4 5 6 kick · 0 pause',held:{KeyJ:'left',KeyL:'right',KeyK:'duck',KeyU:'block'},moves:{Digit1:'pHigh',Digit2:'pMid',Digit3:'pLow',Digit4:'kHigh',Digit5:'kMid',Digit6:'kLow',KeyO:'wave'},jump:['KeyI'],pause:['Digit0']};
  var ACTIONS={left:'Move left',right:'Move right',jump:'Jump',block:'Block',duck:'Duck and block',pHigh:'High punch',pMid:'Middle punch',pLow:'Low punch',kHigh:'High kick',kMid:'Middle kick',kLow:'Low kick',wave:'V-Wave',pause:'Pause'};
  function validCode(code){return typeof code==='string'&&/^(Key[A-Z]|Digit[0-9]|Arrow(Left|Right|Up|Down)|Space|Shift(Left|Right)|Numpad[0-9])$/.test(code);}
  try{var stored=JSON.parse(localStorage.getItem(CUSTOM_KEY)||'{}');for(var action in ACTIONS)if(validCode(stored[action]))custom[action]=stored[action];}catch(e){}
  try{var stored2=JSON.parse(localStorage.getItem(CUSTOM2_KEY)||'{}');for(var action in ACTIONS)if(validCode(stored2[action]))custom2[action]=stored2[action];}catch(e){}
  function current(player=1){
    var overrides=player===2?custom2:custom;
    var original=player===2?SECOND:LAYOUTS[currentId()],l={label:original.label,legend:original.legend,held:copy(original.held),moves:copy(original.moves),jump:original.jump.slice(),pause:player===2?SECOND.pause.slice():['KeyP']};
    for(var a in overrides){for(var k in l.held)if(l.held[k]===a||k===overrides[a])delete l.held[k];for(var m in l.moves)if(l.moves[m]===a||m===overrides[a])delete l.moves[m];l.jump=l.jump.filter(function(k){return a!=='jump'&&k!==overrides[a]});l.pause=l.pause.filter(function(k){return a!=='pause'&&k!==overrides[a]});}
    for(var a in overrides){var code=overrides[a];if(a==='jump')l.jump.push(code);else if(a==='pause')l.pause.push(code);else if(['left','right','block','duck'].indexOf(a)>=0)l.held[code]=a;else l.moves[code]=a;}
    if(Object.keys(overrides).length)l.legend='Custom keyboard mappings · Edit in Controller · Escape returns from menus';return l;
  }
  function bindings(player=1){var l=current(player),b={};for(var a in ACTIONS)b[a]=[];for(var k in l.held)b[l.held[k]].push(k);for(var k in l.moves)b[l.moves[k]].push(k);b.jump=l.jump;b.pause=l.pause;return b;}
  function notify(){paint();window.dispatchEvent(new CustomEvent('jerm747-keys-change'));}
  function conflicts(){var one=bindings(1),two=bindings(2),result=[];for(var a in one)for(var b in two)for(var code of one[a])if(two[b].includes(code)&&!result.includes(code))result.push(code);return result;}
  function assign(action,code,player=1){if(!ACTIONS[action]||!validCode(code))return 'Choose a letter, number, arrow, Space or Shift key.';var b=bindings(player);for(var a in b)if(a!==action&&b[a].indexOf(code)>=0)return code+' is already assigned to '+ACTIONS[a]+'. Choose another key or change that action first.';var other=bindings(player===2?1:2);for(var a in other)if(other[a].includes(code))return code+' is used by Player '+(player===2?1:2)+'. Choose a separate key.';var map=player===2?custom2:custom;map[action]=code;try{localStorage.setItem(player===2?CUSTOM2_KEY:CUSTOM_KEY,JSON.stringify(map));}catch(e){}notify();return '';}
  function reset(player=1){if(player===2)custom2={};else custom={};try{localStorage.removeItem(player===2?CUSTOM2_KEY:CUSTOM_KEY);}catch(e){}notify();}
  function keyLabel(code){return code==='Space'?'Space':code.replace(/^Key|^Digit/,'').replace('Arrow','Arrow ').replace('ShiftLeft','Left Shift').replace('ShiftRight','Right Shift');}
  function editor(root){
    var player=1,waiting=null,buttons={},title=document.createElement('h3');title.textContent='Keyboard mapping';root.appendChild(title);var tabs=document.createElement('div');tabs.className='row';for(var n of (window.SquadArcadeReview?[1,2]:[1])){var tab=document.createElement('button');tab.type='button';tab.dataset.keyPlayer=n;tab.textContent='Player '+n+' keys';tab.onclick=function(){player=Number(this.dataset.keyPlayer);waiting=null;refresh();status.textContent='Editing Player '+player+' keys.';};tabs.appendChild(tab);}root.appendChild(tabs);
    var note=document.createElement('p');note.textContent='Select an action, then press its key. Escape cancels. Changes save on this device.';root.appendChild(note);
    var grid=document.createElement('div');grid.className='console-key-grid';root.appendChild(grid);
    var status=document.createElement('p');status.setAttribute('role','status');root.appendChild(status);
    function refresh(){var b=bindings(player);for(var tab of tabs.children)tab.setAttribute('aria-pressed',String(Number(tab.dataset.keyPlayer)===player));for(var a in buttons)buttons[a].textContent=ACTIONS[a]+' · '+b[a].map(keyLabel).join(' / ');}
    for(var a in ACTIONS)(function(action){var b=document.createElement('button');b.type='button';b.dataset.bindAction=action;b.onclick=function(){waiting=action;status.textContent='Press a key for '+ACTIONS[action]+' (Escape cancels).';b.textContent='Press a key…';};grid.appendChild(b);buttons[action]=b;})(a);
    var defaults=document.createElement('button');defaults.type='button';defaults.textContent='Restore keyboard defaults';defaults.onclick=function(){waiting=null;reset(player);refresh();status.textContent='Keyboard defaults restored.';};root.appendChild(defaults);
    function capture(e){if(!waiting||!root.isConnected||root.closest('.hidden'))return;e.preventDefault();e.stopImmediatePropagation();if(e.key==='Escape'){waiting=null;refresh();status.textContent='Mapping cancelled.';return;}if(e.ctrlKey||e.metaKey||e.altKey){status.textContent='Use a single key without Ctrl, Alt or Command.';return;}var error=assign(waiting,e.code,player);if(error){status.textContent=error;return;}var action=waiting;waiting=null;refresh();status.textContent=ACTIONS[action]+' assigned to '+keyLabel(e.code)+'.';buttons[action].focus();}
    window.addEventListener('keydown',capture,true);refresh();return function(){waiting=null;window.removeEventListener('keydown',capture,true);};
  }
  function currentId() {
    try { var v = localStorage.getItem(KEY); if (v && LAYOUTS[v]) return v; } catch (e) {}
    return DEFAULT;
  }
  function paint() {
    var id = currentId();
    var buttons = document.querySelectorAll('[data-keys]');
    for (var i = 0; i < buttons.length; i++) buttons[i].setAttribute('aria-pressed', String(buttons[i].getAttribute('data-keys') === id));
    var legends = document.querySelectorAll('[data-keys-legend]');
    for (var j = 0; j < legends.length; j++) legends[j].textContent = current().legend;
    var arena = document.getElementById('arena');
    if (arena) arena.setAttribute('aria-label', 'Arcade fight. ' + current().legend + '.');
  }
  function set(id) {
    if (!LAYOUTS[id]) return;
    try { localStorage.setItem(KEY, id); } catch (e) {}
    paint();
    try { window.dispatchEvent(new CustomEvent('jerm747-keys-change', { detail: id })); } catch (e) {}
  }
  function bind() {
    var buttons = document.querySelectorAll('[data-keys]');
    for (var i = 0; i < buttons.length; i++) {
      (function (b) { b.addEventListener('click', function () { set(b.getAttribute('data-keys')); }); })(buttons[i]);
    }
    paint();
  }
  window.Jerm747Keys = {
    layouts: LAYOUTS,
    id: currentId,
    current: current,
    set: set, actions:ACTIONS,bindings:bindings,assign:assign,reset:reset,editor:editor,conflicts:conflicts
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind); else bind();
})();
