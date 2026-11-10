/* 747 Pocket: the original molded Encore Handheld controls adapted to an
   existing arcade frame. The playing document never changes parents. */
(() => {
  'use strict';
  const stylesheet = new URL('pocket-shell.css', document.currentScript.src).href;
  const faces = [
    ['y', 'top', '#b9c6ff'], ['x', 'left', '#ffa7cc'],
    ['a', 'right', '#ffdc91'], ['b', 'bottom', '#9ef0dc']
  ];
  const actions = ['up', 'down', 'left', 'right', 'a', 'b', 'x', 'y', 'l', 'r', 'select'];
  const sectors = [['right'], ['up','right'], ['up'], ['up','left'],
                   ['left'], ['down','left'], ['down'], ['down','right']];
  const padMarkup = `<div class="dpad" role="group" aria-label="Eight-way direction pad. Slide toward a corner to combine two directions.">
        <svg class="controller-defs" aria-hidden="true" width="0" height="0"><defs>
          <linearGradient id="padBevel" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#8c9196"/><stop offset=".18" stop-color="#50565d"/><stop offset=".49" stop-color="#252a30"/><stop offset=".72" stop-color="#101419"/><stop offset="1" stop-color="#06080b"/></linearGradient>
          <linearGradient id="padFace" x1="0" y1="0" x2=".65" y2="1"><stop stop-color="#383d43"/><stop offset=".45" stop-color="#272d33"/><stop offset="1" stop-color="#181d23"/></linearGradient>
          <linearGradient id="padLit" x1="0" y1="0" x2=".6" y2="1"><stop stop-color="#48655f"/><stop offset=".45" stop-color="#2a4842"/><stop offset="1" stop-color="#182d2c"/></linearGradient>
          <filter id="padGrain" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="3" seed="12" result="noise"/><feColorMatrix in="noise" type="saturate" values="0"/><feComponentTransfer><feFuncA type="linear" slope=".48"/></feComponentTransfer><feComposite in2="SourceGraphic" operator="in"/><feBlend in2="SourceGraphic" mode="soft-light"/></filter>
        </defs></svg>
        <svg class="direction-ring" viewBox="0 0 200 200" aria-hidden="true"><path data-directions="up" d="M70.95 10.60 A94 94 0 0 1 129.05 10.60"/><path data-directions="up right" d="M142.68 16.25 A94 94 0 0 1 183.75 57.32"/><path data-directions="right" d="M189.40 70.95 A94 94 0 0 1 189.40 129.05"/><path data-directions="down right" d="M183.75 142.68 A94 94 0 0 1 142.68 183.75"/><path data-directions="down" d="M129.05 189.40 A94 94 0 0 1 70.95 189.40"/><path data-directions="down left" d="M57.32 183.75 A94 94 0 0 1 16.25 142.68"/><path data-directions="left" d="M10.60 129.05 A94 94 0 0 1 10.60 70.95"/><path data-directions="up left" d="M16.25 57.32 A94 94 0 0 1 57.32 16.25"/></svg>
        <span class="pad-well" aria-hidden="true"></span>
        <button class="pad-up" data-key="up" aria-label="Up" aria-pressed="false"><svg viewBox="0 0 100 116" aria-hidden="true" focusable="false"><path class="cap-edge" d="M17 4 Q3 5 3 21 L3 75 Q3 88 14 94 L43 111 Q50 115 57 111 L86 94 Q97 88 97 75 L97 21 Q97 5 83 4 Z"/><path class="cap-face" d="M19 10 Q11 11 11 23 L11 73 Q11 81 19 86 L46 101 Q50 104 54 101 L81 86 Q89 81 89 73 L89 23 Q89 11 81 10 Z"/><path class="cap-sheen" d="M18 13 Q13 15 13 24 L13 72 M20 12 L79 12 Q85 13 86 23"/><path class="cap-foot" d="M18 88 L44 104 Q50 108 56 104 L83 88"/></svg></button>
        <button class="pad-right" data-key="right" aria-label="Move right" aria-pressed="false"><svg viewBox="0 0 100 116" aria-hidden="true" focusable="false"><path class="cap-edge" d="M17 4 Q3 5 3 21 L3 75 Q3 88 14 94 L43 111 Q50 115 57 111 L86 94 Q97 88 97 75 L97 21 Q97 5 83 4 Z"/><path class="cap-face" d="M19 10 Q11 11 11 23 L11 73 Q11 81 19 86 L46 101 Q50 104 54 101 L81 86 Q89 81 89 73 L89 23 Q89 11 81 10 Z"/><path class="cap-sheen" d="M18 13 Q13 15 13 24 L13 72 M20 12 L79 12 Q85 13 86 23"/><path class="cap-foot" d="M18 88 L44 104 Q50 108 56 104 L83 88"/></svg></button>
        <button class="pad-down" data-key="down" aria-label="Down" aria-pressed="false"><svg viewBox="0 0 100 116" aria-hidden="true" focusable="false"><path class="cap-edge" d="M17 4 Q3 5 3 21 L3 75 Q3 88 14 94 L43 111 Q50 115 57 111 L86 94 Q97 88 97 75 L97 21 Q97 5 83 4 Z"/><path class="cap-face" d="M19 10 Q11 11 11 23 L11 73 Q11 81 19 86 L46 101 Q50 104 54 101 L81 86 Q89 81 89 73 L89 23 Q89 11 81 10 Z"/><path class="cap-sheen" d="M18 13 Q13 15 13 24 L13 72 M20 12 L79 12 Q85 13 86 23"/><path class="cap-foot" d="M18 88 L44 104 Q50 108 56 104 L83 88"/></svg></button>
        <button class="pad-left" data-key="left" aria-label="Move left" aria-pressed="false"><svg viewBox="0 0 100 116" aria-hidden="true" focusable="false"><path class="cap-edge" d="M17 4 Q3 5 3 21 L3 75 Q3 88 14 94 L43 111 Q50 115 57 111 L86 94 Q97 88 97 75 L97 21 Q97 5 83 4 Z"/><path class="cap-face" d="M19 10 Q11 11 11 23 L11 73 Q11 81 19 86 L46 101 Q50 104 54 101 L81 86 Q89 81 89 73 L89 23 Q89 11 81 10 Z"/><path class="cap-sheen" d="M18 13 Q13 15 13 24 L13 72 M20 12 L79 12 Q85 13 86 23"/><path class="cap-foot" d="M18 88 L44 104 Q50 108 56 104 L83 88"/></svg></button>
        <span class="pad-center" aria-hidden="true"></span>
      </div>`;

  function mount(host, options = {}) {
    const root = document.createElement('j747-pocket-surface');
    root.hidden = true;
    root.style.cssText = 'position:absolute;inset:0;z-index:0;overflow:hidden;pointer-events:none';
    const shadow = root.attachShadow({mode:'open'});
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = stylesheet;
    shadow.append(link);

    const shell = document.createElement('div');
    shell.className = 'safe';
    shell.innerHTML = `
      <section class="device deck" aria-label="747 Pocket handheld">
        <div class="shell-body" aria-hidden="true"></div>
        <div class="shoulders">
          <button type="button" class="shoulder shoulder-l" data-key="l"><span>L</span><small></small></button>
          <button type="button" class="shoulder shoulder-r" data-key="r"><small></small><span>R</span></button>
        </div>
        <div class="cartridge-slot">
          <div class="cartridge"><div class="cart-label"><img alt="" hidden><strong></strong></div>
          <button class="eject" type="button" data-command="eject" aria-label="Eject cartridge and return to shelf" title="Eject cartridge"><span aria-hidden="true">⏏</span></button></div>
        </div>
        <div class="bezel">
          <div class="bezel-head">
            <span class="led-group" aria-hidden="true"><i class="led power"></i><b>PWR</b></span>
            <span class="bezel-title">JERM747 ARCADE</span>
            <button class="guide-button" type="button" data-command="help" aria-label="Pocket controls guide" title="Controller guide">?</button>
          </div>
          <div class="screen" aria-hidden="true"></div>
        </div>
        <div class="wordmark" aria-hidden="true"><b>747 <i>Pocket</i></b></div>
        <div class="direction-control">${padMarkup}</div>
        <div class="faces">
          ${faces.map(([key,position,color])=>`<button type="button" class="face face-${position}" data-key="${key}" style="--c:${color}"><span class="button-face"><span class="face-letter">${key.toUpperCase()}</span><span class="action-name"></span></span></button>`).join('')}
        </div>
        <div class="system-row">
          <button class="system-btn" type="button" data-key="select"><i></i><span>SELECT</span></button>
          <button class="system-btn" type="button" data-command="menu" aria-label="Start: open game HUD"><i></i><span>START</span></button>
          <button class="system-btn" type="button" data-command="screen" aria-label="Switch to full game view"><i></i><span>SCREEN</span></button>
        </div>
        <div class="grille" aria-hidden="true"></div>
      </section>
      <dialog class="guide" aria-label="747 Pocket controls">
        <h2>747 Pocket controls</h2><p></p><dl></dl><button type="button" data-command="close-guide">Back to game</button>
      </dialog>`;
    shadow.append(shell);
    host.append(root);

    const $ = selector => shell.querySelector(selector);
    const device = $('.device'), pad = $('.dpad'), guide = $('.guide');
    const buttonMap = new Map([...shell.querySelectorAll('[data-key]')].map(b => [b.dataset.key, b]));
    const buttonRims = [...shell.querySelectorAll('[data-directions]')];
    const owners = new Map(), pulseTimers = new Set();
    let held = new Set(), active = false, destroyed = false, latestSize = '';
    let labels = {}, hint = '', cartridge = {title: '', cover: '', id: ''};
    let restorePosition = null, guideOpen = false;

    function reconcile(source, keys = []) {
      const nextKeys = keys.filter(key => !buttonMap.get(key)?.disabled);
      if (nextKeys.length) owners.set(source,nextKeys);
      else owners.delete(source);
      const next = new Set([...owners.values()].flat());
      const old = held;
      held = next;
      for (const key of old) if (!next.has(key)) options.onInput?.(key, false);
      for (const key of next) if (!old.has(key)) options.onInput?.(key, true);
      for (const [key,button] of buttonMap) {
        button.classList.toggle('held', next.has(key));
        button.setAttribute('aria-pressed', String(next.has(key)));
      }
      for (const rim of buttonRims) {
        rim.classList.toggle('lit',rim.dataset.directions.split(' ').every(key=>next.has(key)));
      }
    }
    function releaseInput() {
      for (const t of pulseTimers) clearTimeout(t);
      pulseTimers.clear();
      owners.clear();
      reconcile(null);
    }
    function closeGuide() {
      if (!guideOpen) return;
      guideOpen = false;
      if (guide.open) guide.close();
      options.onGuideChange?.(false);
      if (active) $('.guide-button').focus({preventScroll:true});
    }
    function release() { releaseInput(); closeGuide(); }
    function mayInput() { return active && !guideOpen && !document.hidden; }

    function padKeys(event) {
      const rect = pad.getBoundingClientRect();
      const dx = event.clientX - rect.left - rect.width/2, dy = event.clientY - rect.top - rect.height/2;
      const radius = rect.width/2;
      if (!radius || Math.hypot(dx,dy) < .18*radius || Math.hypot(dx,dy) > 1.12*radius) return [];
      return sectors[(Math.round(Math.atan2(-dy,dx)/(Math.PI/4)) + 8) % 8];
    }
    const dragging = new Set();
    shell.addEventListener('pointerdown', event => {
      if (!mayInput() || (event.pointerType === 'mouse' && event.button !== 0)) return;
      const onPad = event.target.closest('.dpad');
      const button = event.target.closest('[data-key]');
      if (!onPad && (!button || button.disabled)) return;
      const owner = onPad || button;
      event.preventDefault();
      try { owner.setPointerCapture(event.pointerId); } catch {}
      if (onPad) dragging.add(event.pointerId);
      reconcile('pointer:' + event.pointerId, onPad ? padKeys(event) : [button.dataset.key]);
    });
    pad.addEventListener('pointermove', event => {
      if (!dragging.has(event.pointerId)) return;
      event.preventDefault();
      reconcile('pointer:' + event.pointerId, mayInput() ? padKeys(event) : []);
    });
    function lift(event) {
      dragging.delete(event.pointerId);
      if (owners.has('pointer:' + event.pointerId)) reconcile('pointer:' + event.pointerId);
    }
    shadow.addEventListener('lostpointercapture', lift, true);
    window.addEventListener('pointerup', lift, true);
    window.addEventListener('pointercancel', lift, true);
    // Include real keyboard use and assistive activation of the hardware.
    for (const type of ['keydown','keyup']) {
      shell.addEventListener(type, event => {
        const button = event.target.closest('[data-key]');
        if (!button || button.disabled || !mayInput() || ![' ','Enter'].includes(event.key)) return;
        event.preventDefault(); event.stopPropagation();
        reconcile('keyboard:'+event.key, type === 'keydown' ? [button.dataset.key] : []);
      });
    }
    shell.addEventListener('focusout', event => {
      if (!event.target.closest('[data-key]')) return;
      reconcile('keyboard: '); reconcile('keyboard:Enter');
    });
    shell.addEventListener('contextmenu', event => event.preventDefault());
    function updateGuide() {
      $('.guide p').textContent = hint;
      $('.guide p').hidden = !hint;
      const rows = [['D-pad', labels.dpad || 'Eight-way direction pad']];
      for (const key of ['a','b','x','y','l','r','select']) {
        if (!buttonMap.get(key).disabled) rows.push([key.toUpperCase(), labels[key] || key.toUpperCase()]);
      }
      rows.push(['START','Open game HUD'], ['SCREEN','Return to full game view'], ['⏏','Eject cartridge to shelf']);
      const dl = $('.guide dl');
      dl.replaceChildren();
      for (const [key,value] of rows) {
        const term=document.createElement('dt'), desc=document.createElement('dd');
        term.textContent=key; desc.textContent=value; dl.append(term,desc);
      }
    }
    shell.addEventListener('click', event => {
      const b = event.target.closest('button');
      if (!b || b.disabled || !active) return;
      if (b.dataset.command) {
        if (b.dataset.command === 'close-guide') { closeGuide();return; }
        if (guideOpen) return;
        releaseInput(); dragging.clear();
        if (b.dataset.command === 'menu') options.onMenu?.();
        if (b.dataset.command === 'eject') options.onEject?.();
        if (b.dataset.command === 'screen') options.onExit?.();
        if (b.dataset.command === 'help') {
          updateGuide();
          guideOpen=true;
          guide.showModal();
          options.onGuideChange?.(true);
        }
        return;
      }
      if (event.detail === 0 && mayInput() && b.dataset.key) {
        const source=Symbol('assist');
        reconcile(source,[b.dataset.key]);
        const t=setTimeout(()=>{pulseTimers.delete(t);reconcile(source);},110);
        pulseTimers.add(t);
      }
    });
    guide.addEventListener('cancel', event=>{event.preventDefault(); closeGuide();});
    guide.addEventListener('keydown', event=>{
      if (event.key === 'Escape') { event.stopPropagation();event.preventDefault();closeGuide(); }
    });
    guide.addEventListener('close', closeGuide);
    function setLabels(next = {}) {
      releaseInput(); dragging.clear();
      labels = {...next};
      for (const [key,b] of buttonMap) {
        const dir = sectors.some(s=>s.length===1 && s[0]===key);
        const label = String(labels[key] || '').trim();
        b.disabled = !dir && !label;
        b.setAttribute('aria-label', label ? key.toUpperCase()+' — '+label : key.toUpperCase());
        b.title = label || key.toUpperCase();
        const caption=b.querySelector('.action-name, small');
        if (caption) caption.textContent = label;
        const letter=b.querySelector('.face-letter');
        if (letter) letter.classList.toggle('solo',!label);
      }
      updateGuide();
    }
    function setProfile(profile = {}) { hint=profile?.hint||'';setLabels(profile?.labels || {}); }
    function setCartridge(next = {}) {
      const title=String(next?.title||'');
      const cover=String(next?.cover||'');
      const img=$('.cart-label img');
      if (cover !== cartridge.cover) {
        img.hidden=true; img.removeAttribute('src');
        if (cover) {
          try {
            const url=new URL(cover,document.baseURI);
            if (url.origin===location.origin || url.protocol==='file:' && location.protocol==='file:') img.src=url.href;
          } catch {}
        }
      }
      cartridge={title,cover,id:String(next?.id||'')};
      $('.cart-label strong').textContent=title || '747 Pocket';
      $('.cart-label').title=title;
      $('.eject').setAttribute('aria-label',title?'Eject '+title+' and return to shelf':'Eject cartridge and return to shelf');
    }
    $('.cart-label img').addEventListener('load', e=>{e.target.hidden=false});
    $('.cart-label img').addEventListener('error', e=>{e.target.hidden=true});
    function setBox(el, x, y, w, h) {
      Object.assign(el.style,{left:x+'px',top:y+'px',width:w+'px',height:h+'px'});
    }
    function measure() {
      if (!active || destroyed) return;
      const width=shell.clientWidth, height=shell.clientHeight;
      if (!width || !height) return;
      const wide=width>height;
      const u=wide ? Math.min(width/202,height/92,6) : Math.min(width/100,height/150);
      const sw=wide ? Math.min(width-86*u,(height-16*u)*4/3) : 90*u, sh=sw*3/4;
      const dw=wide ? sw+86*u : 100*u, dh=wide ? sh+16*u : 150*u;
      const sx=wide ? 43*u : 5*u, sy=wide ? 13*u : 16*u;
      device.style.setProperty('--cart-lift',wide ? '0px' : Math.max(0,Math.min(14*u,(height-dh)/2-3*u))+'px');
      const x=shell.offsetLeft+(width-dw)/2+sx, y=shell.offsetTop+(height-dh)/2+sy;
      const signature=[x,y,sw,sh,wide].join(',');
      if (signature===latestSize) return;
      latestSize=signature;
      device.classList.toggle('wide',wide);
      Object.assign(device.style,{width:dw+'px',height:dh+'px',fontSize:u+'px'});
      setBox($('.bezel'),sx-2*u,sy-5*u,sw+4*u,sh+7*u);
      setBox($('.screen'),2*u,5*u,sw,sh);
      setBox($('.direction-control'),wide?3*u:6*u,wide?dh/2-16*u:98*u,36*u,36*u);
      setBox($('.faces'),wide?dw-41*u:52*u,wide?dh/2-23*u:95*u,40*u,40*u);
      setBox($('.wordmark'),wide?2*u:7*u,wide?dh/2+23*u:86*u,wide?39*u:84*u,6*u);
      setBox($('.system-row'),wide?dw-42*u:15*u,wide?dh/2+22*u:137*u,wide?40*u:65*u,9*u);
      const cssNames=['x','y','w','h'];
      [x,y,sw,sh].forEach((n,i)=>host.style.setProperty('--pocket-screen-'+cssNames[i],n+'px'));
      options.onResize?.({x,y,width:sw,height:sh,layout:wide?'wide':'tall'});
    }
    const observer=window.ResizeObserver ? new ResizeObserver(measure) : null;
    observer?.observe(host);observer?.observe(shell);
    link.addEventListener('load',measure);
    window.addEventListener('resize',measure);
    function reset() {dragging.clear();release();}
    function visible(){if (document.hidden) reset();}
    window.addEventListener('blur',reset);
    window.addEventListener('pagehide',reset);
    document.addEventListener('visibilitychange',visible);
    function setActive(enabled) {
      if (destroyed) return;
      enabled=Boolean(enabled);
      if (enabled===active) {if(enabled)measure();return;}
      active=enabled;
      if (enabled && getComputedStyle(host).position==='static') {
        restorePosition=host.style.position; host.style.position='relative';
      }
      root.hidden=!active;
      host.classList.toggle('j747-pocket-active',active);
      latestSize='';
      if (active) measure();
      else {
        reset();
        for (const key of ['x','y','w','h'])host.style.removeProperty('--pocket-screen-'+key);
        if (restorePosition!==null) {host.style.position=restorePosition;restorePosition=null;}
      }
    }
    setLabels(Object.fromEntries(actions.map(k=>[k,k.toUpperCase()])));
    setCartridge();
    return {
      setActive,setLabels,setProfile,setCartridge,release:reset,
      destroy() {
        if(destroyed)return;
        setActive(false);destroyed=true;reset();observer?.disconnect();
        window.removeEventListener('pointerup',lift,true);window.removeEventListener('pointercancel',lift,true);
        window.removeEventListener('resize',measure);window.removeEventListener('blur',reset);
        window.removeEventListener('pagehide',reset);document.removeEventListener('visibilitychange',visible);
        root.remove();
      }
    };
  }
  window.Jerm747Pocket = {mount};
})();

/* 747 Pocket controls. Attach only inside the currently playing, same-origin game. */
(() => {
  'use strict';
  const blank = {a:'',b:'',x:'',y:'',l:'',r:'',select:''};
  const direction = {up:12,down:13,left:14,right:15};
  const arrow = {up:'ArrowUp',down:'ArrowDown',left:'ArrowLeft',right:'ArrowRight'};
  const standard = {a:0,b:1,x:2,y:3,l:4,r:5,select:8,...direction};
  const aliases = {'gs-fighter-iii':'gs-fighter-3',flight:'flight-control-deck','get-down':'groove-squad-get-down'};
  const profile = (mode, labels, hint, buttons={}) => ({mode,labels:{...blank,...labels},hint,buttons:{...standard,...buttons}});
  const fight = profile('pad',{a:'Jump',b:'Kick',x:'Punch',y:'V-wave',l:'Guard',r:'High',select:'Music'},
    'D-pad moves and ducks. Hold R for high strikes. Custom game bindings still apply.');
  const climb = profile('pad',{a:'Jump / OK'},'D-pad moves. A selects a story or jumps on the mountain.');
  const focusProfile = profile('focus',{a:'Use',b:'Back'},'Move between controls with the D-pad. Press A to use the focused control, or touch the screen.');
  const profiles = {
    'encore':profile('pad',{a:'Jump',b:'Flip',x:'Fire',y:'Talk',l:'Speed',r:'Flip',select:'Light'},
      'Hold L to run. Combine Jump and Flip for the game’s special moves. A confirms menus.',{x:7,y:6,r:2,select:11}),
    'cd-man':profile('pad',{a:'Jump',b:'Lift',x:'Throw',y:'Run lock',l:'Speed',r:'Speed'},
      'D-pad moves. Lift a nearby item and press again to throw. Hold L to run.'),
    'big-bowl-smash':profile('pad',{a:'Hurdle',b:'Dive',x:'Speed',y:'Stiff arm',l:'Speed',r:'Dive',select:'Sound'},
      'D-pad moves. Hold a direction when diving; hold X for speed. A confirms menu choices.'),
    'tic-tac-steel':profile('pad',{a:'Mark',b:'Back',y:'Options'},
      'D-pad chooses a square or an Ultimate board. A confirms. Y opens game options.'),
    'sumi-sudoku':profile('pad',{a:'Write',b:'Erase',x:'Notes',y:'Options',l:'Digit −',r:'Digit +'},
      'D-pad chooses a cell. L and R choose 1–9, A writes, and X toggles notes.'),
    'flight-control-deck':profile('pad',{a:'Center',b:'Shield',x:'Fire',y:'Warp',l:'Boost',r:'Brake',select:'View'},
      'D-pad steers. A launches from the mission screen. Use the touch display to aim or change flight settings.',{x:7,select:10}),
    'cyborg-coliseum':profile('pad',{a:'Jump',b:'Kick',x:'Punch',y:'Arc lance',l:'Ascend',r:'Descend',select:'Fire'},
      'D-pad moves. Hold Select for chest fire; drag the view to look around.',{l:10,r:11,select:7}),
    'catalog-clash':climb,
    'gs-fighter-3':profile('pad',{a:'Mid kick',b:'High kick',x:'Mid punch',y:'High punch',l:'Guard',r:'V-wave',select:'Jump'},
      'D-pad moves; A confirms menus. Touch fighter select for the opponent. Custom game bindings still apply.',{l:5,r:7,select:10}),
    'gs-fighter-2':fight, 'groove-squad-get-down':fight,
    'word-search':profile('word',{a:'Mark',b:'Clear',x:'Hint',y:'Pause',l:'Help',r:'Zoom',select:'Puzzle'},
      'D-pad moves the letter cursor. A marks each end of a word. Diagonals and finger tracing both work.'),
    'plugin-twist':profile('plugin',{a:'Swap / left',b:'Right',x:'Mode',y:'Hint',l:'Corner',select:'Help'},
      'D-pad chooses a token. A swaps a pair or twists left, B twists right. X changes mode.'),
    'album-match':profile('album',{a:'Swap ↓',b:'Swap →',x:'Swap ←',y:'Swap ↑'},
      'D-pad moves the tile cursor. Use the four face buttons to swap in that direction; A confirms on result screens.'),
    'beat-room':profile('pad',{a:'Use / play',b:'Sections',x:'− / clear',y:'+ / set',l:'Previous',r:'Next',select:'Pad mode'},
      'L/R choose a section, A enters, B goes back. D-pad moves. In a section L/R browse controls or pages. Select plays your mapped pads.'),
    'controller-check':profile('focus',{a:'Use',b:'Back'},'The checker reads the connected physical controller. D-pad and A navigate test options.'),
  };
  const defaultProfile = focusProfile;
  function gameProfile(id, doc) {
    if (id === 'catalog-clash' && doc?.location.pathname.endsWith('catalog-clash-level10.html')) return fight;
    return profiles[aliases[id] || id] || defaultProfile;
  }
  const controlsSelector = 'button:not([disabled]),summary,select:not([disabled]),input:not([disabled]):not([type="hidden"]),a[href]';
  function usable(element) {
    return element && !element.closest('[hidden],[inert],details:not([open]) > :not(summary)') && element.getClientRects().length;
  }
  function focus(element) {
    element?.focus({preventScroll:true});
    element?.scrollIntoView?.({block:'nearest',inline:'nearest'});
  }
  function moveControl(scope, action) {
    const items = [...scope.querySelectorAll(controlsSelector)].filter(usable);
    if (!items.length) return;
    const current = scope.ownerDocument.activeElement, index = items.indexOf(current);
    const step = action === 'up' || action === 'left' ? -1 : 1;
    if (index >= 0 && ['left','right'].includes(action)) {
      if (current.tagName === 'SELECT') {
        const options = [...current.options].filter(o => !o.disabled);
        const i = options.indexOf(current.selectedOptions[0]);
        if (options.length) {
          current.value = options[(i+step+options.length)%options.length].value;
          current.dispatchEvent(new current.ownerDocument.defaultView.Event('change',{bubbles:true}));
        }
        return;
      }
      if (current.type === 'range') {
        step > 0 ? current.stepUp() : current.stepDown();
        current.dispatchEvent(new current.ownerDocument.defaultView.Event('input',{bubbles:true}));return;
      }
    }
    if (action in arrow) focus(items[index < 0 ? 0 : (index + step + items.length) % items.length]);
    else if (action === 'a') {
      const el = index < 0 ? items[0] : current;
      focus(el);
      if (el.tagName !== 'SELECT') el.click();
    } else if (action === 'b') {
      if (scope.matches('dialog[open]')) {
        const ev = new scope.ownerDocument.defaultView.Event('cancel',{cancelable:true});
        if (scope.dispatchEvent(ev)) scope.close();
      } else {
        const back = items.find(el => /^(back|resume|cancel|close)\b/i.test((el.getAttribute('aria-label') || el.textContent).trim()));
        back?.click();
      }
    }
  }
  function keyTap(el, key) {
    if (!el) return;
    const W = el.ownerDocument.defaultView;
    for (const type of ['keydown','keyup']) {
      const ev = new W.KeyboardEvent(type,{key,code:key,bubbles:true,cancelable:true});
      // This Escape belongs to the word grid. The cabinet's Escape binding checks defaultPrevented.
      if (key==='Escape') ev.preventDefault();
      el.dispatchEvent(ev);
    }
  }
  function click(doc, selector) { const el=doc.querySelector(selector); if (el && !el.disabled) el.click(); }
  function puzzleInput(doc, mode, action) {
    const dialog = Array.from(doc.querySelectorAll('dialog[open]')).pop();
    const menu = dialog || (mode==='album' && doc.querySelector('.match-settings,.am-result'));
    if (menu) { moveControl(menu,action);return; }
    if (mode==='focus') { moveControl(doc.body,action);return; }
    if (mode==='word') {
      const cell = doc.activeElement?.matches('#grid .cell') ? doc.activeElement : (doc.querySelector('#grid .cell[tabindex="0"]') || doc.querySelector('#grid .cell'));
      if (action in arrow || action==='a' || action==='b') {
        if (!cell || doc.body.classList.contains('word-paused')) return;
        focus(cell);keyTap(cell,arrow[action] || (action==='a'?'Enter':'Escape'));
        doc.activeElement?.scrollIntoView?.({block:'nearest',inline:'nearest'});
      } else {
        const target={x:'#hint',y:'#pause-game',l:'#help-button',r:doc.body.classList.contains('puzzle-focus')?'#exit-focus':'#zoom',select:'#new'}[action];
        if (target) click(doc,target);
      }
      return;
    }
    if (mode==='plugin') {
      if (action in arrow) {keyTap(doc.querySelector('#board .anchor') || doc.body,arrow[action]);return}
      const target={a:'#left',b:'#right',x:doc.querySelector('#pair')?.getAttribute('aria-pressed')==='true'?'#trio':'#pair',y:'#hint',l:'#corner',select:'#help'}[action];
      if (target) click(doc,target);
      return;
    }
    if (mode==='album') {
      const tile=doc.querySelector('.match-tile.is-cursor') || doc.querySelector('.match-tile');
      if (!tile) return;
      if (action in arrow) {focus(tile);keyTap(tile,arrow[action]);return}
      const dir={a:'down',b:'right',x:'left',y:'up'}[action];
      if (dir) click(doc,'button[aria-label="Swap '+dir+'"]');
    }
  }
  function create({getFrame,getGameId}) {
    let active=false, game='', guest=null, reader=null, nextRepeat=null;
    const held = new Map(), pending = new Map(), touched = new Set();
    function releaseAll() {
      held.clear();touched.clear();
      for(const t of pending.values()) clearTimeout(t);
      pending.clear();clearTimeout(nextRepeat);nextRepeat=null;
    }
    function detach() {
      if (!reader) return;
      const {nav, wrapper, prior} = reader;
      if (nav.getGamepads === wrapper) {
        try { if (prior) Object.defineProperty(nav,'getGamepads',prior);else delete nav.getGamepads; } catch {}
      }
      reader=null;
    }
    function install(w) {
      const nav=w.navigator;
      if (reader?.nav===nav && nav.getGamepads===reader.wrapper) return;
      detach();
      const prior=Object.getOwnPropertyDescriptor(nav,'getGamepads');
      const native=typeof nav.getGamepads==='function' ? nav.getGamepads.bind(nav) : ()=>[];
      function wrapper() {
        let pads;try{pads=Array.from(native()||[])}catch{pads=[]}
        if (!active) return pads;
        const slot=Math.max(0,pads.findIndex(p=>p && p.connected!==false));
        const real=pads[slot];
        if (real && !held.size) return pads;
        const pressedSlots=new Set(Array.from(held.values(), binding=>binding.index));
        const buttons=Array.from({length:Math.max(17,real?.buttons?.length || 0)},(_,i)=>{
          const pressed=pressedSlots.has(i);
          return pressed ? {pressed:true,touched:true,value:1} : real?.buttons?.[i] || {pressed:false,touched:false,value:0};
        });
        const axes=Array.from({length:Math.max(4,real?.axes?.length || 0)},(_,i)=>real?.axes?.[i] || 0);
        if (held.has('left')||held.has('right')) axes[0]=Number(held.has('right'))-Number(held.has('left'));
        if (held.has('up')||held.has('down')) axes[1]=Number(held.has('down'))-Number(held.has('up'));
        pads[slot]={id:real?.id || '747 Pocket',index:real?.index ?? slot,connected:true,mapping:real?.mapping || 'standard',
          timestamp:w.performance.now(),buttons,axes,vibrationActuator:real?.vibrationActuator,hapticActuators:real?.hapticActuators || []};
        return pads;
      }
      try {Object.defineProperty(nav,'getGamepads',{configurable:true,value:wrapper});reader={nav,prior,wrapper};} catch {}
    }
    function sync() {
      const id=getGameId() || '';
      let current=null;
      if (active) {try {current=getFrame()?.contentDocument || null;} catch {}}
      if (current!==guest || game!==id) {releaseAll();detach();guest=current;game=id;}
      if (guest && gameProfile(game,guest).mode==='pad') install(guest.defaultView);
    }
    function getProfile() {
      let doc;try {doc=getFrame()?.contentDocument;}catch{}
      const {labels,hint}=gameProfile(getGameId() || '',doc);
      return {labels:{...labels},hint};
    }
    function input(action,down) {
      if (!active || !(action in standard)) return;
      sync();if (!guest) return;
      if (!down) {
        touched.delete(action);
        if (action in arrow) {clearTimeout(nextRepeat);nextRepeat=null;}
        const bind=held.get(action);
        if (bind) {
          // A short tap must survive at least one normal gamepad polling frame.
          const delay=Math.max(0,65-(performance.now()-bind.at));
          clearTimeout(pending.get(action));
          if (delay) pending.set(action,setTimeout(()=>{held.delete(action);pending.delete(action)},delay));
          else held.delete(action);
        }
        return;
      }
      if (touched.has(action)) return;
      touched.add(action);
      const p=gameProfile(game,guest);
      if (!(action in arrow) && !p.labels[action]) return;
      if (p.mode==='pad') {
        // Cyborg's title starts only on hardware Start; the Pocket Start button is the visor.
        const start=game==='cyborg-coliseum' && action==='a' && guest.querySelector('#start');
        if (start && usable(start)) {start.click();return}
        clearTimeout(pending.get(action));pending.delete(action);
        held.set(action,{at:performance.now(), index:p.buttons[action]});
      } else {
        puzzleInput(guest,p.mode,action);
        if (action in arrow) {
          clearTimeout(nextRepeat);
          const repeat=()=>{if (!active || !touched.has(action))return;sync();if(!guest||!touched.has(action))return;
            puzzleInput(guest,p.mode,action);nextRepeat=setTimeout(repeat,135);};
          nextRepeat=setTimeout(repeat,400);
        }
      }
    }
    return {activate(){active=true;sync()},deactivate(){active=false;releaseAll();detach();guest=null;game='';},sync,input,releaseAll,getProfile};
  }
  window.Jerm747PocketInput=Object.freeze({create});
})();

/* Embed 747 Pocket around an existing arcade iframe. The game stays in its document. */
(() => {
  'use strict';
  const layouts = {
    'word-search': [4/3, 560], 'album-match': [4/3, 680], 'plugin-twist': [4/3, 660],
    'sumi-sudoku': [4/3, 720], 'tic-tac-steel': [4/3, 660], 'big-bowl-smash': [4/3, 680],
    'beat-room': [4/3, 760], 'controller-check': [4/3, 660]
  };
  const aliases = {'gs-fighter-iii':'gs-fighter-3','get-down':'groove-squad-get-down','flight':'flight-control-deck'};
  const storageKey = id => 'jerm747.pocket.view.v1.' + (aliases[id] || id);
  // Hide duplicate touch decks only when the game has a mapped replacement.
  // Menus, board cells, camera regions, and additional on-screen actions stay interactive.
  const guestStyles = {
    // The board stays touchable. Give the grid most of the aperture and let
    // the word bank and the original toolbar scroll independently.
    'word-search':`
      .app {min-height:0!important;height:100dvh;padding:5px!important;gap:4px!important;}
      .app>header {padding:3px 8px;gap:4px;flex-wrap:nowrap;}
      .app>header h1 {font-size:19px;margin:0}
      .app>header .eyebrow,.app>header .small,.app>progress,.board-panel .bottom,.words-panel>p {display:none}
      .app .stats {font-size:14px;gap:8px;white-space:nowrap;}
      .toolbar {flex-wrap:nowrap;overflow-x:auto;flex-shrink:0;min-height:26px;gap:3px;}
      .toolbar button {white-space:nowrap;font-size:12px;padding:3px 6px;}
      .content {min-height:0!important;grid-template-columns:minmax(0,2.2fr) minmax(0,1fr)!important;grid-template-rows:1fr!important;gap:4px;}
      .board-panel {padding:3px!important;gap:3px;}
      .status {min-height:14px;line-height:1.15;font-size:12px;margin:0;}
      .word-list {grid-template-columns:1fr!important;gap:4px;overflow:auto;}
      .word-list li {font-size:clamp(13px,2.7vw,17px);line-height:1.15;white-space:normal;}
      .words-panel h2 {font-size:16px;margin:5px 8px;}
      .cell:focus-visible {outline:2px solid #ffe6a5;outline-offset:-2px;}
      .puzzle-focus .content {grid-template-columns:1fr!important;}
      .puzzle-focus .words-panel {display:none}
    `,
    'encore':'#game .deck {display:none!important}',
    'cd-man':'#game .deck {display:none!important}',
    'big-bowl-smash':'.controls.deck {display:none!important}',
    'catalog-clash':'.climb-deck {display:none!important}'
  };
  function create(host, options) {
    let frame = null, gameId = '', guest = null, active = false, held = false, guideOpen = false, aperture = null;
    const remembered = new Map();
    const input = window.Jerm747PocketInput.create({getFrame:()=>frame, getGameId:()=>gameId});
    const shell = window.Jerm747Pocket.mount(host, {
      onInput(action, down) {
        if (active && !held && !guideOpen && !document.hidden) input.input(action, down);
      },
      onMenu: () => { if (active && !held) options.onMenu(); },
      onEject: () => { if (active && !held) options.onEject(); },
      onGuideChange(open) {
        guideOpen = !!open;
        if (open) input.releaseAll();
        options.onGuideChange?.(guideOpen,frame);
      },
      onExit: () => { if (active && !held) setActive(false); },
      onResize(rect) { aperture = rect; sizeFrame(); }
    });
    function sizeFrame() {
      if (!active || !frame || !aperture?.width || !aperture.height) return;
      const {x,y,width,height} = aperture;
      const [ratio,minWidth] = layouts[gameId] || [16/9,800];
      const fittedWidth = Math.min(width, height * ratio);
      const logicalWidth = Math.max(minWidth, Math.ceil(fittedWidth));
      const logicalHeight = logicalWidth / ratio;
      const scale = fittedWidth / logicalWidth;
      const style = frame.style;
      style.setProperty('--pocket-left', (x+(width-fittedWidth)/2)+'px');
      style.setProperty('--pocket-top', (y+(height-logicalHeight*scale)/2)+'px');
      style.setProperty('--pocket-width', logicalWidth+'px');
      style.setProperty('--pocket-height', logicalHeight+'px');
      style.setProperty('--pocket-scale', String(scale));
    }
    function restoreGuest() {
      if (guest) guest.remove();
      guest = null;
    }
    function restoreFrame() {
      restoreGuest();
      if (!frame) return;
      frame.classList.remove('j747-pocket-viewport');
      for (const prop of ['left','top','width','height','scale']) frame.style.removeProperty('--pocket-'+prop);
    }
    function sync() {
      if (!active || !frame) return;
      let doc;
      try { doc = frame.contentDocument; } catch { /* The shell also supports touch-only embeds. */ }
      if (guest && guest.ownerDocument !== doc) restoreGuest();
      const rules = guestStyles[gameId];
      if (rules && doc?.head && !guest) {
        guest = doc.createElement('style'); guest.textContent = rules; doc.head.append(guest);
      }
      frame.classList.add('j747-pocket-viewport');
      input.sync();
      shell.setProfile(input.getProfile());
      sizeFrame();
    }
    function setActive(on, save=true) {
      on = !!on && !!frame;
      if (save && gameId) {
        remembered.set(gameId,on);
        try {localStorage.setItem(storageKey(gameId),on?'on':'off');} catch {}
      }
      if (on !== active) {
        active = on;
        if (on) {
          input.activate();
          shell.setActive(true);
          sync();
        } else {
          shell.release();
          input.deactivate();
          restoreFrame();
          shell.setActive(false);
        }
      } else if (on) sync();
      options.onChange?.(active);
    }
    function setGame(next, id, cartridge) {
      id = aliases[id] || id || '';
      if (next === frame && id === gameId) {sync(); return;}
      setActive(false,false);
      frame = next; gameId = next ? id : ''; held = false;
      if (!frame) return;
      if (cartridge) shell.setCartridge({
        id:gameId, title:cartridge.title || (frame.title || gameId),
        cover:cartridge.cover ? new URL(cartridge.cover,location.href).href : ''
      });
      let prefer = remembered.get(gameId);
      if (prefer === undefined) {
        try {prefer = localStorage.getItem(storageKey(gameId)) === 'on';} catch {}
      }
      setActive(prefer,false);
    }
    function setHeld(on) {
      held = !!on;
      if (!active) return;
      if (held) {shell.release(); input.releaseAll();} else sync();
    }
    const blur = () => { if (active) {shell.release(); input.releaseAll();} };
    const visibility = () => { if (document.hidden) blur(); };
    window.addEventListener('blur',blur);
    document.addEventListener('visibilitychange',visibility);
    return {
      get active(){return active;}, get guideOpen(){return guideOpen;}, closeGuide(){if(!guideOpen)return false;shell.release();return true;}, setGame, setActive, setHeld, sync,
      toggle(){if(frame)setActive(!active);},
      destroy(){setGame(null,'');shell.destroy();window.removeEventListener('blur',blur);document.removeEventListener('visibilitychange',visibility);}
    };
  }
  window.Jerm747PocketHost = {create};
})();
