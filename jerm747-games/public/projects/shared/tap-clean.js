/* tap-clean.js · Jerm747 Arcade
   Drop-in fix for the mobile "blue box" flash and other browser defaults that fight touch games.
   Use: add a script tag with src="tap-clean.js" anywhere on the page (head or end of body). No setup.

   What it does
   - Removes the blue/gray tap highlight Android and iOS draw over anything tappable (canvas, buttons, links).
   - Stops text/image selection and the long-press callout (copy / save image) on game surfaces.
   - Blocks the long-press context menu on canvases and images.
   - Stops double-tap zoom and pinch-zoom from hijacking fast taps.
   - Hides the focus ring for touch and mouse taps but KEEPS it for keyboard users (Tab), so the page stays accessible.

   Opt-outs
   - Add class "selectable" to any element whose text people should still be able to select or copy (e.g. a score to share).
   - Set window.TAP_CLEAN = { zoom: true } before loading to leave pinch-zoom alone. */
(function () {
  if (window.__tapClean) return;
  window.__tapClean = true;
  var opts = window.TAP_CLEAN || {};

  var css = [
    '*,*::before,*::after{-webkit-tap-highlight-color:transparent!important}',
    'html,body{-webkit-touch-callout:none;-webkit-user-select:none;user-select:none;-webkit-text-size-adjust:100%;text-size-adjust:100%}',
    'canvas,img,svg,button,[role="button"],[role="grid"]{-webkit-touch-callout:none;-webkit-user-select:none;user-select:none;-webkit-user-drag:none}',
    'canvas,button,[role="button"],[role="grid"]{touch-action:manipulation}',
    'input,textarea,select,[contenteditable],.selectable,.selectable *{-webkit-user-select:text;user-select:text;-webkit-touch-callout:default}',
    ':focus:not(:focus-visible){outline:none!important}',
    '::selection{background:transparent}',
    '.selectable::selection,.selectable *::selection,input::selection,textarea::selection{background:rgba(120,150,255,.35)}'
  ].join('\n');

  function addStyle() {
    var s = document.createElement('style');
    s.id = 'tap-clean';
    s.textContent = css;
    (document.head || document.documentElement).appendChild(s);
  }
  if (document.head) addStyle(); else document.addEventListener('DOMContentLoaded', addStyle);

  var editable = function (el) {
    return el && el.closest && el.closest('input,textarea,select,[contenteditable],.selectable');
  };

  // long-press menu on canvases and images
  document.addEventListener('contextmenu', function (e) {
    var t = e.target;
    if (t && (t.tagName === 'CANVAS' || t.tagName === 'IMG' || (t.closest && t.closest('canvas,[role="grid"]')))) e.preventDefault();
  }, { capture: true });

  // stray selections from rapid taps
  document.addEventListener('selectstart', function (e) { if (!editable(e.target)) e.preventDefault(); }, { capture: true });
  document.addEventListener('dragstart', function (e) {
    var t = e.target;
    if (t && (t.tagName === 'IMG' || t.tagName === 'CANVAS')) e.preventDefault();
  }, { capture: true });

  if (!opts.zoom) {
    // pinch-zoom (iOS Safari ignores user-scalable=no, so catch the gesture events too)
    ['gesturestart', 'gesturechange'].forEach(function (n) {
      document.addEventListener(n, function (e) { e.preventDefault(); }, { passive: false });
    });
    document.addEventListener('touchmove', function (e) { if (e.touches && e.touches.length > 1) e.preventDefault(); }, { passive: false });
    // double-tap zoom is handled by touch-action:manipulation above, which keeps fast repeat taps working
    document.documentElement.style.touchAction = 'manipulation';
  }
})();
