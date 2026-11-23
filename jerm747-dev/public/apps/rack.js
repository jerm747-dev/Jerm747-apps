const shelf = document.querySelector('#shelf');
const search = document.querySelector('#search');
const root = document.documentElement;
const escapeHtml = value => String(value).replace(/[&<>"']/g, symbol => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
})[symbol]);

function activityLabel(href) {
  const path = new URL(href, location.href).pathname.replace(/\/$/, '/index.html');
  try {
    if (sessionStorage.getItem('patchbay.activity:' + path)) return 'Activity this session';
  } catch {}
  return 'No activity this session';
}

function render() {
  const query = search.value.trim().toLowerCase();
  const visible = TOOLS.filter(({name, desc, specs}) =>
    [name, desc, ...specs].join(' ').toLowerCase().includes(query));
  shelf.innerHTML = visible.map(tool => `
    <li class="module" data-icon="${escapeHtml(tool.icon)}">
      <img class="cover" src="app-covers/${escapeHtml(tool.id)}.webp?v=3" alt="" width="576" height="384">
      <div class="info">
        <h2>${escapeHtml(tool.name)} <span class="activity-light" role="img" aria-label="${activityLabel(tool.href)}" title="${activityLabel(tool.href)}"></span> ${tool.version ? `<small>v${escapeHtml(tool.version)}</small>` : ''}</h2>
        <p>${escapeHtml(tool.desc)}</p>
      </div>
      <div class="controls">
        <a class="launch" href="${escapeHtml(tool.href)}" aria-label="Open ${escapeHtml(tool.name)}">Open <span aria-hidden="true">›</span></a>
        ${tool.extra ? `<a class="apk" href="${escapeHtml(tool.extra.href)}">Beat Room APK</a>` : ''}
      </div>
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
window.addEventListener('pageshow', event => { if (event.persisted) render(); });
render();

const cabinetLight = document.querySelector('.signal');
function refreshCabinetLight() {
  let on = false;
  try { on = sessionStorage.getItem('patchbay.cabinet-light') === '1'; } catch {}
  cabinetLight.setAttribute('aria-pressed', String(on));
}
cabinetLight.addEventListener('click', () => {
  const on = cabinetLight.getAttribute('aria-pressed') !== 'true';
  cabinetLight.setAttribute('aria-pressed', String(on));
  try { sessionStorage.setItem('patchbay.cabinet-light', on ? '1' : '0'); } catch {}
});
window.addEventListener('pageshow', refreshCabinetLight);
refreshCabinetLight();

// On the web (not inside the Android app) show links back to the Jerm 747 sites.
if (!window.RackMidi) document.querySelector(".web-links")?.removeAttribute("hidden");
