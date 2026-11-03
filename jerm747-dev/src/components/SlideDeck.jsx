import { useCallback, useEffect, useRef, useState } from 'react';

// pdf.js is self-hosted in /vendor/pdfjs so the viewer doesn't depend on an outside CDN.
// Loaded only when someone opens the Slides tab.
// The path is a variable on purpose so Vite leaves it alone (files in public/ can't be bundled).
const PDFJS_SRC = '/vendor/pdfjs/pdf.min.js';
const PDFJS_WORKER = '/vendor/pdfjs/pdf.worker.min.js';
let pdfjsPromise = null;
function loadPdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = import(/* @vite-ignore */ PDFJS_SRC).then((lib) => {
      lib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
      return lib;
    });
    pdfjsPromise.catch(() => { pdfjsPromise = null; });
  }
  return pdfjsPromise;
}

const PER_VIEW = [1, 2, 4];

function Slide({ pdf, num }) {
  const canvas = useRef(null);
  const box = useRef(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let task = null;
    let cancelled = false;
    async function draw() {
      try {
        const page = await pdf.getPage(num);
        if (cancelled || !canvas.current || !box.current) return;
        const base = page.getViewport({ scale: 1 });
        const width = box.current.clientWidth || 800;
        const ratio = Math.min(window.devicePixelRatio || 1, 2);
        const viewport = page.getViewport({ scale: (width / base.width) * ratio });
        const c = canvas.current;
        c.width = Math.floor(viewport.width);
        c.height = Math.floor(viewport.height);
        c.style.aspectRatio = `${base.width} / ${base.height}`;
        task = page.render({ canvas: c, canvasContext: c.getContext('2d'), viewport });
        await task.promise;
      } catch (err) {
        if (!cancelled && err?.name !== 'RenderingCancelledException') setFailed(true);
      }
    }
    draw();
    return () => { cancelled = true; task?.cancel(); };
  }, [pdf, num]);

  return (
    <figure className="slide" ref={box}>
      {failed ? <p className="empty">Slide {num} couldn't be drawn.</p> : <canvas ref={canvas} aria-label={`Slide ${num}`} />}
      <figcaption>{num}</figcaption>
    </figure>
  );
}

export default function SlideDeck({ url, name, downloadUrl }) {
  const [pdf, setPdf] = useState(null);
  const [error, setError] = useState('');
  const [perView, setPerView] = useState(1);
  const [start, setStart] = useState(1);
  const stage = useRef(null);

  useEffect(() => {
    let task = null;
    let cancelled = false;
    setPdf(null);
    setError('');
    setStart(1);
    loadPdfjs()
      .then((lib) => { task = lib.getDocument({ url, isEvalSupported: false }); return task.promise; })
      .then((d) => { if (!cancelled) setPdf(d); })
      .catch(() => { if (!cancelled) setError("The slides didn't load. Download the file instead."); });
    // The loading task owns the document and its worker; destroying it frees both.
    return () => { cancelled = true; try { task?.destroy(); } catch { /* already gone */ } };
  }, [url]);

  const total = pdf?.numPages || 0;
  const go = useCallback((dir) => {
    setStart((s) => Math.min(Math.max(1, s + dir * perView), Math.max(1, total - ((total - 1) % perView))));
  }, [perView, total]);

  function changePerView(n) {
    setPerView(n);
    setStart((s) => Math.floor((s - 1) / n) * n + 1); // keep the current slide in view
  }

  function onKey(e) {
    if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') { e.preventDefault(); go(1); }
    if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); go(-1); }
    if (e.key === 'Home') setStart(1);
  }

  function fullscreen() {
    const el = stage.current;
    if (document.fullscreenElement) document.exitFullscreen?.();
    else el?.requestFullscreen?.().then(() => el.focus()).catch(() => {});
  }

  if (error) return <p className="form-error">{error} {downloadUrl && <a href={downloadUrl}>Download {name}</a>}</p>;
  if (!pdf) return <p className="empty">Loading slides…</p>;

  const shown = [];
  for (let n = start; n < start + perView && n <= total; n++) shown.push(n);
  const end = shown[shown.length - 1];

  return (
    <div className="deck">
      <div className="deck-bar">
        <div className="seg" role="group" aria-label="Slides at a time">
          {PER_VIEW.map((n) => (
            <button key={n} className={perView === n ? 'is-on' : ''} aria-pressed={perView === n} onClick={() => changePerView(n)}>
              {n} at a time
            </button>
          ))}
        </div>
        <div className="btn-row">
          {downloadUrl && <a className="deck-dl" href={downloadUrl}>Download</a>}
          <button className="btn btn-ghost" onClick={fullscreen}>Full screen</button>
        </div>
      </div>
      <div className={`deck-stage per-${perView}`} ref={stage} tabIndex={0} onKeyDown={onKey} aria-label={`${name}, slides ${start} to ${end} of ${total}. Use arrow keys to move.`}>
        {shown.map((n) => <Slide key={`${n}-${perView}`} pdf={pdf} num={n} />)}
      </div>
      <div className="deck-nav">
        <button className="btn btn-ghost" onClick={() => go(-1)} disabled={start === 1}>Previous</button>
        <span className="deck-count">{start === end ? `Slide ${start}` : `Slides ${start}–${end}`} of {total}</span>
        <button className="btn btn-primary" onClick={() => go(1)} disabled={end >= total}>Next</button>
      </div>
    </div>
  );
}
