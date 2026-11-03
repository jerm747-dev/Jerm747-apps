import { useEffect, useRef, useState } from 'react';
import { siteAction, siteFileUrl, getRevision } from '../api.js';
import SlideDeck from './SlideDeck.jsx';

export const SITE_STATUSES = [
  { id: 'concept', label: 'Concept' },
  { id: 'design', label: 'Design' },
  { id: 'building', label: 'Building' },
  { id: 'review', label: 'In review' },
  { id: 'launched', label: 'Launched' },
  { id: 'paused', label: 'Paused' },
];

export const statusLabel = (id) => SITE_STATUSES.find((s) => s.id === id)?.label || id;

export function when(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function size(n) {
  if (n > 1024 * 1024) return (n / 1024 / 1024).toFixed(1) + ' MB';
  return Math.max(1, Math.round(n / 1024)) + ' KB';
}

function useName() {
  const [name, setName] = useState(() => { try { return localStorage.getItem('j747-review-name') || ''; } catch { return ''; } });
  const save = (v) => { setName(v); try { localStorage.setItem('j747-review-name', v); } catch { /* storage off */ } };
  return [name, save];
}

const DEVICES = [
  { id: 'desktop', label: 'Desktop', width: '100%' },
  { id: 'tablet', label: 'Tablet', width: '820px' },
  { id: 'phone', label: 'Phone', width: '390px' },
];

function Preview({ site }) {
  const [device, setDevice] = useState('desktop');
  const [reload, setReload] = useState(0);
  const external = /^https?:/.test(site.preview_url);
  if (!site.has_build && !external) {
    return (
      <div className="preview-empty">
        <p><strong>No build uploaded yet.</strong></p>
        <p>{site.access === 'admin'
          ? <>Upload the site's build into <code>sites/{site.slug}/</code> on the server and it shows here.</>
          : 'Jeremy hasn\'t posted a preview yet. Check back soon, or leave a comment.'}</p>
      </div>
    );
  }
  const w = DEVICES.find((d) => d.id === device).width;
  return (
    <div className="preview">
      <div className="preview-bar">
        <div className="seg" role="group" aria-label="Preview size">
          {DEVICES.map((d) => (
            <button key={d.id} className={device === d.id ? 'is-on' : ''} aria-pressed={device === d.id} onClick={() => setDevice(d.id)}>{d.label}</button>
          ))}
        </div>
        <div className="btn-row">
          <button className="link-btn" onClick={() => setReload((n) => n + 1)}>Reload</button>
          <a href={site.preview_url} target="_blank" rel="noopener">Open in a new tab</a>
        </div>
      </div>
      <div className="preview-frame-wrap">
        <iframe key={reload} title={`${site.title} preview`} src={site.preview_url} style={{ width: w }} className="preview-frame" loading="lazy" />
      </div>
    </div>
  );
}

function Comments({ site, token, name, setName, onSite }) {
  const [body, setBody] = useState('');
  const [page, setPage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [showResolved, setShowResolved] = useState(true);
  const end = useRef(null);
  const admin = site.access === 'admin';
  const list = site.comments.filter((c) => showResolved || !c.resolved);

  useEffect(() => { end.current?.scrollIntoView({ block: 'nearest' }); }, [site.comments.length]);

  async function post(e) {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      const { site: next } = await siteAction('comment', { slug: site.slug, token, name, body, page });
      onSite(next); setBody('');
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }

  async function flag(c, field, value) {
    try { const { site: next } = await siteAction('comment_flag', { slug: site.slug, id: c.id, [field]: value }); onSite(next); }
    catch (err) { setError(err.message); }
  }

  return (
    <>
      <div className="comments-head">
        <p className="composer-note">Every comment stays here as the project's history.</p>
        {site.comments.some((c) => c.resolved) && (
          <label className="check"><input type="checkbox" checked={showResolved} onChange={(e) => setShowResolved(e.target.checked)} /><span>Show resolved</span></label>
        )}
      </div>
      <div className="thread">
        {list.length === 0 && <p className="empty">No comments yet. What do you think so far?</p>}
        {list.map((c) => (
          <article key={c.id} className={`msg ${c.from === 'jeremy' ? 'msg-mine' : 'msg-theirs'} ${c.resolved ? 'is-resolved' : ''} ${c.hidden ? 'is-hidden' : ''}`}>
            <p className="msg-meta">{c.author}{c.page && <em className="comment-page">{c.page}</em>} <span>{when(c.at)}</span></p>
            <p className="msg-body">{c.body}</p>
            {(c.resolved || admin) && (
              <p className="comment-actions">
                {c.resolved && <span className="resolved-tag">Resolved</span>}
                {admin && <button className="link-btn" onClick={() => flag(c, 'resolved', c.resolved ? '0' : '1')}>{c.resolved ? 'Reopen' : 'Mark resolved'}</button>}
                {admin && <button className="link-btn" onClick={() => flag(c, 'hidden', c.hidden ? '0' : '1')}>{c.hidden ? 'Show to others' : 'Hide'}</button>}
              </p>
            )}
          </article>
        ))}
        <div ref={end} />
      </div>
      <form className="composer" onSubmit={post}>
        <div className="field-row">
          {!admin && <label className="field"><span>Your name</span><input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required /></label>}
          <label className="field"><span>About which page or part? <em>optional</em></span><input value={page} onChange={(e) => setPage(e.target.value)} placeholder="Home, menu, contact form…" /></label>
        </div>
        <label className="sr-only" htmlFor="comment-body">Comment</label>
        <textarea id="comment-body" rows="3" value={body} onChange={(e) => setBody(e.target.value)} placeholder="What works, what doesn't, what's missing" />
        <div className="composer-bar">
          <span className="composer-note">{admin ? 'Posting as Jeremy.' : 'Jeremy gets an email with your comment.'}</span>
          <button className="btn btn-primary" disabled={busy || !body.trim() || (!admin && !name.trim())}>{busy ? 'Posting…' : 'Post comment'}</button>
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}
      </form>
    </>
  );
}

function SharedDoc({ site, token, name, setName, onSite, canEdit }) {
  const doc = site.doc;
  const [text, setText] = useState(doc.body);
  const [base, setBase] = useState(doc.version);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [old, setOld] = useState(null);
  const [touched, setTouched] = useState(false);
  const admin = site.access === 'admin';
  const dirty = touched && text !== doc.body;

  // A newer version arrived and you haven't typed anything: show it.
  useEffect(() => {
    if (!touched) { setText(doc.body); setBase(doc.version); }
  }, [doc.version]); // eslint-disable-line react-hooks/exhaustive-deps

  async function save() {
    setBusy(true); setError(''); setMsg('');
    try {
      const { site: next } = await siteAction('doc', { slug: site.slug, token, name, body: text, base });
      setTouched(false); setBase(next.doc.version); setText(next.doc.body); onSite(next); setMsg('Saved.');
    } catch (err) {
      setError(err.message);
      if (err.conflict && err.site) onSite(err.site); // keeps your text; banner offers their version
    } finally { setBusy(false); }
  }

  function loadLatest() { setText(doc.body); setBase(doc.version); setTouched(false); setError(''); }

  async function viewRevision(v) {
    try { const { revision } = await getRevision(site.slug, token, v); setOld(revision); }
    catch (err) { setError(err.message); }
  }

  return (
    <div className="shared-doc">
      <div className="doc-status">
        {doc.edited_at
          ? <p>Last edited by <strong>{doc.edited_by}</strong>, {when(doc.edited_at)} <span className="doc-v">version {doc.version}</span></p>
          : <p>Nobody has written in this document yet.</p>}
        {base !== doc.version && <p className="doc-warn">A newer version is saved. <button className="link-btn" onClick={loadLatest}>Load it</button> (you'll lose unsaved changes)</p>}
      </div>
      {canEdit ? (
        <>
          <label className="sr-only" htmlFor="doc-body">Shared document</label>
          <textarea id="doc-body" className="doc-text" rows="16" value={text} onChange={(e) => { setText(e.target.value); setTouched(true); setMsg(''); }}
            placeholder={'Goals, pages, copy, colors, open questions…\nEveryone with the review link can edit this.'} />
          <div className="composer-bar">
            {!admin && <label className="field doc-name"><span>Saving as</span><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" autoComplete="name" /></label>}
            <span className="composer-note">{msg || (dirty ? 'Unsaved changes' : '')}</span>
            <button className="btn btn-primary" onClick={save} disabled={busy || !dirty || (!admin && !name.trim())}>{busy ? 'Saving…' : 'Save document'}</button>
          </div>
        </>
      ) : (
        doc.body ? <div className="doc-read">{doc.body}</div> : <p className="empty">Nothing here yet.</p>
      )}
      {error && <p className="form-error" role="alert">{error}</p>}
      {site.revision_log.length > 0 && (
        <details className="doc-history">
          <summary>Edit history ({site.revision_log.length + 1} versions)</summary>
          <ol>
            <li><strong>Version {doc.version}</strong>, {doc.edited_by}, {when(doc.edited_at)} <em>current</em></li>
            {site.revision_log.map((r) => (
              <li key={r.v}>Version {r.v}, {r.by}, {when(r.at)} <button className="link-btn" onClick={() => viewRevision(r.v)}>View</button></li>
            ))}
          </ol>
          {old && (
            <div className="doc-old">
              <p className="doc-old-head">Version {old.v} by {old.by}, {when(old.at)}
                {canEdit && <button className="link-btn" onClick={() => { setText(old.body); setBase(doc.version); setTouched(true); setOld(null); setMsg('Old version loaded. Save to restore it.'); }}>Restore this</button>}
                <button className="link-btn" onClick={() => setOld(null)}>Close</button>
              </p>
              <div className="doc-read">{old.body || '(empty)'}</div>
            </div>
          )}
        </details>
      )}
    </div>
  );
}

function Files({ site, token, name, setName, onSite, canEdit }) {
  const [files, setFiles] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const input = useRef(null);
  const admin = site.access === 'admin';
  const key = admin ? site.token : token;

  async function upload(e) {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      const { site: next } = await siteAction('upload', { slug: site.slug, token, name }, files);
      onSite(next); setFiles([]); if (input.current) input.current.value = '';
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }

  async function adminDo(action, id) {
    if (action === 'file_delete' && !window.confirm('Delete this file for everyone?')) return;
    try { const { site: next } = await siteAction(action, { slug: site.slug, id }); onSite(next); }
    catch (err) { setError(err.message); }
  }

  return (
    <>
      {site.files.length === 0 ? <p className="empty">No files shared yet.</p> : (
        <ul className="files">
          {[...site.files].reverse().map((f) => (
            <li key={f.id}>
              <a href={siteFileUrl(site.slug, key, f.id)}>{f.name}</a>
              <span>
                {size(f.size)}, from {f.author}, {when(f.at)}
                {site.deck === f.id && <em className="deck-tag"> slide deck</em>}
                {admin && /\.pdf$/i.test(f.name) && site.deck !== f.id && <> <button className="link-btn" onClick={() => adminDo('deck', f.id)}>Use as slides</button></>}
                {admin && <> <button className="link-btn danger" onClick={() => adminDo('file_delete', f.id)}>Delete</button></>}
              </span>
            </li>
          ))}
        </ul>
      )}
      {canEdit && (
        <form className="composer" onSubmit={upload}>
          <div className="composer-bar">
            {!admin && <label className="field doc-name"><span>Your name</span><input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" /></label>}
            <label className="attach">
              <input ref={input} type="file" multiple onChange={(e) => setFiles([...e.target.files])} />
              <span>{files.length ? `${files.length} file${files.length > 1 ? 's' : ''} picked` : 'Pick files to share'}</span>
            </label>
            <button className="btn btn-primary" disabled={busy || !files.length || (!admin && !name.trim())}>{busy ? 'Uploading…' : 'Share files'}</button>
          </div>
          <p className="composer-note">Up to 25 MB each. Logos, photos, copy, PDFs, PowerPoint. A PDF becomes the slide deck.</p>
          {error && <p className="form-error" role="alert">{error}</p>}
        </form>
      )}
      {!canEdit && error && <p className="form-error" role="alert">{error}</p>}
    </>
  );
}

// The shared site window: clients and visitors (access viewer/reviewer) and Jeremy (admin).
export default function SiteView({ site, token, onSite, adminPanel }) {
  const [tab, setTab] = useState('preview');
  const [name, setName] = useName();
  const canEdit = site.access !== 'viewer';
  const deck = site.files.find((f) => f.id === site.deck);
  const fileKey = site.access === 'admin' ? site.token : token;

  const tabs = [
    { id: 'preview', label: 'Preview' },
    { id: 'comments', label: 'Comments', count: site.comments.length },
    { id: 'doc', label: 'Shared doc' },
    ...(canEdit ? [{ id: 'files', label: 'Files', count: site.files.length }] : []),
    ...(deck ? [{ id: 'slides', label: 'Slides' }] : []),
  ];

  return (
    <section className="project site">
      <header className="project-head site-head">
        <div>
          <p className="project-key">{statusLabel(site.status)}{site.access !== 'viewer' && !site.public && ' · private review'}</p>
          <h1 className="project-title">{site.title}</h1>
          {site.client && <p className="project-meta">For {site.client}</p>}
          {site.summary && <p className="site-summary">{site.summary}</p>}
        </div>
        <dl className="site-facts">
          <div><dt>Shared doc</dt><dd>{site.doc.edited_at ? `${site.doc.edited_by}, ${when(site.doc.edited_at)}` : 'Not started'}</dd></div>
          <div><dt>Comments</dt><dd>{site.comments.length}</dd></div>
          <div><dt>Updated</dt><dd>{when(site.updated)}</dd></div>
        </dl>
      </header>

      {adminPanel}

      <div className="tabs" role="tablist">
        {tabs.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} className={`tab ${tab === t.id ? 'is-on' : ''}`} onClick={() => setTab(t.id)}>
            {t.label} {t.count !== undefined && <span className="tab-count">{t.count}</span>}
          </button>
        ))}
      </div>

      <div className="tab-panel" role="tabpanel">
        {tab === 'preview' && <Preview site={site} />}
        {tab === 'comments' && <Comments site={site} token={token} name={name} setName={setName} onSite={onSite} />}
        {tab === 'doc' && <SharedDoc site={site} token={token} name={name} setName={setName} onSite={onSite} canEdit={canEdit} />}
        {tab === 'files' && <Files site={site} token={token} name={name} setName={setName} onSite={onSite} canEdit={canEdit} />}
        {tab === 'slides' && deck && (
          <SlideDeck url={siteFileUrl(site.slug, fileKey, deck.id, true)} name={deck.name} downloadUrl={canEdit ? siteFileUrl(site.slug, fileKey, deck.id) : ''} />
        )}
      </div>
    </section>
  );
}
