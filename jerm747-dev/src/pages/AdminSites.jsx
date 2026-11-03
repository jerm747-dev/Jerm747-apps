import { useEffect, useState } from 'react';
import { listSites, getSite, siteAction } from '../api.js';
import SiteView, { SITE_STATUSES, statusLabel, when } from '../components/SiteView.jsx';

const BLANK = { title: '', new_slug: '', client: '', summary: '', status: 'building', public: false, preview_url: '', project_key: '', notes: '' };

export default function AdminSites({ pw }) {
  const [sites, setSites] = useState([]);
  const [current, setCurrent] = useState(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  async function refresh() {
    try { const { sites } = await listSites(); setSites(sites); setError(''); } catch (e) { setError(e.message); }
  }
  useEffect(() => { refresh(); }, [pw]);

  async function togglePublic(site) {
    try { await siteAction('set_public', { slug: site.slug, public: !site.public }); refresh(); } catch (e) { setError(e.message); }
  }

  async function open(slug) {
    try { const { site } = await getSite(slug); setCurrent(site); } catch (e) { setError(e.message); }
  }

  if (current) {
    return (
      <>
        <button className="link-btn back" onClick={() => { setCurrent(null); refresh(); }}>All sites</button>
        <SiteView site={current} token="" onSite={setCurrent}
          adminPanel={<SiteSettings site={current} onSaved={setCurrent} onDeleted={() => { setCurrent(null); refresh(); }} />} />
      </>
    );
  }

  return (
    <>
      <div className="traffic-head"><button className="btn btn-ghost" onClick={() => setCreating(!creating)}>New site</button></div>
      {error && <p className="form-error" role="alert">{error}</p>}
      {creating && (
        <div className="create">
          <h3>Add a site in development</h3>
          <p>Each site gets a page at jerm747.dev/#/sites/<em>address</em>, and the folder <code>sites/<em>address</em>/</code> is made on the server for its build. The address comes from the site name (Nige Hood becomes nige-hood).</p>
          <SiteForm initial={BLANK} isNew onSaved={(s) => { setCreating(false); setCurrent(s); refresh(); }} />
        </div>
      )}
      {sites.length === 0 ? (
        <p className="empty">No sites yet. Add your first commission with New site.</p>
      ) : (
        <ul className="project-list">
          {sites.map((s) => (
            <li key={s.slug} className="site-li">
              <button onClick={() => open(s.slug)}>
                <span className="pl-title">{s.title}
                  {s.open > 0 && <span className="badge">{s.open} open comment{s.open > 1 ? 's' : ''}</span>}
                </span>
                <span className="pl-meta">Folder sites/{s.folder || s.slug}/{s.has_build ? '' : ' (no index.html yet)'}, {statusLabel(s.status)}{s.client && `, ${s.client}`}, updated {when(s.updated)}</span>
              </button>
              <button className={`pill pill-toggle ${s.public ? 'pill-public' : ''}`} onClick={() => togglePublic(s)}
                aria-pressed={!!s.public} title={s.public ? 'Public: on the Sites page. Click to make private.' : 'Private: review link only. Click to make public.'}>
                {s.public ? 'Public' : 'Private'}
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function SiteForm({ initial, isNew, onSaved }) {
  const [f, setF] = useState(initial);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setErr('');
    const fields = Object.fromEntries(Object.keys(BLANK).map((k) => [k, f[k]]));
    if (!isNew) { fields.slug = f.slug; fields.public = !!initial.public; } // the switch at the top owns this
    try { const { site } = await siteAction('save', fields); onSaved(site); }
    catch (x) { setErr(x.message); } finally { setBusy(false); }
  }

  const autoSlug = f.title.toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);

  return (
    <form onSubmit={submit}>
      <div className="field-row">
        <label className="field"><span>Site name</span><input value={f.title} onChange={set('title')} required /></label>
        {isNew
          ? <label className="field"><span>Web address <em>/sites/…</em></span><input value={f.new_slug} onChange={set('new_slug')} placeholder={autoSlug || 'bellas-bakery'} pattern="[a-z0-9][a-z0-9\-]{0,38}[a-z0-9]?" /></label>
          : <label className="field"><span>Client</span><input value={f.client} onChange={set('client')} /></label>}
      </div>
      {isNew && <label className="field"><span>Client <em>optional</em></span><input value={f.client} onChange={set('client')} /></label>}
      <label className="field"><span>Short description</span><textarea rows="2" value={f.summary} onChange={set('summary')} /></label>
      <div className="field-row">
        <label className="field"><span>Status</span>
          <select value={f.status} onChange={set('status')}>{SITE_STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select>
        </label>
        <label className="field"><span>Linked project key <em>optional</em></span><input value={f.project_key} onChange={set('project_key')} placeholder="J747-XXXX-XXXX" /></label>
      </div>
      <label className="field"><span>Preview address <em>leave blank to use the sites/ folder</em></span>
        <input value={f.preview_url} onChange={set('preview_url')} placeholder="/sites/address/  or  https://…" /></label>
      {isNew && <label className="check"><input type="checkbox" checked={f.public} onChange={set('public')} />
        <span>Show on the public Sites page (anyone can view and comment; only people with the review link can edit the doc and see files)</span></label>}
      <label className="field"><span>Private notes <em>only you see these</em></span><textarea rows="2" value={f.notes} onChange={set('notes')} /></label>
      {err && <p className="form-error">{err}</p>}
      <button className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : isNew ? 'Add site' : 'Save settings'}</button>
    </form>
  );
}

function SiteSettings({ site, onSaved, onDeleted }) {
  const [msg, setMsg] = useState('');
  const link = `${window.location.origin}/#/sites/${site.slug}/${site.token}`;

  async function copy() {
    try { await navigator.clipboard.writeText(link); setMsg('Review link copied.'); } catch { setMsg('Select the link and copy it.'); }
  }
  async function newToken() {
    if (!window.confirm('Make a new review link? The old one stops working right away.')) return;
    try { const { site: next } = await siteAction('new_token', { slug: site.slug }); onSaved(next); setMsg('New review link ready. Send it to the client.'); }
    catch (e) { setMsg(e.message); }
  }
  async function remove() {
    const typed = window.prompt(`This deletes the comments, shared doc and files for ${site.title}. The build folder on the server stays. Type ${site.slug} to confirm.`);
    if (typed !== site.slug) return;
    try { await siteAction('delete', { slug: site.slug, confirm: typed }); onDeleted(); } catch (e) { setMsg(e.message); }
  }

  async function setPublic(on) {
    try { const { site: next } = await siteAction('set_public', { slug: site.slug, public: on }); onSaved(next); setMsg(on ? 'Public: it shows on the Sites page now.' : 'Private: only the review link opens it.'); }
    catch (e) { setMsg(e.message); }
  }
  async function useFolder(folder) {
    try { const { site: next } = await siteAction('set_folder', { slug: site.slug, folder }); onSaved(next); setMsg(`Build folder set to sites/${folder}/.`); }
    catch (e) { setMsg(e.message); }
  }
  async function recheck() {
    try { const { site: next } = await getSite(site.slug); onSaved(next); setMsg('Checked the server again.'); } catch (e) { setMsg(e.message); }
  }

  const folders = site.server_folders || [];
  const others = folders.filter((f) => f.usable && f.name !== site.folder);
  const withBuild = others.filter((f) => f.has_build && !f.used_by);
  const odd = folders.filter((f) => !f.usable);

  return (
    <>
    <div className="site-admin-status">
      <div className="site-status-row">
        <span className="site-status-label">Visibility</span>
        <div className="seg" role="group" aria-label="Visibility">
          <button className={!site.public ? 'is-on' : ''} aria-pressed={!site.public} onClick={() => setPublic(false)}>Private</button>
          <button className={site.public ? 'is-on' : ''} aria-pressed={!!site.public} onClick={() => setPublic(true)}>Public</button>
        </div>
        <span className="composer-note">{site.public
          ? <>On the public <a href="#/sites">Sites</a> page. Anyone can open the preview and comment.</>
          : <>Not listed. Only the review link opens it.</>}</span>
      </div>
      <div className="site-status-row">
        <span className="site-status-label">Build</span>
        <span className={`build-check ${site.has_build ? 'is-ok' : 'is-missing'}`}>
          {site.has_build ? '✓' : '!'} <code>sites/{site.folder}/index.html</code> {site.has_build ? 'found' : 'not found yet'}
        </span>
        {site.has_build && <a className="btn btn-ghost btn-sm" href={site.preview_url} target="_blank" rel="noopener">Open ↗</a>}
        <button className="link-btn" onClick={recheck}>Check again</button>
      </div>
      {!site.has_build && withBuild.length > 0 && (
        <p className="build-hint">Found a build in {withBuild.map((f, i) => (
          <span key={f.name}>{i > 0 && ', '}<code>sites/{f.name}/</code> <button className="btn btn-primary btn-sm" onClick={() => useFolder(f.name)}>Use this folder</button></span>
        ))}</p>
      )}
      {!site.has_build && withBuild.length === 0 && (
        <p className="build-hint">Upload the files so <code>index.html</code> sits directly in <code>sites/{site.folder}/</code> (not in a folder inside it).
          {odd.length > 0 && <> These folders can't be used because of their names (use lowercase letters, numbers and dashes): {odd.map((f) => <code key={f.name}> sites/{f.name}/</code>)}.</>}</p>
      )}
      {others.length > 0 && (
        <details className="build-folders">
          <summary>Use a different folder</summary>
          <ul>{others.map((f) => (
            <li key={f.name}><code>sites/{f.name}/</code> {f.has_build ? <span className="build-check is-ok">✓ has index.html</span> : <span className="composer-note">empty</span>}
              {f.used_by && <span className="composer-note">(used by {f.used_by})</span>}
              <button className="link-btn" onClick={() => useFolder(f.name)}>Use</button></li>
          ))}</ul>
        </details>
      )}
    </div>
    <div className="review-strip">
      <p className="review-strip-label"><strong>Client review link</strong> lets them comment, edit the shared doc and share files{site.public ? '' : '. It\'s the only way in while the site is private'}.</p>
      <div className="review-link"><input readOnly value={link} onFocus={(e) => e.target.select()} aria-label="Client review link" />
        <button className="btn btn-primary" onClick={copy}>Copy link</button></div>
      <p className="composer-note"><button className="link-btn" onClick={newToken}>Make a new link</button> (the old one stops working)</p>
      {msg && <p className="admin-msg" role="status">{msg}</p>}
    </div>
    <details className="admin-panel">
      <summary>Manage site</summary>
      <div className="admin-grid">
        <div className="admin-block">
          <h3>Build</h3>
          <p className="composer-note">{site.has_build
            ? <>Build found in <code>sites/{site.folder}/</code>. Upload over it for each new round.</>
            : <>Upload the site's build into <code>sites/{site.folder}/</code> (the folder with its index.html). Sound Arcade and other relative-path builds work as they are. For a plain Vite site, build with <code>npx vite build --base=/sites/{site.folder}/</code>.</>}</p>
        </div>
        <div className="admin-block">
          <h3>Settings</h3>
          <SiteForm key={site.updated} initial={{ ...BLANK, ...site, preview_url: site.preview_setting ?? '', project_key: site.project_key || '', notes: site.notes || '' }} onSaved={(s) => { onSaved(s); setMsg('Settings saved.'); }} />
        </div>
        <div className="admin-block">
          <button className="link-btn danger" onClick={remove}>Delete this site</button>
        </div>
      </div>
    </details>
    </>
  );
}
