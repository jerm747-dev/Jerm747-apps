(() => {
  'use strict';
  const button = document.querySelector('[data-game-fullscreen]');
  if (!button) return;
  let target = document, android = null;
  try {
    if (parent !== window && parent.location.origin === location.origin) {
      target = parent.document;
      android = parent.EncoreAndroid;
    }
  } catch { /* A cross-origin embed can still use its own fullscreen permission. */ }
  if (android) { button.hidden = true; return; } // The native cabinet already supplies this action.
  function sync() {
    const on = Boolean(target.fullscreenElement || target.webkitFullscreenElement);
    button.setAttribute('aria-pressed', String(on));
    button.setAttribute('aria-label', on ? 'Exit fullscreen' : 'Enter fullscreen');
    button.title = on ? 'Exit fullscreen' : 'Enter fullscreen';
  }
  const root = target.documentElement;
  if (!root.requestFullscreen && !root.webkitRequestFullscreen) { button.hidden = true; return; }
  sync(); target.addEventListener('fullscreenchange',sync); target.addEventListener('webkitfullscreenchange',sync);
  button.onclick = async () => {
    try {
      if (target.fullscreenElement || target.webkitFullscreenElement) await (target.exitFullscreen || target.webkitExitFullscreen).call(target);
      else await (root.requestFullscreen || root.webkitRequestFullscreen).call(root);
    } catch { button.title = 'Fullscreen is unavailable in this window'; }
  };
})();
