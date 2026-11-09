/* v69.7 · Controller setup for the Groove Squad fight games (Get Down, Squad Arcade, Catalog Clash).
 *
 * - Works with ANY controller, including ones the browser doesn't call "standard" (e.g. a Retroid's
 *   built-in pad that shows up as "button 1, button 2…").
 * - Fighter-select arrows assign detected physical controllers to Player 1 and Player 2.
 *   Story mode without slots keeps its first-controller route.
 * - Each controller's buttons can be set up with "Auto setup" (press each button when asked) or changed
 *   one at a time. The setup is saved on this device for that controller ("layout" keys never sync).
 * - Until someone sets a controller up, it uses the usual layout:
 *     D-pad / left stick: move · A (bottom): jump · X (left): punch · B (right): kick · Y (top): V-Wave
 *     L1: block · hold R1 for high, L2 for low · R2: gather · L3 / R3: call Jado / Eli
 *     Start: pause · Select: music
 */
(function () {
  'use strict';
  const ACTIONS = [
    // id, label, usual button (standard layout index), group
    ['left', 'Move left', 14, 'move'], ['right', 'Move right', 15, 'move'],
    ['up', 'D-pad up', 12, 'move'], ['down', 'Duck (down)', 13, 'move'],
    ['punch', 'Punch', 2, 'attack'], ['kick', 'Kick', 1, 'attack'],
    ['jump', 'Jump', 0, 'attack'], ['wave', 'V-Wave', 3, 'attack'],
    ['block', 'Block', 4, 'hold'], ['high', 'High (hold)', 5, 'hold'], ['low', 'Low (hold)', 6, 'hold'],
    ['start', 'Pause / Start', 9, 'menu'], ['music', 'Music / Select', 8, 'menu'],
    ['gather', 'Gather (story)', 7, 'extra'], ['jado', 'Call Jado (story)', 10, 'extra'], ['eli', 'Call Eli (story)', 11, 'extra'],
  ];
  // Auto setup asks for these (the story extras can be set in the list afterwards)
  const WIZARD = ['left', 'right', 'up', 'down', 'punch', 'kick', 'jump', 'wave', 'block', 'high', 'low', 'start', 'music'];
  const STICK = { left: { t: 'a', i: 0, d: -1 }, right: { t: 'a', i: 0, d: 1 }, up: { t: 'a', i: 1, d: -1 }, down: { t: 'a', i: 1, d: 1 } };
  const PROFILES=[{id:'xbox-standard',family:'Xbox-style',match:/xbox|xinput/i},{id:'playstation-standard',family:'PlayStation-style',match:/dualsense|dualshock|playstation|054c/i},{id:'nintendo-standard',family:'Nintendo-style',match:/nintendo|switch|pro controller/i},{id:'browser-standard',family:'Standard controller',match:/.*/}];
  const DIRECT=['pHigh','pMid','pLow','kHigh','kMid','kLow'];
  ACTIONS.push(...[['pHigh','High punch',2],['pMid','Mid punch',3],['pLow','Low punch',4],['kHigh','High kick',5],['kMid','Mid kick',1],['kLow','Low kick',6]].map(a=>[...a,'arcade']));
  const ARCADE_WIZARD=['left','right','up','down','jump',...DIRECT,'block','wave','start','music'];
  const KEY = (id) => 'gs-fighter.gamepad.layout.' + String(id || 'pad').slice(0, 120);
  const AXIS_ON = 0.5;

  function defaults() {
    const m = {};
    for (const [id, , std] of ACTIONS) { m[id] = DIRECT.includes(id)?[]:[{ t: 'b', i: std }]; if (STICK[id]) m[id].push(STICK[id]); }
    return m;
  }
  function profile(pad){const name=String(pad?.id||'');if(isCustom(name))return {id:'saved',label:'Saved setup for this controller',known:true};if(pad?.mapping!=='standard')return {id:'unknown',label:'No verified starter profile · use Auto setup',known:false};const found=PROFILES.find(p=>p.match.test(name));return {id:found.id,label:found.family+' · browser standard starter',known:true};}
  function starter(pad){if(pad?.mapping==='standard')return defaults();const m=Object.fromEntries(ACTIONS.map(([id])=>[id,[]]));m.__jumpFromUp=false;return m;}
  function load(padId,device) {
    try {
      const raw = JSON.parse(localStorage.getItem(KEY(padId)) || 'null');
      if (raw && typeof raw === 'object') { const m = defaults(); for (const k of Object.keys(m)) if (Array.isArray(raw[k])) { m[k] = raw[k].filter(validBinding); } m.__jumpFromUp=raw.__jumpFromUp!==false;return m; }
    } catch (e) { /* fall back */ }
    return device?starter(device):defaults();
  }
  function validBinding(b) { return b && (b.t === 'b' || b.t === 'a') && Number.isInteger(b.i) && b.i >= 0 && b.i < 64 && (b.t === 'b' || b.d === 1 || b.d === -1); }
  function save(padId, map) { try { localStorage.setItem(KEY(padId), JSON.stringify(map)); return true; } catch (e) { return false; } }
  function reset(padId) { try { localStorage.removeItem(KEY(padId)); } catch (e) { /* fine */ } }
  const isCustom = (padId) => { try { return !!localStorage.getItem(KEY(padId)); } catch (e) { return false; } };

  const btn = (pad, n) => !!pad.buttons?.[n] && (pad.buttons[n].pressed || pad.buttons[n].value > 0.55);
  const ax = (pad, n) => (Number.isFinite(pad.axes?.[n]) ? pad.axes[n] : 0);
  const on = (pad, b) => (b.t === 'b' ? btn(pad, b.i) : ax(pad, b.i) * b.d > AXIS_ON);
  const any = (pad, list) => (list || []).some((b) => on(pad, b));
  const label = (b) => (!b ? '—' : b.t === 'b' ? 'Button ' + b.i : 'Stick/axis ' + b.i + (b.d < 0 ? ' −' : ' +'));

  function assignment(map,id){
    if(map[id]?.length)return {assigned:true,direct:true,text:map[id].map(label).join(' / '),bindings:map[id]};
    if(DIRECT.includes(id)){const base=id[0]==='p'?'punch':'kick',height=id.slice(1),modifier=height==='High'?'high':height==='Low'?'low':null,bindings=map[base]||[];if(bindings.length&&(!modifier||map[modifier]?.length))return {assigned:true,direct:false,text:bindings.map(label).join(' / ')+(modifier?' + hold '+map[modifier].map(label).join(' / '):' · release High / Low'),bindings:[...bindings,...(modifier?map[modifier]:[])]};}
    return {assigned:false,direct:false,text:'Not assigned',bindings:[]};
  }
  /** Connected controllers in a steady order (lowest index first). */
  function pads() {
    let list = [];
    try { list = Array.from(navigator.getGamepads ? navigator.getGamepads() : []).filter((p) => p && p.connected !== false); } catch (e) { list = []; }
    return list.sort((a, b) => a.index - b.index);
  }

  /** Read a supplied physical pad, or detected controller #slot for games without slot assignments. */
  function reader(slot) {
    let index = null, id = '', map = null, previous = {}, armed = false, seenRevision=-1;
    return {
      reset() { armed = false; previous = {}; },
      reload() { map = null; },
      read(assigned) {
        const pad = arguments.length ? assigned : pads()[slot];
        if (!pad) { const disconnected = index !== null; index = null; id = ''; armed = false; previous = {}; return { pad: null, disconnected, state: {} }; }
        if (pad.index !== index || pad.id !== id || !map || seenRevision!==revision) { index = pad.index; id = pad.id; map = load(pad.id,pad); seenRevision=revision; armed = false; previous = {}; }
        if (api.capturing) return { pad, waiting: true, state: {} }; // setup screen is listening
        const now = {};
        for (const [aid] of ACTIONS) now[aid] = any(pad, map[aid]);
        if (!armed) { if (!Object.values(now).some(Boolean)) armed = true; previous = now; return { pad, waiting: !armed, held:Object.keys(now).filter(k=>now[k]), state: {} }; }
        const edge = (k) => now[k] && !previous[k];
        const height = now.low ? 'Low' : now.high ? 'High' : 'Mid',direct=DIRECT.find(edge);
        // analog move strength from whatever axis "right" is on (if any)
        const strength=list=>Math.max(0,...(list||[]).filter(b=>b.t==='a').map(b=>Math.max(0,Math.min(1,(ax(pad,b.i)*b.d-.25)/.75))));
        const x=strength(map.right)-strength(map.left);
        const digitalMove = (map.left || []).some((b) => b.t === 'b' && btn(pad, b.i)) || (map.right || []).some((b) => b.t === 'b' && btn(pad, b.i));
        const state = {
          left: now.left, right: now.right,
          moveAxis: digitalMove ? null : x,
          block: now.block, duck: now.down, gather: now.gather,
          jump: edge('jump') || map.__jumpFromUp!==false&&edge('up'),
          attack: direct || (edge('punch') ? 'p' + height : edge('kick') ? 'k' + height : edge('wave') ? 'wave' : null),
          assist: edge('jado') ? 'jado' : edge('eli') ? 'eli' : null,
        };
        const menu = { left: now.left, right: now.right, up: now.up, down: now.down };
        const shoulders={previous:now.block,next:now.high,rewind:now.low,forward:now.gather};
        const result = { pad, state, menu, shoulders, start: edge('start'), music: edge('music'), confirm: edge('jump'), back: edge('kick')||edge('kMid'), custom: isCustom(pad.id),unmapped: !isCustom(pad.id)&&pad.mapping!=='standard' };
        previous = now;
        return result;
      },
    };
  }

  /* ---------- Setup screen (auto + manual), shown inside the CONTROLLER sheet ---------- */
  const POS = { // where each usual button sits on the little controller picture (x, y in a 240×120 box)
    12: [52, 46], 13: [52, 78], 14: [36, 62], 15: [68, 62], 0: [188, 80], 1: [206, 62], 2: [170, 62], 3: [188, 44],
    4: [50, 14], 5: [190, 14], 6: [50, 4], 7: [190, 4], 8: [104, 60], 9: [136, 60], 10: [84, 96], 11: [156, 96],
  };
  function padPicture(hi) {
    const dot = (n, r) => { const [x, y] = POS[n]; return '<circle cx="' + x + '" cy="' + y + '" r="' + r + '" class="gp-b' + (n === hi ? ' is-hi' : '') + '"/>'; };
    const sh = (n, x) => '<rect x="' + (x - 22) + '" y="' + (n === 6 || n === 7 ? 0 : 9) + '" width="44" height="9" rx="4" class="gp-b' + (n === hi ? ' is-hi' : '') + '"/>';
    return '<svg class="gp-pic" viewBox="0 0 240 120" aria-hidden="true"><path class="gp-body" d="M40 22h160c22 0 34 18 38 44 4 30-10 50-28 50-14 0-22-12-32-24H62C52 104 44 116 30 116 12 116-2 96 2 66 6 40 18 22 40 22z"/>' +
      sh(6, 50) + sh(7, 190) + sh(4, 50) + sh(5, 190) +
      [12, 13, 14, 15].map((n) => dot(n, 7)).join('') + [0, 1, 2, 3].map((n) => dot(n, 8)).join('') +
      dot(8, 5) + dot(9, 5) + dot(10, 11) + dot(11, 11) + '</svg>';
  }

  /** Wait for a fresh press on this physical device; resolve null on cancel or disconnect. */
  function capture(device, isCancelled) {
    return new Promise((resolve) => {
      let base = null, released = false;
      const tick = () => {
        if (isCancelled()) { resolve(null); return; }
        const pad = pads().find(p=>p.index===device.index&&p.id===device.id);
        if(!pad){resolve(null);return;}
        if (pad) {
          const b = pad.buttons.map((x, i) => btn(pad, i)), a = Array.from(pad.axes || []);
          if (!base) base = { a: a.slice() };
          const idle = !b.some(Boolean) && a.every((v, i) => Math.abs(v - (base.a[i] || 0)) < 0.35);
          if (!released) { if (idle) released = true; }
          else {
            const bi = b.findIndex(Boolean);
            if (bi >= 0) { resolve({ t: 'b', i: bi }); return; }
            for (let i = 0; i < a.length; i++) { const dv = a[i] - (base.a[i] || 0); if (Math.abs(dv) > 0.6 && Math.abs(a[i]) > 0.5) { resolve({ t: 'a', i, d: a[i] > 0 ? 1 : -1 }); return; } }
          }
        }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  }

  /** Builds the setup block into `panel`; returns a cleanup function. */
  function editor(panel, opts = {}) {
    const box = document.createElement('section'); box.className = 'gp-setup';
    let slot = Math.max(0,pads().findIndex(p=>p.index===opts.padIndex)), closed = false, busy = false,layoutView='arcade',showUnused=false,showUtility=false;
    let completion='';const drafts=new Map();
    const draftKey=id=>'gs-fighter.gamepad.draft.'+String(id).slice(0,120);
    function draft(pad){if(!drafts.has(pad.id)){let m;try{m=JSON.parse(localStorage.getItem(draftKey(pad.id))||'null');}catch{}if(!m||!ACTIONS.every(([id])=>Array.isArray(m[id])&&m[id].every(validBinding)))m=load(pad.id,pad);drafts.set(pad.id,m);}return drafts.get(pad.id);}
    function stash(pad,map){drafts.set(pad.id,structuredClone(map));try{localStorage.setItem(draftKey(pad.id),JSON.stringify(map));}catch{}}
    const same=(a,b)=>a.t===b.t&&a.i===b.i&&(a.t==='b'||a.d===b.d);
    function bind(map,id,got,pad){
      for(const [other]of ACTIONS)if(other!==id)map[other]=(map[other]||[]).filter(b=>!same(b,got));
      const preserved=STICK[id]?(map[id]||[]).filter(b=>b.t!==got.t):[];
      if(STICK[id]&&got.t==='b'&&!preserved.length)preserved.push({...STICK[id]});
      if(STICK[id]&&got.t==='a'&&!preserved.length&&pad.mapping==='standard')preserved.push({t:'b',i:ACTIONS.find(a=>a[0]===id)[2]});
      map[id]=[got,...preserved];map.__jumpFromUp=false;
    }
    const head = document.createElement('div'); head.className = 'gp-head';
    const h = document.createElement('h3'); h.textContent = '🎮 Controller buttons';
    const who = document.createElement('div'); who.className = 'gp-who'; who.setAttribute('role', 'group'); who.setAttribute('aria-label', 'Which controller');
    head.append(h, who);
    const status = document.createElement('p'); status.className = 'gp-status';
    const actions = document.createElement('div'); actions.className = 'gp-actions';
    const auto = mk('Classic Auto', 'gp-auto'),arcadeAuto=mk('Six-attack Auto','gp-arcade-auto'), resetBtn = mk('Use detected starter profile', 'gp-reset');
    actions.append(auto,arcadeAuto);
    const stage = document.createElement('div'); stage.className = 'gp-stage'; stage.hidden = true;
    const layouts=document.createElement('div');layouts.className='gp-layouts';const profileNote=document.createElement('p');profileNote.className='gp-profile';profileNote.setAttribute('role','status');
    const list = document.createElement('details'); list.className = 'gp-list';
    const sum = document.createElement('summary'); sum.textContent = 'Change one button'; list.append(sum,resetBtn);
    const table = document.createElement('div'); table.className = 'gp-rows'; list.appendChild(table);
    const applyBar=document.createElement('div');applyBar.className='gp-apply-bar';
    const complete=document.createElement('strong');complete.className='gp-completion';complete.setAttribute('role','status');complete.hidden=true;const applyBtn=mk('APPLY CONTROLS','gp-apply');const applyStatus=document.createElement('p');applyStatus.className='gp-apply-status';applyStatus.setAttribute('role','status');
    const live=document.createElement('output');live.className='gp-applied-live';live.setAttribute('aria-label','Active controller test');live.textContent='Active controls: release buttons and sticks to begin testing.';
    applyBar.append(complete,applyBtn,applyStatus,live);
    applyBtn.onclick=()=>{const pad=current();if(!pad||busy)return;const map=draft(pad);if(!save(pad.id,map)){applyStatus.textContent='Could not save controls. Keep this page open and retry.';return;}drafts.set(pad.id,load(pad.id,pad));try{localStorage.removeItem(draftKey(pad.id));}catch{}api.changed();window.dispatchEvent(new CustomEvent('jerm747-pad-configured',{detail:{index:pad.index,id:pad.id}}));window.Jerm747Controls?.release?.();completion='CONTROLS APPLIED ✓';paint();applyStatus.textContent='APPLIED — saved and active. Release controls, test below, then Back to game.';};
    box.append(head,applyBar,status,profileNote,actions,stage,layouts,list);
    panel.appendChild(box);

    function mk(text, cls) { const b = document.createElement('button'); b.type = 'button'; b.textContent = text; b.className = 'nes-console-button ' + cls; return b; }
    const current = () => pads()[slot];
    function paint() {
      const all = pads();
      who.replaceChildren(...all.map((device,n) => {
        const b = document.createElement('button'); b.type = 'button'; b.textContent = 'Controller ' + (n + 1);b.title=device.id;
        b.setAttribute('aria-pressed', String(n === slot)); b.disabled = !all[n] || busy;
        b.onclick = () => { slot = n; paint(); }; return b;
      }));
      const pad = current();
      if (!pad) { status.textContent = all.length ? 'Select a connected controller.' : 'No controller yet: connect one and press any button.'; auto.disabled=arcadeAuto.disabled = resetBtn.disabled = applyBtn.disabled = true; table.replaceChildren();layouts.replaceChildren();profileNote.textContent='Connect a controller to find its saved setup or starter profile.';return; }
      auto.disabled=arcadeAuto.disabled=busy;resetBtn.disabled=busy||pad.mapping!=='standard';profileNote.textContent='Active profile: '+profile(pad).label;profileNote.dataset.profile=profile(pad).id;
      complete.textContent=completion;complete.hidden=!completion;complete.dataset.applied=String(completion.startsWith('CONTROLS APPLIED'));applyBtn.disabled=busy;const map=draft(pad);const pending=JSON.stringify(map)!==JSON.stringify(load(pad.id,pad));applyBtn.textContent='APPLY CONTROLS';applyBtn.classList.toggle('is-pending',pending);applyStatus.textContent=busy?'Mapping in progress — finish or stop, then Apply.':pending||completion.includes('PRESS APPLY')?'Ready. Press APPLY CONTROLS to save and activate this scheme.':'Saved scheme is active. Make changes, then Apply.';paintLayouts(map);
      status.textContent = 'Controller ' + (slot + 1) + ': ' + pad.id.replace(/\s*\(.*?\)\s*/g, ' ').trim().slice(0, 60) + (isCustom(pad.id) ? ' · your setup' : pad.mapping==='standard'?' · starter profile':' · needs setup');
      table.replaceChildren(...ACTIONS.map(([id, text]) => {
        const row = document.createElement('div'); row.className = 'gp-row';
        const name = document.createElement('span'); name.textContent = text;
        const val = document.createElement('span'); val.className = 'gp-val'; val.textContent = (map[id] || []).map(label).join(' · ') || '—';
        const ch = document.createElement('button'); ch.type = 'button'; ch.textContent = 'Change'; ch.disabled = busy;
        ch.onclick = () => one(id, text, ch);
        const clear=mk('Clear','gp-clear');clear.setAttribute('aria-label','Clear '+text+' assignment');clear.disabled=busy||!map[id]?.length;clear.onclick=()=>{completion='';const next=draft(pad);next[id]=[];stash(pad,next);paint();};row.append(name,val,ch,clear); return row;
      }));
    }
    function paintLayouts(map,waiting=null){
      layouts.replaceChildren();layouts.dataset.view=layoutView;const pad=current();if(!pad)return;const tabs=document.createElement('div');tabs.className='gp-view-tabs';tabs.setAttribute('role','group');tabs.setAttribute('aria-label','Mapping view');for(const [id,text]of [['arcade','Game buttons'],['physical','Physical pad'],['both','Compare']]){const b=mk(text,'gp-view-tab');b.dataset.view=id;b.setAttribute('aria-pressed',String(layoutView===id));b.onclick=()=>{layoutView=id;paintLayouts(map,waiting);layouts.querySelector('[data-view="'+id+'"]').focus();};tabs.appendChild(b);}layouts.appendChild(tabs);
      const arcade=document.createElement('section');arcade.className='gp-arcade-layout';arcade.hidden=layoutView==='physical';const title=document.createElement('h4');title.textContent='Jerm747 arcade controls';arcade.appendChild(title);const hint=document.createElement('p');hint.textContent= [...DIRECT,'left','right','up','down','jump','block','wave','start','music'].filter(id=>assignment(map,id).assigned).length+' / 15 controls assigned · Select a button to change it.';arcade.appendChild(hint);
      const grid=document.createElement('div');grid.className='gp-arcade-grid';const combat=document.createElement('div');combat.className='gp-arcade-grid gp-combat-aux';const utility=document.createElement('div');utility.className='gp-arcade-grid gp-utility-grid';utility.hidden=!showUtility;for(const id of [...DIRECT,'left','right','up','down','jump','block','wave','start','music']){const report=assignment(map,id),text=ACTIONS.find(a=>a[0]===id)[1],b=mk('','gp-arcade-key');b.dataset.action=id;b.classList.toggle('is-assigned',report.assigned);b.classList.toggle('is-mapping',waiting===id);b.disabled=busy;const name=document.createElement('strong');name.textContent=text;const value=document.createElement('span');value.textContent=(report.assigned?'✓ ':'○ ')+report.text;const kind=document.createElement('small');kind.textContent=report.assigned?(report.direct?'Direct button':'Button combination'):'Choose a physical button';b.setAttribute('aria-label',text+': '+report.text);b.append(name,value,kind);b.onclick=()=>one(id,text,b);(DIRECT.includes(id)?grid:['block','wave'].includes(id)?combat:utility).appendChild(b);}arcade.append(grid,combat);const expand=mk(showUtility?'Hide movement & menu':'Movement & menu buttons','gp-utility-toggle');expand.setAttribute('aria-expanded',String(showUtility));expand.onclick=()=>{showUtility=!showUtility;paintLayouts(map,waiting);layouts.querySelector('.gp-utility-toggle').focus();};arcade.append(expand,utility);
      const physical=document.createElement('section');physical.className='gp-physical-layout';physical.hidden=layoutView==='arcade';const ph=document.createElement('h4');ph.textContent='Your connected controller';const pname=document.createElement('p');pname.textContent=pad.id;physical.append(ph,pname);const diagram=document.createElement('div');diagram.innerHTML=padPicture(-1);physical.appendChild(diagram);const guide=document.createElement('small');guide.textContent='Standard shape guide · Actual browser button numbers below.';physical.appendChild(guide);const unused=mk(showUnused?'Hide unused buttons':'Show unused buttons','gp-unused-toggle');unused.setAttribute('aria-expanded',String(showUnused));unused.onclick=()=>{showUnused=!showUnused;paintLayouts(map,waiting);layouts.querySelector('.gp-unused-toggle').focus();};physical.appendChild(unused);const buttons=document.createElement('div');buttons.className='gp-physical-buttons';for(let i=0;i<(pad.buttons?.length||0);i++){const assigned=ACTIONS.filter(([id])=>(map[id]||[]).some(b=>b.t==='b'&&b.i===i)).map(a=>a[1]);const field=document.createElement('div');field.className='gp-physical-button';field.dataset.button=i;field.hidden=!assigned.length&&!showUnused;field.classList.toggle('is-assigned',assigned.length>0);const number=document.createElement('strong');number.textContent='Button '+i;const value=document.createElement('span');value.textContent=assigned.join(' / ')||'Available';field.append(number,value);buttons.appendChild(field);}physical.appendChild(buttons);const axes=document.createElement('p');axes.className='gp-axis-bindings';axes.textContent=ACTIONS.flatMap(([id,text])=>(map[id]||[]).filter(b=>b.t==='a').map(b=>text+': '+label(b))).join(' · ')||'No axis bindings in this fight layout.';physical.appendChild(axes);layouts.append(arcade,physical);
    }
    async function one(id, text, button) {
      const pad = current(); if (!pad || busy) return;
      completion='';busy = true; api.capturing = true; paint();
      showStage(text, ACTIONS.find((a) => a[0] === id)[2], null);paintLayouts(draft(pad),id);
      const got = await capture(pad, () => closed || !busy);
      if(got){const map=draft(pad);bind(map,id,got,pad);stash(pad,map);}
      done(got?'BUTTON MAPPED — PRESS APPLY':'MAPPING CANCELED');
    }
    let skipNow = false, backNow = false;
    function showStage(text, std, step) {
      stage.hidden = false;
      stage.innerHTML = padPicture(std) + '<p class="gp-ask">Press the button for <b></b></p><p class="gp-step"></p>';
      stage.querySelector('b').textContent = text;const id=ACTIONS.find(a=>a[1]===text)?.[0];if(id)stage.dataset.action=id;
      stage.querySelector('.gp-step').textContent = step ? 'Step ' + step[0] + ' of ' + step[1] + ' · the lit spot is the usual place, but any button works' : 'Any button or stick direction works';
      const row = document.createElement('div'); row.className = 'gp-stage-actions';
      if (step) { const back = mk('Back a step', 'gp-back'); back.disabled = step[0] === 1; back.onclick = () => { backNow = true; }; row.appendChild(back); }
      if (step) { const skip = mk('Skip', 'gp-skip'); skip.onclick = () => { skipNow = true; }; row.appendChild(skip); }
      const stop = mk(step ? 'Stop' : 'Cancel', 'gp-stop'); stop.onclick = () => { busy = false; }; row.appendChild(stop);
      stage.appendChild(row);
    }
    async function wizard(steps=WIZARD) {
      const pad = current(); if (!pad || busy) return;
      completion='';busy = true; api.capturing = true; paint();
      const prior=draft(pad),map=structuredClone(prior);
      map.start=prior.start;map.music=prior.music;map.__jumpFromUp=false;
      let completed=0;for (let n = 0; n < steps.length && busy && !closed;) {
        const id = steps[n], [, text, std] = ACTIONS.find((a) => a[0] === id);
        skipNow = backNow = false;
        showStage(text, std, [n + 1, steps.length]);paintLayouts(map,id);
        const got = await capture(pad, () => closed || !busy || skipNow || backNow);
        if (backNow) { n = Math.max(0, n - 1); continue; }
        if (got) {
          bind(map,id,got,pad);stash(pad,map);
          if (navigator.vibrate) try { navigator.vibrate(12); } catch (e) { /* fine */ }
        }
        if(got||skipNow){n++;completed=n;}else busy=false;
      }
      if(!closed)stash(pad,map);
      done(completed===steps.length?'MAPPING COMPLETE — PRESS APPLY':'SETUP STOPPED — PRESS APPLY TO KEEP CHANGES');
    }
    function done(message) { completion=message||'';busy = false; api.capturing = false; stage.hidden = true; stage.replaceChildren();window.Jerm747Controls?.release?.();if(!closed){paint();applyBtn.focus({preventScroll:true});} }
    auto.onclick = ()=>wizard();arcadeAuto.onclick=()=>wizard(ARCADE_WIZARD);
    resetBtn.onclick = () => { const pad = current(); if (pad) { completion='STARTER SCHEME READY — PRESS APPLY';stash(pad,starter(pad)); paint(); } };
    const onPad = () => { if (!busy) paint(); };
    window.addEventListener('gamepadconnected', onPad); window.addEventListener('gamepaddisconnected', onPad);
    const tester=reader(slot);const liveTimer=setInterval(()=>{if(closed||busy)return;const pad=current();const reading=tester.read(pad);if(!pad){live.textContent='No connected controller.';return;}const m=load(pad.id,pad),held=ACTIONS.filter(([id])=>any(pad,m[id])).map(a=>a[1]);live.textContent=reading.waiting?'Release controls to arm the applied scheme.':'ACTIVE TEST: '+(held.join(' · ')||'Ready — press a button or move a stick');live.dataset.actions=ACTIONS.filter(([id])=>any(pad,m[id])).map(a=>a[0]).join(' ');},80);
    let padCount = -1;
    const timer = setInterval(() => { if (!busy) { const n = pads().length; if (n !== padCount) { padCount = n; paint(); } } }, 700);
    paint();
    return () => { closed = true; busy = false; api.capturing = false; clearInterval(timer);clearInterval(liveTimer); window.removeEventListener('gamepadconnected', onPad); window.removeEventListener('gamepaddisconnected', onPad); };
  }

  let revision=0;const listeners = new Set();
  const api = {
    ACTIONS, WIZARD, ARCADE_WIZARD, DIRECT, PROFILES, profile,starter,assignment, reader, editor, load, save, reset, defaults, label, pads, isCustom, capturing: false,
    onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    changed() { revision++;listeners.forEach((fn) => { try { fn(); } catch (e) { /* fine */ } });window.dispatchEvent(new CustomEvent('jerm747-pad-layout-change')); },
  };
  window.addEventListener('storage',e=>{if(e.key?.startsWith('gs-fighter.gamepad.layout.'))api.changed();});
  window.Jerm747PadMap = api;
  if (typeof module !== 'undefined') module.exports = api;
})();
