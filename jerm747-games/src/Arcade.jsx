import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useGamepad, buzz, toggleFullscreen, setDisplayOrientation, HOLD_TO_EXIT_MS, BTN } from './input.js';
import PadIcon from './PadIcon.jsx';
import Cabinet from './Cabinet.jsx';
import {useVisor,useGameFrame} from './Visor.jsx';
import './arcade-list.css';
import './view-switch.css';
import './cabinet.css';

const NEW_TITLES = new Set(['big-bowl-smash', 'tic-tac-steel', 'sumi-sudoku']);
function NewBadge({slug}) { return NEW_TITLES.has(slug) ? <span className="game-new">NEW</span> : null; }

const KIND_LABEL = { game: 'Games', app: 'Apps', site: 'Sites', tool: 'Tools', music: 'Music', experiment: 'Experiments' };
const KIND_COLOR = { game: '#A897C9', app: '#86B0A5', site: '#8DA4C4', tool: '#C2AE7E', music: '#C4909B', experiment: '#9A9FA8' };
const STATUS_LABEL = { prototype: 'Prototype', in_progress: 'Work in progress', playable: 'Playable', stable: 'Stable', client: 'Client project' };
const CONTROL_LABEL = { gamepad: 'Controller', keyboard: 'Keyboard', mouse: 'Mouse', touch: 'Touch' };
const BRIDGE_INDEX = { A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, LT: 6, RT: 7, SELECT: 8, START: 9, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15 };

function track(type, project) {
  try {
    if (localStorage.getItem('j747-nocount') === '1') return;
    const body = JSON.stringify({ type, path: '/', ref: document.referrer, project });
    navigator.sendBeacon?.('/api/track.php', new Blob([body], { type: 'application/json' })) ||
      fetch('/api/track.php', { method: 'POST', body, headers: { 'Content-Type': 'application/json' }, keepalive: true });
  } catch { /* offline */ }
}

function isAdmin() {
  try { return !!sessionStorage.getItem('j747-admin'); } catch { return false; }
}

function keyCode(key) {
  if (key === ' ') return 'Space';
  if (/^[a-z]$/i.test(key)) return 'Key' + key.toUpperCase();
  if (/^[0-9]$/.test(key)) return 'Digit' + key;
  if (key === 'Shift') return 'ShiftLeft';
  if (key === 'Control') return 'ControlLeft';
  return key;
}

function Glyph({ name, source }) {
  if (source === 'gamepad') return <span className={`glyph glyph-pad glyph-${name}`}>{name}</span>;
  const keys = { A: 'Enter', B: 'Esc', Y: 'F', LB: 'Q', RB: 'E' };
  return <span className="glyph glyph-key">{keys[name] || name}</span>;
}

function Hints({ source, inPlayer }) {
  if (source === 'touch') return null;
  if (inPlayer) {
    return (
      <div className="hints">
        {source === 'gamepad'
          ? <span><Glyph name="Select" source="gamepad" /> + <Glyph name="Start" source="gamepad" /> hold to return</span>
          : <span><span className="glyph glyph-key">Esc</span> hold to return</span>}
      </div>
    );
  }
  return (
    <div className="hints" aria-hidden="true">
      <span><Glyph name="A" source={source} /> Open</span>
      <span><Glyph name="Y" source={source} /> Fullscreen</span>
      <span><Glyph name="LB" source={source} /><Glyph name="RB" source={source} /> Category</span>
    </div>
  );
}

function Art({ project, big }) {
  const color = project.accent || KIND_COLOR[project.kind];
  // Any cover shape fits: full art in front, a blurred copy fills the rest of the frame.
  if (project.cover) {
    return (
      <div className="art-cover">
        <img className="art-backdrop" src={project.cover} alt="" aria-hidden="true" loading="lazy" />
        <img className="art-img" src={project.cover} alt={`${project.title} cover art`} loading="lazy" />
      </div>
    );
  }
  const initials = project.title.split(/\s+/).map((w) => w[0]).join('').slice(0, 3).toUpperCase();
  return (
    <div className={`art-gen ${big ? 'art-big' : ''}`} style={{ '--c': color }}>
      <span>{initials}</span>
    </div>
  );
}

// Screenshot strip on a game's page; tapping one opens a full-size viewer (←/→, swipe, Esc to close).
function Gallery({ shots, title }) {
  const [open, setOpen] = useState(-1);
  const dlg = useRef(null);
  const touchX = useRef(null);
  useEffect(() => {
    const d = dlg.current;
    if (!d) return;
    if (open >= 0 && !d.open) d.showModal();
    if (open < 0 && d.open) d.close();
    document.body.dataset.viewer = open >= 0 ? '1' : '';
  }, [open]);
  useEffect(() => () => { document.body.dataset.viewer = ''; }, []);
  if (!shots?.length) return null;
  const step = (n) => setOpen((i) => (i + n + shots.length) % shots.length);
  const onKey = (e) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); step(1); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
  };
  const shot = shots[Math.max(0, open)];
  return (
    <div className="sb-shots">
      <p className="sb-shots-label">Screenshots</p>
      <div className="sb-shots-row">
        {shots.map((s, i) => (
          <button key={s.src} type="button" className="sb-shot" onClick={() => setOpen(i)} aria-label={`View screenshot ${i + 1}: ${s.caption || title}`}>
            <img src={s.thumb || s.src} alt="" loading="lazy" width="480" height="270" />
          </button>
        ))}
      </div>
      <dialog ref={dlg} className="sb-viewer" onClose={() => setOpen(-1)} onKeyDown={onKey}
        onClick={(e) => { if (e.target === e.currentTarget) setOpen(-1); }}
        onTouchStart={(e) => { touchX.current = e.touches[0].clientX; }}
        onTouchEnd={(e) => { const dx = e.changedTouches[0].clientX - (touchX.current ?? e.changedTouches[0].clientX); if (Math.abs(dx) > 40) step(dx < 0 ? 1 : -1); touchX.current = null; }}>
        {open >= 0 && (
          <figure>
            <img src={shot.src} alt={shot.caption || `${title} screenshot`} />
            <figcaption><span>{shot.caption}</span><span>{open + 1} / {shots.length}</span></figcaption>
          </figure>
        )}
        <button type="button" className="sb-viewer-btn sb-viewer-prev" onClick={() => step(-1)} aria-label="Previous screenshot">‹</button>
        <button type="button" className="sb-viewer-btn sb-viewer-next" onClick={() => step(1)} aria-label="Next screenshot">›</button>
        <button type="button" className="sb-viewer-btn sb-viewer-close" onClick={() => setOpen(-1)} aria-label="Close">×</button>
      </dialog>
    </div>
  );
}

export default function Arcade() {
  const [projects, setProjects] = useState(null);
  const [error, setError] = useState('');
  const [cat, setCat] = useState('all');
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(null);
  const [visorOpen,setVisorOpen]=useState(false);
  const [view,setView]=useState(()=>localStorage.getItem('j747.web.arcadeView')==='list'?'list':'cabinet');
  const live=useRef(null),cases=useRef(null),swipe=useRef(null);
  const changeView=next=>{localStorage.setItem('j747.web.arcadeView',next);setView(next);};
  useEffect(()=>{if(view==='list'&&cases.current)cases.current.scrollTop=Number(sessionStorage.getItem('j747.caseList.scroll'))||0;},[view,projects]);
  const [source, setSource] = useState('keyboard');
  const admin = useMemo(isAdmin, []);
  const tileRefs = useRef([]);
  const pushed = useRef(false);
  const playFullscreen = useRef(false);
  const [copied, setCopied] = useState('');

  useEffect(() => {
    track('view');
    fetch('/api/games.php')
      .then((r) => r.json())
      .then((d) => { if (!d.ok) throw new Error(d.error); setProjects([...d.projects].sort((a,b)=>Number(a.slug==='controller-check')-Number(b.slug==='controller-check'))); })
      .catch(() => setError("The game list didn't load. Refresh to try again."));
  }, []);

  // Shareable links: jerm747.games/#/play/<folder> opens that game directly.
  const slugFromHash = () => (window.location.hash.match(/^#\/play\/([A-Za-z0-9._-]+)/) || [])[1] || '';
  useEffect(() => {
    if (!projects) return;
    const sync = () => {
      let slug = slugFromHash();
      if(slug==='fighter-lab'){slug='cyborg-coliseum';history.replaceState(null,'','#/play/'+slug);}
      const p = slug && projects.find((x) => x.slug === slug);
      if (p) {
        setPlaying((cur) => { if (!cur || cur.slug !== p.slug) track('launch', p.slug); return p; });
        const i = projects.indexOf(p);
        if (i >= 0) { setCat('all'); setIndex(i); }
      } else {
        setPlaying(null);
      }
    };
    sync();
    window.addEventListener('popstate', sync);
    window.addEventListener('hashchange', sync);
    return () => { window.removeEventListener('popstate', sync); window.removeEventListener('hashchange', sync); };
  }, [projects]);

  const exitGame = useCallback(() => {
    if (playFullscreen.current && document.fullscreenElement) document.exitFullscreen().catch(() => {});
    playFullscreen.current = false;
    setPlaying(null);
    if (slugFromHash()) {
      if (pushed.current) { pushed.current = false; window.history.back(); }
      else window.history.replaceState(null, '', window.location.pathname);
    }
  }, []);

  const copyLink = async (p) => {
    const url = `${window.location.origin}/#/play/${p.slug}`;
    try { await navigator.clipboard.writeText(url); setCopied(p.slug); setTimeout(() => setCopied(''), 2000); }
    catch { window.prompt('Copy this link', url); }
  };

  const cats = useMemo(() => {
    const kinds = [...new Set((projects || []).map((p) => p.kind))];
    return ['all', ...Object.keys(KIND_LABEL).filter((k) => kinds.includes(k))];
  }, [projects]);

  const shown = useMemo(() => (projects || []).filter((p) => cat === 'all' || p.kind === cat), [projects, cat]);
  const current = shown[Math.min(index, shown.length - 1)];

  useEffect(() => {
    const tile = tileRefs.current[index];
    const shelf = tile?.parentElement;
    if (tile && shelf) shelf.scrollTo({ left: tile.offsetLeft - shelf.offsetLeft - (shelf.clientWidth - tile.clientWidth) / 2, behavior: 'smooth' });
  }, [index, cat]);

  // Swipeable details: one full-width page per game in the current section. Swiping picks the game;
  // picking a game any other way (tiles, arrows, keys, controller) slides the pages to it.
  const slides = useRef(null);
  const pointerTile = useRef(-1); // first tap on a tile selects it, a second tap opens it
  const indexRef = useRef(index);
  const settle = useRef(0);
  const lastCat = useRef(cat);
  indexRef.current = index;
  const stride = (el) => (el.children[1] ? el.children[1].offsetLeft - el.children[0].offsetLeft : el.clientWidth) || el.clientWidth;
  useEffect(() => {
    const el = slides.current;
    if (!el || !el.clientWidth) return;
    const target = Math.min(index, shown.length - 1) * stride(el);
    const jump = lastCat.current !== cat;
    lastCat.current = cat;
    if (Math.abs(el.scrollLeft - target) > 2) el.scrollTo({ left: target, behavior: jump ? 'auto' : 'smooth' });
  }, [index, cat, shown.length,view]);
  useEffect(() => {
    const el = slides.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => { el.scrollTo({ left: indexRef.current * stride(el), behavior: 'auto' }); });
    ro.observe(el);
    return () => ro.disconnect();
  }, [projects, playing,view]);
  const onSlidesScroll = () => {
    clearTimeout(settle.current);
    settle.current = setTimeout(() => {
      const el = slides.current;
      if (!el || !el.clientWidth) return;
      const i = Math.max(0, Math.min(shown.length - 1, Math.round(el.scrollLeft / stride(el))));
      if (i !== indexRef.current) { setIndex(i); buzz(); }
    }, 90);
  };

  const launch = useCallback((p) => {
    if (!p) return;
    if (!document.fullscreenElement && navigator.userActivation?.isActive && document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().then(() => { playFullscreen.current = true; }).catch(() => {});
    }
    track('launch', p.slug);
    buzz(40, 0.4);
    setPlaying(p);
    if(slugFromHash())window.history.replaceState(null,'',`#/play/${p.slug}`);
    else window.history.pushState(null, '', `#/play/${p.slug}`);
    pushed.current = true;
  }, []);

  const hud=useVisor({projects,playing,launch,onExit:exitGame,live,onVisibility:setVisorOpen});
  const moveCat = (dir) => {
    const i = cats.indexOf(cat);
    const next = cats[(i + dir + cats.length) % cats.length];
    setCat(next);
    setIndex(0);
    buzz();
  };

  const onAction = (action, from) => {
    if(hud.current?.isOpen){
      if(from==='gamepad'){if(action==='start')hud.current.back();else {const k=({a:'accept',b:'cancel',up:'prev',left:'prev',down:'next',right:'next'})[action];if(k)hud.current.input(k);}}
      return;
    }
    if(action==='start'){hud.current?.open();return;}
    if (playing || document.body.dataset.viewer) return; // screenshot viewer handles its own keys
    setSource(from);
    if (action === 'left') { setIndex((i) => Math.max(0, i - 1)); buzz(); }
    if (action === 'right') { setIndex((i) => Math.min(shown.length - 1, i + 1)); buzz(); }
    if(view==='list'&&(action==='up'||action==='down')){
      const n=Math.max(0,Math.min(shown.length-1,index+(action==='down'?1:-1)));
      setIndex(n);cases.current?.children[n]?.focus();return;
    }
    if (action === 'up' || action === 'lb') moveCat(-1);
    if (action === 'down' || action === 'rb') moveCat(1);
    if (action === 'a') launch(current);
    if (action === 'y') toggleFullscreen();
  };

  const pads = useGamepad({ mode: 'menu', onAction });

  useEffect(() => {
    if (pads.length) setSource('gamepad');
  }, [pads.length]);

  useEffect(() => {
    if (playing) return;
    const onKey = (e) => {
      if(hud.current?.isOpen || e.target.closest?.('.view-switch'))return;
      const map = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down', Enter: 'a', ' ': 'a', f: 'y', F: 'y', q: 'lb', Q: 'lb', e: 'rb', E: 'rb' };
      const action = map[e.key];
      if (!action) return;
      if (action === 'a' && e.target.closest?.('button, a') && e.target.dataset.tile === undefined) return;
      e.preventDefault();
      onAction(action, 'keyboard');
    };
    const onTouch = () => setSource('touch');
    window.addEventListener('keydown', onKey);
    window.addEventListener('touchstart', onTouch, { passive: true });
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('touchstart', onTouch); };
  });

  

  return (
    <Cabinet project={playing}>
    <Player project={playing} source={source} onExit={exitGame} live={live} visorOpen={visorOpen} openHUD={()=>hud.current?.open()} />
    <div className="sb" hidden={!!playing}>
      <header className="sb-top">
        <a className="sb-brand" href="/">
          <PadIcon />
          <span>jerm747<b>.games</b></span>
          <span className="sb-sub">Choose your game</span>
        </a>
        <div className="sb-status">
          <span className={`sb-input ${pads.length ? 'is-live' : ''}`}>
            {pads.length ? `Controller: ${pads[0].id.replace(/\(.*?\)/g, '').trim().slice(0, 32) || 'connected'}` : 'No controller, press any button to connect'}
          </span>
          <label className="view-switch" data-view={view === 'list' ? 'list' : 'grid'}>
            <span className="view-switch-track" aria-hidden="true"><span>List</span><span>Grid</span></span>
            <input type="range" min="0" max="1" step="1" aria-label="Game view"
              value={view === 'list' ? 0 : 1} aria-valuetext={view === 'list' ? 'List' : 'Grid'}
              onChange={e => changeView(e.target.value === '0' ? 'list' : 'cabinet')} />
          </label><button className="web-visor-open" onClick={()=>hud.current?.open()} aria-label="Open cabinet HUD"><img src="/arcade-hud/icons/hud-overlay.svg" alt=""/>HUD</button>
          <button className="sb-btn" onClick={toggleFullscreen}>Fullscreen</button>
        </div>
      </header>

      <nav className="sb-cats" aria-label="Categories">
        {cats.map((c) => (
          <button key={c} className={`sb-cat ${c === cat ? 'is-on' : ''}`} onClick={() => { setCat(c); setIndex(0); }}>
            {c === 'all' ? 'All' : KIND_LABEL[c]}
            <span>{c === 'all' ? projects?.length || 0 : projects.filter((p) => p.kind === c).length}</span>
          </button>
        ))}
      </nav>

      <main className={'sb-main'+(view==='list'?' is-list':'')}>
        {error && <p className="sb-empty">{error}</p>}
        {!projects && !error && <p className="sb-empty">Loading games…</p>}
        {projects && shown.length === 0 && (
          <p className="sb-empty">New games are on the way. Check back soon.</p>
        )}

        {view==='list' && !!shown.length && <div className="sb-cases" ref={cases} aria-label="Game list"
          onScroll={e=>sessionStorage.setItem('j747.caseList.scroll',e.currentTarget.scrollTop)}
          onTouchStart={e=>{swipe.current=e.touches.length===1?[e.touches[0].clientX,e.touches[0].clientY]:null;}}
          onTouchEnd={e=>{if(!swipe.current)return;const [x,y]=swipe.current;swipe.current=null;const dx=e.changedTouches[0].clientX-x;if(Math.abs(dx)>64&&Math.abs(dx)>1.8*Math.abs(e.changedTouches[0].clientY-y)){e.preventDefault();changeView('cabinet');}}}>
          {shown.map((p,i)=><button key={p.slug} className="sb-case" style={{'--case-accent':p.accent||KIND_COLOR[p.kind]}} aria-current={i===index} aria-label={'Open '+p.title+(NEW_TITLES.has(p.slug)?', new game':'')}
            onClick={()=>{setIndex(i);launch(p);}} onFocus={()=>setIndex(i)}>
            {p.cover?<><img className="sb-case-wall" src={p.listCover||p.cover} alt="" loading="lazy"/><img className="sb-case-thumb" src={p.listCover||p.cover} alt="" loading="lazy"/></>:<span className="sb-case-thumb"><Art project={p}/></span>}
            <strong>{p.title}<NewBadge slug={p.slug}/></strong><i aria-hidden="true">›</i></button>)}
        </div>}
        {view==='cabinet' && current && (
          <div className="sb-slider">
          <div className="sb-slides" ref={slides} onScroll={onSlidesScroll} aria-roledescription="carousel" aria-label="Game details · swipe for the next game">
          {shown.map((current, i) => (
          <section className="sb-detail sb-slide" key={current.slug} aria-roledescription="slide" aria-label={`${i + 1} of ${shown.length}: ${current.title}`} aria-hidden={i !== index} inert={i !== index}>
            <div className="sb-hero"><Art project={current} big /></div>
            <div className="sb-info">
              <p className="sb-chips">
                <span className="chip" style={{ '--c': KIND_COLOR[current.kind] }}>{KIND_LABEL[current.kind].replace(/s$/, '')}</span>
                <span className={`chip chip-status status-${current.status}`}>{STATUS_LABEL[current.status]}</span>
                {current.version && <span className="chip chip-ghost">{current.version}</span>}
              </p>
              <h1>{current.title}<NewBadge slug={current.slug}/></h1>
              {current.tagline && <p className="sb-tagline">{current.tagline}</p>}
              {current.description && <p className="sb-desc">{current.description}</p>}
              {current.controls.length > 0 && (
                <p className="sb-controls">Plays with {current.controls.map((c) => CONTROL_LABEL[c]).join(', ').replace(/, ([^,]*)$/, ' or $1')}</p>
              )}
              <div className="sb-actions">
                <button className="sb-launch" onClick={() => launch(current)}>
                  {source !== 'touch' && <Glyph name="A" source={source} />} {current.kind === 'game' ? 'Play game' : 'Open ' + current.title}
                </button>
                <button className="sb-btn" onClick={() => copyLink(current)}>{copied === current.slug ? 'Link copied' : 'Copy link'}</button>
                <a className="sb-btn" href={current.url} target="_blank" rel="noopener">Open in new tab</a>
              </div>
              <Gallery shots={current.screenshots} title={current.title} />
              {current.credit && <p className="sb-credit">{current.credit}</p>}
            </div>
          </section>
          ))}
          </div>
          {shown.length > 1 && (
            <>
              <button className="sb-step sb-step-prev" aria-label="Previous game" disabled={index === 0} onClick={() => { setIndex((i) => Math.max(0, i - 1)); buzz(); }}>‹</button>
              <button className="sb-step sb-step-next" aria-label="Next game" disabled={index === shown.length - 1} onClick={() => { setIndex((i) => Math.min(shown.length - 1, i + 1)); buzz(); }}>›</button>
              <div className="sb-dots" aria-hidden="true">{shown.map((p, i) => <i key={p.slug} className={i === index ? 'is-on' : ''} />)}</div>
            </>
          )}
          </div>
        )}

        {view==='cabinet' && <div className="sb-shelf" role="listbox" aria-label="Games">
          {shown.map((p, i) => (
            <button
              key={p.slug}
              ref={(el) => { tileRefs.current[i] = el; }}
              data-tile
              role="option"
              aria-selected={i === index}
              className={`tile ${i === index ? 'is-on' : ''}`}
              onPointerDown={() => { pointerTile.current = i; }}
              onClick={() => { pointerTile.current = -1; if (i === indexRef.current) launch(p); else { setIndex(i); buzz(); } }}
              onFocus={() => { if (pointerTile.current !== i) setIndex(i); }}
            >
              <Art project={p} />
              <span className="tile-title">{p.title}</span>
              <span className="tile-meta">{STATUS_LABEL[p.status]}<NewBadge slug={p.slug}/></span>
            </button>
          ))}
          {admin && (
            <div className="tile tile-add">
              <span className="tile-title">Add a project</span>
              <span className="tile-meta">Upload a folder with an index.html to projects/. A project.json and a 1280×720 cover.jpg are optional; see README.txt in that folder.</span>
            </div>
          )}
        </div>}
      </main>

      <footer className="sb-foot">
        <Hints source={source} />
        <span className="sb-note"><a href="/download/">Android downloads</a> · Games and game designs by Jerm747. Music at <a href="https://jerm747.com">jerm747.com</a>. Need a game or app built? <a href="https://jerm747.dev">jerm747.dev</a></span>
      </footer>
    </div>
    </Cabinet>
  );
}

function Player({ project, source, onExit, live:frame, visorOpen, openHUD }) {
  const stack=useRef(null);
  useGameFrame(project,stack,frame);
  const [hold, setHold] = useState(0);
  const [showMap, setShowMap] = useState(false);
  const [displayMode, setDisplayMode] = useState('auto');
  const [displayNotice, setDisplayNotice] = useState('');
  const bridge = project?.gamepad || {};
  const hasBridge = Object.keys(bridge).length > 0;

  useGamepad({ mode: project&&!visorOpen?'player':'off', onExitProgress: setHold, onExit });

  // Hold Esc to return, from the arcade page or from inside the game.
  useEffect(() => {
    if (!project||visorOpen)return;
    let start = 0;
    let raf = 0;
    const loop = (now) => {
      if (!start) return;
      const p = Math.min(1, (now - start) / HOLD_TO_EXIT_MS);
      setHold(p);
      if (p >= 1) { start = 0; setHold(0); onExit(); return; }
      raf = requestAnimationFrame(loop);
    };
    const down = (e) => { if (e.key === 'Escape' && !e.repeat && !start) { start = performance.now(); raf = requestAnimationFrame(loop); } };
    const up = (e) => { if (e.key === 'Escape') { start = 0; cancelAnimationFrame(raf); setHold(0); } };
    const targets = [window];
    const attach = () => {
      try {
        const w = frame.current?.contentWindow;
        if (w && !targets.includes(w)) { targets.push(w); w.addEventListener('keydown', down, true); w.addEventListener('keyup', up, true); }
      } catch { /* other origin */ }
    };
    window.addEventListener('keydown', down, true);
    window.addEventListener('keyup', up, true);
    const iframe = frame.current;
    iframe?.addEventListener('load', attach);
    attach();
    return () => {
      cancelAnimationFrame(raf);
      targets.forEach((t) => { try { t.removeEventListener('keydown', down, true); t.removeEventListener('keyup', up, true); } catch { /* gone */ } });
      iframe?.removeEventListener('load', attach);
    };
  }, [onExit,project?.slug,visorOpen]);

  // A game's own Close / Exit button can hand control back to the shelf (Get Down sends jerm747-catalog-close).
  useEffect(() => {
    const onMessage = (e) => {
      if (e.origin !== location.origin || e.source !== frame.current?.contentWindow) return;
      const type = e.data && e.data.type;
      if (['arcade-return','jerm747-catalog-close','jerm747-games-exit','jerm747-arcade-close','jerm747-close-game'].includes(type)) onExit();
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [onExit,project?.slug,visorOpen]);

  // Controller bridge: presses keys inside keyboard-only projects.
  useEffect(() => {
    if (!hasBridge||visorOpen) return;
    let raf = 0;
    const down = new Set();
    const send = (type, key) => {
      try {
        const doc = frame.current?.contentDocument;
        const W = frame.current?.contentWindow;
        if (!doc || !W) return;
        const ev = new W.KeyboardEvent(type, { key, code: keyCode(key), bubbles: true, cancelable: true });
        (doc.activeElement || doc.body || doc).dispatchEvent(ev);
      } catch { /* not ready */ }
    };
    const loop = () => {
      let pad = null;
      try { pad = Array.from(navigator.getGamepads?.() || []).find(Boolean); } catch { /* none */ }
      if (pad) {
        const combo = pad.buttons[BTN.SELECT]?.pressed && pad.buttons[BTN.START]?.pressed;
        for (const [btn, key] of Object.entries(bridge)) {
          const b = pad.buttons[BRIDGE_INDEX[btn]];
          const pressed = !combo && !!b && (b.pressed || b.value > 0.5);
          if (pressed && !down.has(btn)) { down.add(btn); send('keydown', key); }
          else if (!pressed && down.has(btn)) { down.delete(btn); send('keyup', key); }
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); down.forEach((btn) => send('keyup', bridge[btn])); };
  }, [project?.slug,visorOpen]);

  return (
    <div className="player" hidden={!project}>
      <div className="game-stack" ref={stack} />
      <details className="play-tools" key={project?.slug}><summary aria-label="Game controls">☰</summary><div className="player-bar is-on">
        <button className="sb-btn" onClick={onExit}>Back to shelf</button><button className="sb-btn" onClick={openHUD}>HUD</button>
        <span className="player-title">{project?.title}</span>
        <Hints source={source} inPlayer />
        {hasBridge && <button className="sb-btn" onClick={() => { setShowMap(!showMap); }}>{showMap ? 'Hide controls' : 'Controller map'}</button>}
        <label className="player-orientation">Display <select aria-label="Game orientation" value={displayMode} onChange={async e => {const mode=e.target.value;setDisplayMode(mode);setDisplayNotice(await setDisplayOrientation(mode));}}><option value="auto">Auto</option><option value="portrait">Portrait</option><option value="landscape">Landscape</option></select></label>
        <button className="sb-btn" onClick={async()=>{const entering=!document.fullscreenElement;await toggleFullscreen();if(entering&&displayMode!=='auto')setDisplayNotice(await setDisplayOrientation(displayMode));}}>Fullscreen</button>
      </div></details>
      {displayNotice && <p className="display-notice" role="status"><span>{displayNotice}</span><button onClick={()=>setDisplayNotice('')} aria-label="Dismiss display message">×</button></p>}
      {showMap && (
        <div className="player-map">
          <h2>Controller map</h2>
          <dl>
            {Object.keys(bridge).map((btn) => (
              <div key={btn}><dt><span className={`glyph glyph-pad glyph-${btn}`}>{btn}</span></dt><dd>{project.gamepadLabels?.[btn] || bridge[btn]}</dd></div>
            ))}
          </dl>
        </div>
      )}
      {hold > 0 && (
        <div className="hold" role="status" aria-label="Returning to shelf">
          <svg viewBox="0 0 80 80"><circle cx="40" cy="40" r="34" className="hold-track" /><circle cx="40" cy="40" r="34" className="hold-fill" style={{ strokeDashoffset: 214 * (1 - hold) }} /></svg>
          <span>Shelf</span>
        </div>
      )}
    </div>
  );
}
