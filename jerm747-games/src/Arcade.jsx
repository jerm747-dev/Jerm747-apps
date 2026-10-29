import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useGamepad, buzz, toggleFullscreen, setDisplayOrientation, HOLD_TO_EXIT_MS, BTN } from './input.js';
import PadIcon from './PadIcon.jsx';
import Cabinet from './Cabinet.jsx';
import './cabinet.css';

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

export default function Arcade() {
  const [projects, setProjects] = useState(null);
  const [error, setError] = useState('');
  const [cat, setCat] = useState('all');
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(null);
  const [source, setSource] = useState('keyboard');
  const admin = useMemo(isAdmin, []);
  const tileRefs = useRef([]);
  const pushed = useRef(false);
  const [copied, setCopied] = useState('');

  useEffect(() => {
    track('view');
    fetch('/api/games.php')
      .then((r) => r.json())
      .then((d) => { if (!d.ok) throw new Error(d.error); setProjects(d.projects); })
      .catch(() => setError("The game list didn't load. Refresh to try again."));
  }, []);

  // Shareable links: jerm747.games/#/play/<folder> opens that game directly.
  const slugFromHash = () => (window.location.hash.match(/^#\/play\/([A-Za-z0-9._-]+)/) || [])[1] || '';
  useEffect(() => {
    if (!projects) return;
    const sync = () => {
      const slug = slugFromHash();
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

  const launch = useCallback((p) => {
    if (!p) return;
    track('launch', p.slug);
    buzz(40, 0.4);
    setPlaying(p);
    window.history.pushState(null, '', `#/play/${p.slug}`);
    pushed.current = true;
  }, []);

  const moveCat = (dir) => {
    const i = cats.indexOf(cat);
    const next = cats[(i + dir + cats.length) % cats.length];
    setCat(next);
    setIndex(0);
    buzz();
  };

  const onAction = (action, from) => {
    setSource(from);
    if (action === 'left') { setIndex((i) => Math.max(0, i - 1)); buzz(); }
    if (action === 'right') { setIndex((i) => Math.min(shown.length - 1, i + 1)); buzz(); }
    if (action === 'up' || action === 'lb') moveCat(-1);
    if (action === 'down' || action === 'rb') moveCat(1);
    if (action === 'a') launch(current);
    if (action === 'y') toggleFullscreen();
  };

  const pads = useGamepad({ mode: playing ? 'off' : 'menu', onAction });

  useEffect(() => {
    if (pads.length) setSource('gamepad');
  }, [pads.length]);

  useEffect(() => {
    if (playing) return;
    const onKey = (e) => {
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

  if (playing) return <Cabinet project={playing}><Player project={playing} source={source} onExit={exitGame} /></Cabinet>;

  return (
    <Cabinet>
    <div className="sb">
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

      <main className="sb-main">
        {error && <p className="sb-empty">{error}</p>}
        {!projects && !error && <p className="sb-empty">Loading games…</p>}
        {projects && shown.length === 0 && (
          <p className="sb-empty">New games are on the way. Check back soon.</p>
        )}

        {current && (
          <section className="sb-detail" key={current.slug}>
            <div className="sb-hero"><Art project={current} big /></div>
            <div className="sb-info">
              <p className="sb-chips">
                <span className="chip" style={{ '--c': KIND_COLOR[current.kind] }}>{KIND_LABEL[current.kind].replace(/s$/, '')}</span>
                <span className={`chip chip-status status-${current.status}`}>{STATUS_LABEL[current.status]}</span>
                {current.version && <span className="chip chip-ghost">{current.version}</span>}
              </p>
              <h1>{current.title}</h1>
              {current.tagline && <p className="sb-tagline">{current.tagline}</p>}
              {current.description && <p className="sb-desc">{current.description}</p>}
              {current.controls.length > 0 && (
                <p className="sb-controls">Plays with {current.controls.map((c) => CONTROL_LABEL[c]).join(', ').replace(/, ([^,]*)$/, ' or $1')}</p>
              )}
              <div className="sb-actions">
                <button className="sb-launch" onClick={() => launch(current)}>
                  {source !== 'touch' && <Glyph name="A" source={source} />} Open {current.title}
                </button>
                <button className="sb-btn" onClick={() => copyLink(current)}>{copied === current.slug ? 'Link copied' : 'Copy link'}</button>
                <a className="sb-btn" href={current.url} target="_blank" rel="noopener">Open in new tab</a>
              </div>
              {current.credit && <p className="sb-credit">{current.credit}</p>}
            </div>
          </section>
        )}

        <div className="sb-shelf" role="listbox" aria-label="Games">
          {shown.map((p, i) => (
            <button
              key={p.slug}
              ref={(el) => { tileRefs.current[i] = el; }}
              data-tile
              role="option"
              aria-selected={i === index}
              className={`tile ${i === index ? 'is-on' : ''}`}
              onClick={() => { if (i === index) launch(p); else setIndex(i); }}
              onFocus={() => setIndex(i)}
            >
              <Art project={p} />
              <span className="tile-title">{p.title}</span>
              <span className="tile-meta">{STATUS_LABEL[p.status]}</span>
            </button>
          ))}
          {admin && (
            <div className="tile tile-add">
              <span className="tile-title">Add a project</span>
              <span className="tile-meta">Upload a folder with an index.html to projects/. A project.json and a 1280×720 cover.jpg are optional; see README.txt in that folder.</span>
            </div>
          )}
        </div>
      </main>

      <footer className="sb-foot">
        <Hints source={source} />
        <span className="sb-note">Games and game designs by Jerm747. Music at <a href="https://jerm747.com">jerm747.com</a>. Need a game or app built? <a href="https://jerm747.dev">jerm747.dev</a></span>
      </footer>
    </div>
    </Cabinet>
  );
}

function Player({ project, source, onExit }) {
  const frame = useRef(null);
  const [hold, setHold] = useState(0);
  const [showMap, setShowMap] = useState(false);
  const [displayMode, setDisplayMode] = useState('auto');
  const [displayNotice, setDisplayNotice] = useState('');
  const bridge = project.gamepad || {};
  const hasBridge = Object.keys(bridge).length > 0;

  useGamepad({ mode: 'player', onExitProgress: setHold, onExit });

  // Hold Esc to return, from the arcade page or from inside the game.
  useEffect(() => {
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
  }, [onExit]);

  // Controller bridge: presses keys inside keyboard-only projects.
  useEffect(() => {
    if (!hasBridge) return;
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
  }, [project.slug]);

  return (
    <div className="player">
      <iframe
        ref={frame}
        src={project.url}
        title={project.title}
        allow="gamepad; fullscreen; autoplay; screen-wake-lock"
        allowFullScreen
        onLoad={() => { try { frame.current.contentWindow.focus(); } catch { frame.current?.focus(); } }}
      />
      <div className="player-bar is-on">
        <button className="sb-btn" onClick={onExit}>Back to shelf</button>
        <span className="player-title">{project.title}</span>
        <Hints source={source} inPlayer />
        {hasBridge && <button className="sb-btn" onClick={() => { setShowMap(!showMap); }}>{showMap ? 'Hide controls' : 'Controller map'}</button>}
        <label className="player-orientation">Display <select aria-label="Game orientation" value={displayMode} onChange={async e => {const mode=e.target.value;setDisplayMode(mode);setDisplayNotice(await setDisplayOrientation(mode));}}><option value="auto">Auto</option><option value="portrait">Portrait</option><option value="landscape">Landscape</option></select></label>
        <button className="sb-btn" onClick={async()=>{const entering=!document.fullscreenElement;await toggleFullscreen();if(entering&&displayMode!=='auto')setDisplayNotice(await setDisplayOrientation(displayMode));}}>Fullscreen</button>
      </div>
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
