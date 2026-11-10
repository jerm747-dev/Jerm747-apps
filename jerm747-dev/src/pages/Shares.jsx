import { useEffect, useState } from 'react';
import { adminGet, adminPost, noCountOn, setNoCount } from '../api.js';

// Shared private pages (e.g. sites/your-share-folder/): who opened them, what was downloaded,
// and when to take them down. Recipients never see any of this.

const when = (iso) => (iso ? new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—');
const day = (iso) => new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
const ago = (iso) => {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 90) return 'just now';
  if (s < 5400) return `${Math.round(s / 60)} min ago`;
  if (s < 129600) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86400)} days ago`;
};
const WHAT = { visit: 'Opened the page', download: 'Downloaded', console: 'Opened the console' };

function Status({ s }) {
  if (!s.active) return <span className="share-status is-off">Taken down</span>;
  if (s.due) return <span className="share-status is-due">Due for removal</span>;
  if (!s.stats.visits) return <span className="share-status is-wait">Not opened yet</span>;
  return <span className="share-status is-live">Live</span>;
}

function ShareCard({ s, act }) {
  const st = s.stats;
  const removal = !s.active
    ? `Taken down ${when(s.taken_down)}`
    : s.due ? `Removal date passed (${day(s.expires)})` : `Remove by ${day(s.expires)}, in ${s.days_left} day${s.days_left === 1 ? '' : 's'}`;
  return (
    <article className={`share-card${s.due ? ' is-due' : ''}${s.active ? '' : ' is-off'}`}>
      <header className="share-head">
        <div>
          <h3>{s.title}</h3>
          <a href={s.url} target="_blank" rel="noreferrer">{s.url.replace(/^https:\/\//, '')}</a>
        </div>
        <Status s={s} />
      </header>
      <p className="share-dates">Shared {day(s.created)} · {removal}</p>

      <dl className="tiles share-tiles">
        <div><dt>Visits</dt><dd>{st.visits}</dd></div>
        <div><dt>People</dt><dd>{st.people}</dd></div>
        <div><dt>Downloads</dt><dd>{st.downloads}</dd></div>
        <div><dt>Console opens</dt><dd>{st.console}</dd></div>
      </dl>
      <p className="share-firsts">
        First visit: <b>{when(s.first_visit)}</b> · Last visit: <b>{when(st.last_visit)}</b> · First download: <b>{when(s.first_download)}</b>
      </p>

      <div className="share-grid">
        <section className="ranked">
          <h3>Downloads by file</h3>
          {st.files.length === 0 ? <p className="empty">Nothing downloaded yet.</p> : (
            <ol>{st.files.map((f) => (
              <li key={f.name}><span className="ranked-name" title={f.name}>{f.name}</span>
                <span className="ranked-bar"><span style={{ width: `${(f.count / st.files[0].count) * 100}%` }} /></span>
                <span className="ranked-n">{f.count}</span></li>))}</ol>
          )}
          {st.users.length > 0 && <>
            <h3 style={{ marginTop: 16 }}>Signed in as</h3>
            <ol>{st.users.map((u) => <li key={u.name}><span className="ranked-name">{u.name}</span><span /><span className="ranked-n">{u.count}</span></li>)}</ol>
          </>}
        </section>
        <section>
          <h3>Recent activity</h3>
          {s.recent.length === 0 ? <p className="empty">No visits yet. If it stays this way, check that they got the link and password.</p> : (
            <ul className="share-activity">
              {s.recent.map((r, i) => (
                <li key={i}>
                  <span className={`share-dot t-${r.type}`} aria-hidden="true" />
                  <span className="share-what">{WHAT[r.type]}{r.file && <> <code>{r.file}</code></>}
                    <small>{r.user ? `${r.user} · ` : ''}{r.device}</small></span>
                  <span className="share-when" title={when(r.at)}>{ago(r.at)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="share-controls">
        <div className="btn-row">
          {s.active
            ? <button className="btn btn-ghost" onClick={() => act(s.id, 'takedown')}>Take down now</button>
            : <button className="btn btn-ghost" onClick={() => act(s.id, 'restore')}>Put back up</button>}
          <button className="btn btn-ghost" onClick={() => act(s.id, 'extend', { days: '30' })}>Extend 30 days</button>
        </div>
        <fieldset className="share-notify">
          <legend>Email me</legend>
          {[['notify_first_visit', 'On the first visit'], ['notify_first_download', 'On the first download'], ['notify_downloads', 'On every download']].map(([k, l]) => (
            <label key={k} className="check">
              <input type="checkbox" checked={!!s[k]} onChange={(e) => act(s.id, 'notify', { [k]: e.target.checked ? '1' : '0' })} />
              <span>{l}</span>
            </label>
          ))}
        </fieldset>
      </div>
    </article>
  );
}

export default function Shares({ pw }) {
  const [shares, setShares] = useState(null);
  const [msg, setMsg] = useState('');
  const [noCount, setNC] = useState(noCountOn);

  const load = () => adminGet(pw, { action: 'shares' }).then((d) => setShares(d.shares)).catch((e) => setMsg(e.message));
  useEffect(() => { load(); const t = setInterval(load, 60000); return () => clearInterval(t); }, [pw]); // eslint-disable-line react-hooks/exhaustive-deps

  const act = async (id, op, fields = {}) => {
    try {
      const d = await adminPost(pw, 'share', { id, op, ...fields });
      setShares((list) => list.map((s) => (s.id === id ? d.share : s)));
      setMsg({ takedown: 'Taken down. The page now says "no longer available".', restore: 'Back up.', extend: 'Extended 30 days.', notify: 'Email settings saved.' }[op] || 'Saved.');
    } catch (e) { setMsg(e.message); }
  };

  if (!shares) return <p className="empty">{msg || 'Loading shared pages…'}</p>;
  return (
    <div className="shares">
      <p className="shares-intro">Password-protected pages you've shared, like the Application Console download page. Each one shows up here after its first visit. Visits, downloads and console opens are logged quietly; the people you share with see nothing different.</p>
      {shares.length === 0
        ? <p className="empty">No shared pages yet. Upload a share folder to sites/ and open it once.</p>
        : shares.map((s) => <ShareCard key={s.id} s={s} act={act} />)}
      <label className="check" style={{ marginTop: 8 }}>
        <input type="checkbox" checked={noCount} onChange={() => { setNoCount(!noCount); setNC(!noCount); }} />
        <span>Don't count my own visits from this device (applies to Traffic too)</span>
      </label>
      {msg && <p className="admin-msg" role="status">{msg}</p>}
    </div>
  );
}
