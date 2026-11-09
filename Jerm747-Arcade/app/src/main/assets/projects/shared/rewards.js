const css = new URL('../shared/rewards.css', document.baseURI);
if (!document.querySelector('link[data-arcade-rewards]')) {
  const link = document.createElement('link');
  link.rel = 'stylesheet'; link.href = css; link.dataset.arcadeRewards = '';
  document.head.append(link);
}

export const timeTargets = {15: 600, 30: 1500, 60: 3600};
export function starsFor(seconds, count) {
  const target = timeTargets[count] || Math.max(600, count * 60);
  return seconds <= target ? 3 : seconds <= target * 2 ? 2 : 1;
}
export function formatTime(seconds) {
  const value = Math.max(0, Math.floor(seconds));
  return Math.floor(value / 60) + ':' + String(value % 60).padStart(2, '0');
}

export function celebrate(surface, style = 'words') {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return () => {};
  const layer = document.createElement('div');
  layer.className = 'reward-confetti'; layer.setAttribute('aria-hidden', 'true');
  const colors = style === 'albums' ? ['#f5b8eb','#ae9bff','#ffe8b0','#fff4f0']
    : style === 'plugins' ? ['#7ce3c4','#e0abff','#fbd690','#89d8ff']
    : ['#93f8d6','#ffd37b','#fd95bd','#f6f4ff'];
  for (let i = 0; i < 84; i++) {
    const piece = document.createElement('i');
    const angle = i / 84 * Math.PI * 2;
    const distance = 140 + Math.random() * 360;
    piece.style.setProperty('--burst-x', Math.cos(angle) * distance + 'px');
    piece.style.setProperty('--burst-y', Math.sin(angle) * distance - 80 + 'px');
    piece.style.setProperty('--burst-drop', 220 + Math.random() * 260 + 'px');
    piece.style.setProperty('--spin', (Math.random() * 700 - 350) + 'deg');
    piece.style.background = colors[i % colors.length];
    piece.style.animationDelay = Math.floor(i / 28) * 110 + 'ms';
    if (style === 'plugins') piece.style.borderRadius = '50%';
    if (style === 'albums') { piece.style.width = '12px'; piece.style.height = '12px'; }
    layer.append(piece);
  }
  surface.append(layer);
  const timer = setTimeout(() => layer.remove(), 2900);
  return () => { clearTimeout(timer); layer.remove(); };
}

export function createReward() {
  const dialog = document.createElement('dialog');
  dialog.className = 'arcade-reward';
  dialog.innerHTML = '<div class="reward-card"><p class="reward-kicker"></p><div class="reward-stars" role="img"></div><h2 id="reward-heading"></h2><p class="reward-message"></p><p class="reward-stats"></p><label class="reward-choice">Next theme<select aria-label="Next theme"></select></label><p class="reward-target"></p><div class="reward-actions"><button class="reward-next" type="button"></button><button class="reward-title" type="button">Back to title</button></div></div>';
  dialog.setAttribute('aria-labelledby', 'reward-heading');
  document.body.append(dialog);
  const get = name => dialog.querySelector(name);
  let stop = () => {}, active = null;
  function close() { stop(); dialog.close(); }
  dialog.addEventListener('cancel', event => { event.preventDefault(); get('.reward-title').click(); });
  get('.reward-next').addEventListener('click', () => {
    const action=active?.onNext, value=get('select').value;
    close(); action?.(value);
  });
  get('.reward-title').addEventListener('click', () => { const action=active?.onTitle; close();action?.(); });
  return {
    get open() { return dialog.open; },
    close,
    destroy() { close(); dialog.remove(); },
    show(options) {
      active=options; stop();
      dialog.dataset.style=options.style || 'words';
      get('.reward-kicker').textContent=options.game || 'Round complete';
      get('#reward-heading').textContent=options.title || 'You did it!';
      get('.reward-message').textContent=options.message || '';
      get('.reward-stats').textContent=options.stats || '';
      get('.reward-target').textContent=options.target || '';
      get('.reward-stars').hidden=!options.stars;
      get('.reward-stars').replaceChildren();
      if (options.stars) {
        get('.reward-stars').setAttribute('aria-label', options.stars + ' out of 3 stars');
        for(let i=1;i<=3;i++){const star=document.createElement('span');star.textContent='★';star.className=i<=options.stars?'earned':'empty';star.setAttribute('aria-hidden','true');get('.reward-stars').append(star);}
      }
      get('.reward-choice').hidden=!options.choices?.length;
      get('select').replaceChildren();
      for(const choice of options.choices || []) {
        const opt=document.createElement('option');opt.value=choice.id;opt.textContent=choice.title;get('select').append(opt);
      }
      if(options.nextChoice)get('select').value=options.nextChoice;
      get('.reward-next').textContent=options.nextLabel || 'Play next puzzle';
      if(!dialog.open)dialog.showModal();
      get('.reward-next').focus();
      if(options.animate!==false)stop=celebrate(dialog,options.style);
    }
  };
}
