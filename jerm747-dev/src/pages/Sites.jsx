import { useEffect, useState } from 'react';
import { listSites, getSite } from '../api.js';
import SiteView, { statusLabel, when } from '../components/SiteView.jsx';

// #/sites               -> sites in development (public ones)
// #/sites/<slug>        -> one site
// #/sites/<slug>/<token> -> one site with the review link (comment, edit the doc, share files)
export default function Sites({ slug, token }) {
  if (slug) return <SitePage slug={slug} token={token} />;
  return <SiteList />;
}

function SiteList() {
  const [sites, setSites] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    listSites().then((d) => setSites(d.sites)).catch((e) => { setError(e.message); setSites([]); });
  }, []);

  return (
    <main className="page sites-page">
      <header className="sites-intro">
        <p className="eyebrow">Sites</p>
        <h1>Sites in development</h1>
        <p>Work in progress, out in the open. Each site has a live preview, a comment history, a shared document
          and files, so feedback lands in one place instead of scattered across texts and emails.</p>
        <p className="key-help">Working with me on a site? Open the review link I sent you to comment, edit the shared doc and share files.</p>
      </header>
      {error && <p className="form-error" role="alert">{error}</p>}
      {sites === null ? <p className="empty">Loading…</p> : sites.length === 0 ? (
        <div className="sites-empty">
          <p>Nothing is posted for public viewing right now. Client sites in progress are shared privately by link.</p>
          <a className="btn btn-primary" href="#contact">Start a site of your own</a>
        </div>
      ) : (
        <ul className="site-grid">
          {sites.map((s) => (
            <li key={s.slug}>
              <a className="site-card" href={`#/sites/${s.slug}`}>
                <div className="site-thumb" aria-hidden="true">
                  {s.has_build || /^https?:/.test(s.preview_url)
                    ? <iframe src={s.preview_url} tabIndex={-1} loading="lazy" title="" />
                    : <span>Preview coming</span>}
                </div>
                <div className="site-card-body">
                  <span className={`site-status st-${s.status}`}>{statusLabel(s.status)}{!s.public && ' · private'}</span>
                  <h2>{s.title}</h2>
                  {s.summary && <p>{s.summary}</p>}
                  <p className="site-card-meta">{s.comments} comment{s.comments === 1 ? '' : 's'}{s.doc_by && `, doc edited by ${s.doc_by}`}, updated {when(s.updated)}</p>
                </div>
              </a>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

function SitePage({ slug, token }) {
  const [site, setSite] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setSite(null); setError('');
    getSite(slug, token).then((d) => { setSite(d.site); document.title = `${d.site.title} | jerm747.dev`; }).catch((e) => setError(e.message));
  }, [slug, token]);

  if (error) {
    return (
      <main className="page">
        <section className="key-entry">
          <h1>Site not found</h1>
          <p className="form-error" role="alert">{error}</p>
          <p className="key-help">Private sites open only from the review link. <a href="#/sites">See all sites</a></p>
        </section>
      </main>
    );
  }
  if (!site) return <main className="page"><p className="empty">Loading…</p></main>;

  return (
    <main className="page site-page">
      <a className="back" href="#/sites">All sites</a>
      <SiteView site={site} token={token} onSite={setSite} />
      {site.access === 'reviewer' && (
        <p className="portal-foot">This is a private review link. Anyone with it can comment, edit the shared doc and see the files, so share it only with your team.</p>
      )}
    </main>
  );
}
