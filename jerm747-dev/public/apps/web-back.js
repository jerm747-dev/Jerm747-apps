/* Patch Bay on the web: a small "back to the rack" button on every tool page.
   Inside the Android app (window.RackMidi) the system Back button does this, so nothing is added. */
(() => {
  if (window.RackMidi) return;
  const rack = new URL('./', document.currentScript.src).href;
  const add = () => {
    if (document.querySelector('.pb-back')) return;
    const a = document.createElement('a');
    a.className = 'pb-back';
    a.href = rack;
    a.title = 'Back to Patch Bay';
    a.setAttribute('aria-label', 'Back to Patch Bay');
    a.innerHTML = '<span aria-hidden="true">‹</span>Rack';
    const s = document.createElement('style');
    s.textContent = `.pb-back{position:fixed;z-index:2147483000;left:0;top:38%;display:flex;align-items:center;gap:6px;
      height:46px;width:22px;padding:0 0 0 4px;overflow:hidden;white-space:nowrap;border-radius:0 12px 12px 0;
      font:700 12px/1 system-ui,sans-serif;letter-spacing:.04em;text-decoration:none;color:#0e233d;
      background:linear-gradient(90deg,#d9b46c,#f3dca9);border:1px solid #8e754a;border-left:0;
      box-shadow:0 2px 8px #0008,inset 0 1px #fff8;opacity:.6;transition:width .15s,opacity .15s}
      .pb-back span{font-size:20px;line-height:0;margin-top:-2px}
      .pb-back:hover,.pb-back:focus-visible{width:72px;opacity:1}
      :fullscreen .pb-back,:root:has(:fullscreen) .pb-back{display:none}
      @media print{.pb-back{display:none}}`;
    document.head.append(s);
    document.body.append(a);
  };
  if (document.body) add(); else document.addEventListener('DOMContentLoaded', add);
})();
