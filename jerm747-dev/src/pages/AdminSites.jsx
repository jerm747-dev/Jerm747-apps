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
          <p>Each site gets a page at jerm747.dev/#/sites/<em>address</em> and a folder on the server at <code>sites/<em>address</em>/</code> for its build.</p>
          <SiteForm initial={BLANK} isNew onSaved={(s) => { setCreating(false); setCurrent(s); refresh(); }} />
        </div>
      )}
      {sites.length === 0 ? (
        <p className="empty">No sites yet. Add your first commission with New site.</p>
      ) : (
        <ul className="project-list">
          {sites.map((s) => (
            <li key={s.slug}>
              <button onClick={() => open(s.slug)}>
                <span className="pl-title">{s.title}
                  {s.open > 0 && <span className="badge">{s.open} open comment{s.open > 1 ? 's' : ''}</span>}
                  <span className={`pill ${s.public ? 'pill-public' : ''}`}>{s.public ? 'Public' : 'Private'}</span>
                </span>
                <span className="pl-meta">/sites/{s.slug}, {statusLabel(s.status)}{s.client && `, ${s.client}`}{!s.has_build && ', no build uploaded'}, updated {when(s.updated)}</span>
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
    if (!isNew) fields.slug = f.slug;
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
      <label className="check"><input type="checkbox" checked={f.public} onChange={set('public')} />
        <span>Show on the public Sites page (anyone can view and comment; only people with the review link can edit the doc and see files)</span></label>
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

  return (
    <>
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
            ? <>Build found in <code>sites/{site.slug}/</code>. Upload over it for each new round.</>
            : <>Upload the site's build into <code>sites/{site.slug}/</code> (the folder with its index.html). For a Vite site, build with <code>npx vite build --base=/sites/{site.slug}/</code>.</>}</p>
        </div>
        <div className="admin-block">
          <h3>Settings</h3>
          <SiteForm initial={{ ...BLANK, ...site, project_key: site.project_key || '', notes: site.notes || '' }} onSaved={(s) => { onSaved(s); setMsg('Settings saved.'); }} />
        </div>
        <div className="admin-block">
          <button className="link-btn danger" onClick={remove}>Delete this site</button>
        </div>
      </div>
    </details>
    </>
  );
}
