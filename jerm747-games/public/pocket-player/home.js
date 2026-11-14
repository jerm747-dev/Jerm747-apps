(() => {
  'use strict';
  const pocket = window.Jerm747Pocket;
  const slugPattern = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
  const device = document.getElementById('hero-device');
  const select = document.getElementById('game-select');
  const finishes = [...document.querySelectorAll('[data-finish]')];
  const cards = [...document.querySelectorAll('[data-game]')];
  let selected = 'ice';

  const launchURL = slug => '/#/play/' + encodeURIComponent(slug) + '?pocket=' + selected;
  function preview(finish) {
    selected = finish === 'classic' ? 'classic' : 'ice';
    device.src = 'handheld-' + selected + '.webp';
    device.alt = (selected === 'ice' ? 'Ice Blue' : 'Classic') + ' 747 Pocket Player showing Wave Run 747';
    for (const button of finishes) button.setAttribute('aria-pressed', String(button.dataset.finish === selected));
    for (const card of cards) card.href = launchURL(card.dataset.game);
  }
  function sync() { preview(pocket?.getFinish()); }
  for (const button of finishes) button.addEventListener('click', () => {
    pocket?.setFinish(button.dataset.finish);
    preview(button.dataset.finish);
  });
  window.addEventListener('pocket-finish-change', sync);
  window.addEventListener('pageshow', sync);
  sync();

  document.getElementById('picker').addEventListener('submit', event => {
    event.preventDefault();
    if (slugPattern.test(select.value)) location.assign(launchURL(select.value));
  });
  async function loadCatalog() {
    try {
      const response = await fetch('/api/games.php', {headers:{Accept:'application/json'}});
      if (!response.ok) throw new Error();
      const data = await response.json();
      if (!data.ok || !Array.isArray(data.projects)) throw new Error();
      const titles = data.projects.filter(item => slugPattern.test(item.slug) && typeof item.title === 'string');
      if (!titles.length) throw new Error();
      const chosen = select.value;
      const fragment = document.createDocumentFragment();
      for (const game of titles) fragment.append(new Option(game.title, game.slug));
      select.replaceChildren(fragment);
      if (titles.some(item => item.slug === chosen)) select.value = chosen;
    } catch {
      const status = document.getElementById('catalog-status');
      status.textContent = 'The full library is unavailable. The three featured cartridges are ready above.';
      status.hidden = false;
    }
  }
  loadCatalog();
})();
