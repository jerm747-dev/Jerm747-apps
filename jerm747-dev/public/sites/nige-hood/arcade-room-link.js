/* Small homepage enhancement for the distributed Returnity build.
   Kept outside the compiled bundle so it can be reused after a site rebuild. */
(() => {
  'use strict';
  function mount() {
    const panel = document.getElementById('sa-stage');
    if (!panel || panel.querySelector('.arcade-shelf-callout')) return;
    const callout = document.createElement('aside');
    callout.className = 'arcade-shelf-callout';
    callout.setAttribute('aria-label', 'Arcade shelf');
    const copy = document.createElement('div');
    const title = document.createElement('strong');
    title.textContent = 'We’ve got a whole arcade, too.';
    const description = document.createElement('p');
    description.textContent = 'This is the interactive music room. Our virtual cabinet shelf is just one jump away.';
    copy.append(title, description);
    const link = document.createElement('a');
    link.className = 'h-btn primary';
    link.href = 'games/';
    link.textContent = 'Open arcade shelf ↗';
    callout.append(copy, link);
    panel.prepend(callout);
  }
  let queued = false;
  const observer = new MutationObserver(() => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; mount(); });
  });
  observer.observe(document.getElementById('root'), { childList: true, subtree: true });
  mount();
})();
