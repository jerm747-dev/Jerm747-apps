const shelf = document.querySelector('#shelf');
const search = document.querySelector('#search');
const root = document.documentElement;
const escapeHtml = value => String(value).replace(/[&<>"']/g, symbol => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
})[symbol]);

function render() {
  const query = search.value.trim().toLowerCase();
  const visible = TOOLS.filter(({name, desc, specs}) =>
    [name, desc, ...specs].join(' ').toLowerCase().includes(query));
  shelf.innerHTML = visible.map(tool => `
    <li class="module" data-icon="${escapeHtml(tool.icon)}">
      <span class="ear left" aria-hidden="true"></span>
      <img class="cover" src="app-covers/${escapeHtml(tool.id)}.webp?v=2" alt="" width="576" height="384">
      <div class="info">
        <h2>${escapeHtml(tool.name)} ${tool.version ? `<small>v${escapeHtml(tool.version)}</small>` : ''}</h2>
        <p>${escapeHtml(tool.desc)}</p>
        <div class="specs">${tool.specs.map(escapeHtml).join(' · ')}</div>
      </div>
      <div class="controls">
        <a class="launch" href="${escapeHtml(tool.href)}" aria-label="Open ${escapeHtml(tool.name)}">Open <span aria-hidden="true">›</span></a>
        ${tool.extra ? `<a class="apk" href="${escapeHtml(tool.extra.href)}">Beat Room APK</a>` : ''}
      </div>
      <span class="ear right" aria-hidden="true"></span>
    </li>`).join('');
  document.querySelector('#empty').hidden = visible.length > 0;
}

function setOption(key, value) {
  root.dataset[key] = value;
  try { localStorage.setItem('patchbay.' + key, value); } catch {}
  document.querySelectorAll(`button[data-${key}]`).forEach(button =>
    button.setAttribute('aria-pressed', String(button.dataset[key] === value)));
}

for (const [key, fallback] of [['finish', 'blue'], ['view', 'list']]) {
  let selection = fallback;
  try { selection = localStorage.getItem('patchbay.' + key) || fallback; } catch {}
  setOption(key, document.querySelector(`button[data-${key}="${CSS.escape(selection)}"]`) ? selection : fallback);
  document.querySelectorAll(`button[data-${key}]`).forEach(button =>
    button.addEventListener('click', () => setOption(key, button.dataset[key])));
}
search.addEventListener('input', render);
// On the web (not inside the Android app) show links back to the Jerm 747 sites.
if (!window.RackMidi) document.querySelector('.web-links')?.removeAttribute('hidden');
render();
