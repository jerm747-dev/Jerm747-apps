// Only the arcade host can supply games or retain a live document.
const openGames = byId('open-games'), preserve = byId('preserve-games');
function renderSessions() {
  const available = Array.isArray(menuSpec.catalog);
  openGames.hidden = !available || panel !== 'main';
  preserve.hidden = !available || !(panel === 'main' && context === 'cabinet' || panel === 'sessions');
  byId('sessions-panel').hidden = panel !== 'sessions' && panel !== 'library';
  if (!available) return;
  const store = parent.ArcadeSessions;
  preserve.setAttribute('aria-checked', String(store.enabled));
  preserve.querySelector('.pref-value').textContent = store.enabled ? 'On' : 'Off';
  if (byId('sessions-panel').hidden) return;
  const browse = panel === 'library', holder = byId('session-rows');
  byId('hud-heading').textContent = browse ? 'Game launcher' : 'Open games';
  byId('browse-games').hidden = browse;
  byId('session-note').textContent = browse ? 'Choose a game to open.' :
    (store.enabled ? 'Sessions stay in memory while this arcade is open.' : 'Turn on Preserve game state to keep a game when switching.');
  holder.replaceChildren();
  const paused = new Set(store.ids());
  const games = menuSpec.catalog.filter(game => browse || paused.has(game.id) || game.id === menuSpec.active);
  if (!games.length) {
    const empty = document.createElement('p');empty.textContent = 'No open games';holder.append(empty);
  }
  for (const game of games) {
    const row = document.createElement('div');row.className = 'session-row';
    const kept = paused.has(game.id), active = game.id === menuSpec.active;
    const button = byId('primary-action').cloneNode(true);
    button.removeAttribute('id');button.hidden = false;
    button.dataset.game = game.id;
    button.querySelector('.glass-button__label span').textContent = game.title;
    const state = document.createElement('small');state.textContent = active ? (menuSpec.canHold===false?'Restarts on exit':'Current') : kept ? 'Paused' : 'Open';button.append(state);
    button.onclick = () => closeMenu(context,'command','launch:'+game.id);
    row.append(button);
    if (kept && !browse) {
      const close = byId('tools-back').cloneNode(true);close.removeAttribute('id');
      close.querySelector('.icon')?.remove();close.querySelector('span').textContent = 'Close';close.hidden = false;
      close.className = 'hud-tool session-close';close.setAttribute('aria-label','Close '+game.title);
      close.onclick = () => {store.close(game.id);renderSessions();byId('browse-games').focus();};row.append(close);
    }
    holder.append(row);
  }
}
openGames.onclick = () => showPanel('sessions','browse-games');
byId('browse-games').onclick = () => {showPanel('library');byId('session-rows').querySelector('button')?.focus();};
preserve.onclick = () => {parent.ArcadeSessions.enabled = !parent.ArcadeSessions.enabled;renderSessions();};
