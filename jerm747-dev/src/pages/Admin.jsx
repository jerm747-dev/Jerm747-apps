import { useEffect, useState } from 'react';
import { adminStatus, adminSetup, adminGet, adminPost, adminPostRaw } from '../api.js';
import ProjectView, { STAGES } from '../components/ProjectView.jsx';
import Traffic from './Traffic.jsx';
import AdminSites from './AdminSites.jsx';

function useSession() {
  const [pw, setPw] = useState(() => { try { return sessionStorage.getItem('j747-admin') || ''; } catch { return ''; } });
  const save = (v) => { setPw(v); try { v ? sessionStorage.setItem('j747-admin', v) : sessionStorage.removeItem('j747-admin'); } catch { /* storage off */ } };
  return [pw, save];
}

export default function Admin() {
  const [pw, setPw] = useSession();
  const [setupDone, setSetupDone] = useState(null);
  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const [projects, setProjects] = useState([]);
  const [current, setCurrent] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [view, setView] = useState('projects');
  const [notice, setNotice] = useState('');

  useEffect(() => { adminStatus().then((d) => setSetupDone(d.setup)).catch((e) => setError(e.message)); }, []);
  useEffect(() => { if (pw) refresh(pw); }, [pw]);

  async function refresh(password = pw) {
    try {
      const { projects } = await adminGet(password, { action: 'list' });
      setProjects(projects);
      setError('');
    } catch (err) {
      setError(err.message);
      if (/password/i.test(err.message)) setPw('');
    }
  }

  async function open(key) {
    try {
      const { project } = await adminGet(pw, { action: 'get', key });
      setCurrent(project);
    } catch (err) { setError(err.message); }
  }

  async function login(e) {
    e.preventDefault();
    setError('');
    if (!setupDone) {
      try { await adminSetup(input); setSetupDone(true); } catch (err) { setError(err.message); return; }
    }
    setPw(input);
    setInput('');
  }

  async function act(action, fields, files) {
    const data = await adminPost(pw, action, { key: current.key, ...fields }, files);
    if (data.project) setCurrent(data.project);
    refresh();
    return data;
  }

  if (!pw) {
    return (
      <main className="page admin">
        <section className="key-entry">
          <h1>{setupDone === false ? 'Set your admin password' : 'Admin'}</h1>
          <p>{setupDone === false
            ? 'First visit: choose a password of 12 or more characters. Only you should see this screen, so set it right after uploading.'
            : 'Sign in to see requests and reply to clients.'}</p>
          <form className="key-form" onSubmit={login}>
            <label className="sr-only" htmlFor="pw">Password</label>
            <input id="pw" type="password" value={input} onChange={(e) => setInput(e.target.value)} autoComplete={setupDone === false ? 'new-password' : 'current-password'} />
            <button className="btn btn-primary">{setupDone === false ? 'Set password' : 'Sign in'}</button>
          </form>
          {error && <p className="form-error" role="alert">{error}</p>}
        </section>
      </main>
    );
  }

  if (current) {
    return (
      <main className="page admin">
        <button className="link-btn back" onClick={() => { setCurrent(null); refresh(); }}>All projects</button>
        <ProjectView
          project={current}
          viewer="jeremy"
          onSend={(body, files) => act('message', { body }, files)}
          adminPanel={<AdminPanel key={current.key} project={current} act={act} pw={pw}
            onDeleted={(key) => { setCurrent(null); setError(''); setNotice(`Deleted ${key}. A copy is kept in api/data/deleted/ on the server.`); refresh(); }} />}
        />
      </main>
    );
  }

  return (
    <main className="page admin">
      <div className="admin-head">
        <h1>Admin</h1>
        <div className="btn-row">
          {view === 'projects' && <button className="btn btn-ghost" onClick={() => setShowCreate(!showCreate)}>New project</button>}
          <button className="btn btn-ghost" onClick={() => setPw('')}>Sign out</button>
        </div>
      </div>
      <div className="tabs admin-tabs" role="tablist">
        <button role="tab" aria-selected={view === 'projects'} className={`tab ${view === 'projects' ? 'is-on' : ''}`} onClick={() => setView('projects')}>
          Projects <span className="tab-count">{projects.length}</span>
        </button>
        <button role="tab" aria-selected={view === 'sites'} className={`tab ${view === 'sites' ? 'is-on' : ''}`} onClick={() => setView('sites')}>Sites</button>
        <button role="tab" aria-selected={view === 'traffic'} className={`tab ${view === 'traffic' ? 'is-on' : ''}`} onClick={() => setView('traffic')}>Traffic</button>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      {notice && view === 'projects' && <p className="admin-msg" role="status">{notice}</p>}
      {view === 'sites' ? <AdminSites pw={pw} /> : view === 'traffic' ? <Traffic pw={pw} /> : <>
      {showCreate && <CreateProject pw={pw} onChanged={() => refresh()} onOpen={(p) => { setShowCreate(false); setNotice(''); open(p.key); }} />}
      {projects.length === 0 ? (
        <p className="empty">No requests yet. New ones from the contact form land here and in your inbox.</p>
      ) : (
        <ul className="project-list">
          {projects.map((p) => (
            <li key={p.key}>
              <button onClick={() => open(p.key)}>
                <span className="pl-title">{p.title}{p.waiting && <span className="badge">Needs reply</span>}</span>
                <span className="pl-meta">{p.key}, {p.client.name}, {STAGES.find((s) => s.id === p.stage)?.label}, updated {new Date(p.updated).toLocaleDateString()}
                  {p.sites?.length > 0 && <span className="pl-site">Site: {p.sites.map((s) => s.title).join(', ')}</span>}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      </>}
    </main>
  );
}

function AdminPanel({ project, act, pw, onDeleted }) {
  const [update, setUpdate] = useState({ title: '', body: '' });
  const [items, setItems] = useState(project.items.length ? project.items : [{ label: '', detail: '', status: 'planned' }]);
  const [notes, setNotes] = useState(project.notes || '');
  const [msg, setMsg] = useState('');

  const run = async (fn, done) => {
    setMsg('');
    try { await fn(); setMsg(done); } catch (err) { setMsg(err.message); }
  };

  return (
    <details className="admin-panel">
      <summary>Manage project</summary>
      <div className="admin-grid">
        <label className="field"><span>Stage</span>
          <select value={project.stage} onChange={(e) => run(() => act('stage', { stage: e.target.value }), 'Stage saved.')}>
            {STAGES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </label>

        <form className="admin-block" onSubmit={(e) => { e.preventDefault(); run(async () => { await act('update', update); setUpdate({ title: '', body: '' }); }, 'Update posted and emailed.'); }}>
          <h3>Post an update</h3>
          <label className="field"><span>Title</span><input value={update.title} onChange={(e) => setUpdate({ ...update, title: e.target.value })} /></label>
          <label className="field"><span>Details</span><textarea rows="3" value={update.body} onChange={(e) => setUpdate({ ...update, body: e.target.value })} /></label>
          <button className="btn btn-primary">Post update</button>
        </form>

        <form className="admin-block" onSubmit={(e) => { e.preventDefault(); run(() => act('items', { items }), 'Deliverables saved.'); }}>
          <h3>Deliverables</h3>
          {items.map((it, i) => (
            <div key={i} className="item-edit">
              <input placeholder="Deliverable" value={it.label} onChange={(e) => setItems(items.map((x, j) => j === i ? { ...x, label: e.target.value } : x))} />
              <select value={it.status} onChange={(e) => setItems(items.map((x, j) => j === i ? { ...x, status: e.target.value } : x))}>
                <option value="planned">Planned</option><option value="in_progress">In progress</option><option value="done">Done</option>
              </select>
              <input placeholder="Detail (optional)" value={it.detail} onChange={(e) => setItems(items.map((x, j) => j === i ? { ...x, detail: e.target.value } : x))} />
            </div>
          ))}
          <div className="btn-row">
            <button type="button" className="btn btn-ghost" onClick={() => setItems([...items, { label: '', detail: '', status: 'planned' }])}>Add row</button>
            <button className="btn btn-primary">Save deliverables</button>
          </div>
        </form>

        <form className="admin-block" onSubmit={(e) => { e.preventDefault(); run(() => act('notes', { notes }), 'Notes saved.'); }}>
          <h3>Private notes</h3>
          <textarea rows="4" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Only you see these." />
          <button className="btn btn-ghost">Save notes</button>
        </form>

        <LinkedSites project={project} act={act} setMsg={setMsg} />

        <KeyEmail project={project} act={act} />

        {project.request?.estimate && (
          <div className="admin-block"><h3>Their request</h3>
            <p>{project.request.type}, budget {project.request.budget || 'not given'}, timeline {project.request.timeline || 'not given'}</p>
            <p>Estimate they saw: {project.request.estimate}</p>
          </div>
        )}
      </div>
      {msg && <p className="admin-msg" role="status">{msg}</p>}
      <div className="admin-danger">
        <button type="button" className="link-btn danger" onClick={async () => {
          const typed = window.prompt(`Delete ${project.title}? Its messages, updates and files go with it, and any linked site is unlinked. Type ${project.key} to confirm.`);
          if (typed === null) return;
          if (typed.trim().toUpperCase() !== project.key) { setMsg(`Not deleted. Type ${project.key} exactly to delete it.`); return; }
          try { await adminPost(pw, 'delete', { key: project.key, confirm: project.key }); onDeleted(project.key); }
          catch (err) { setMsg(err.message); }
        }}>Delete project</button>
        <span className="composer-note">For duplicates and test projects. To finish a real one, set the stage to Closed instead.</span>
      </div>
    </details>
  );
}

function LinkedSites({ project, act, setMsg }) {
  const linked = project.linked_sites || [];
  const others = (project.all_sites || []).filter((s) => s.project_key !== project.key);
  const link = async (slug, on) => {
    try { await act('link_site', { slug, on: on ? '1' : '0' }); setMsg(on ? 'Site linked.' : 'Site unlinked.'); } catch (err) { setMsg(err.message); }
  };
  return (
    <div className="admin-block">
      <h3>Site in development</h3>
      {linked.length === 0 ? <p className="composer-note">No site linked to this project yet.</p> : (
        <ul className="linked-sites">
          {linked.map((s) => (
            <li key={s.slug}><a href={`#/sites/${s.slug}`}>{s.title}</a> <code>sites/{s.slug}/</code>
              <button type="button" className="link-btn" onClick={() => link(s.slug, false)}>Unlink</button></li>
          ))}
        </ul>
      )}
      {others.length > 0 ? (
        <label className="field"><span>Link a site</span>
          <select value="" onChange={(e) => e.target.value && link(e.target.value, true)}>
            <option value="">Choose a site…</option>
            {others.map((s) => <option key={s.slug} value={s.slug}>{s.title}{s.project_key ? ` (now with ${s.project_key})` : ''}</option>)}
          </select>
        </label>
      ) : linked.length === 0 && <p className="composer-note">Add the site under Admin › Sites first, then link it here.</p>}
    </div>
  );
}

function EmailCopy({ email, note }) {
  return (
    <figure className="email-copy">
      <figcaption>{note}</figcaption>
      <dl>
        <dt>From</dt><dd>{email.from}</dd>
        <dt>To</dt><dd>{email.to || '—'}</dd>
        <dt>Subject</dt><dd>{email.subject}</dd>
      </dl>
      <pre>{email.body}</pre>
    </figure>
  );
}

function KeyEmail({ project, act }) {
  const [busy, setBusy] = useState(false);
  const [copy, setCopy] = useState(null);
  const [err, setErr] = useState('');
  const sent = (project.emails || []).filter((e) => e.kind === 'project_key');
  const last = sent[sent.length - 1];
  return (
    <div className="admin-block">
      <h3>Project key email</h3>
      <p className="composer-note">{last
        ? `${last.sent ? 'Sent' : 'Tried to send'} to ${last.to} on ${new Date(last.at).toLocaleString()}${last.sent ? '' : " (the server couldn't send it)"}.`
        : 'Not sent from here yet.'}</p>
      <button type="button" className="btn btn-ghost" disabled={busy} onClick={async () => {
        setBusy(true); setErr('');
        try { const d = await act('send_key', {}); setCopy(d.email); } catch (x) { setErr(x.message); } finally { setBusy(false); }
      }}>{busy ? 'Sending…' : last ? 'Send it again' : 'Send project key'}</button>
      {err && <p className="form-error">{err}</p>}
      {copy && <EmailCopy email={copy} note={copy.sent ? `Sent ${new Date(copy.at).toLocaleTimeString()}. This is what ${project.client.name} got:` : "The server couldn't send this one. Check the mail settings on your host, then try again."} />}
    </div>
  );
}

const CREATE_STEPS = [
  { id: 'create', label: 'Create project' },
  { id: 'email', label: 'Email the key' },
  { id: 'done', label: 'Done' },
];

function CreateProgress({ phase, notify, emailFailed }) {
  const steps = notify ? CREATE_STEPS : CREATE_STEPS.filter((s) => s.id !== 'email');
  const at = steps.findIndex((s) => s.id === phase);
  const pct = phase === 'done' ? 100 : Math.round(((at + 0.5) / steps.length) * 100);
  return (
    <div className={`create-progress ${phase === 'done' ? 'is-done' : 'is-busy'}`}>
      <div className="create-bar" role="progressbar" aria-label="Opening the project" aria-valuemin="0" aria-valuemax="100" aria-valuenow={pct}>
        <span style={{ width: `${pct}%` }} />
      </div>
      <ol className="create-steps">
        {steps.map((s, i) => {
          const failed = emailFailed && s.id === 'email' && phase === 'done';
          const done = i < at || phase === 'done';
          return (
            <li key={s.id} className={failed ? 'is-failed' : done ? 'is-done' : i === at ? 'is-now' : ''}>
              <span className="create-dot" aria-hidden="true">{failed ? '✕' : done ? '✓' : i + 1}</span>{failed ? 'Email not sent' : s.label}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function CreateProject({ pw, onChanged, onOpen }) {
  const blank = { name: '', email: '', company: '', title: '', notify: true };
  const [f, setF] = useState(blank);
  const [err, setErr] = useState('');
  const [phase, setPhase] = useState('idle'); // idle | create | email | done
  const [dup, setDup] = useState(null);
  const [project, setProject] = useState(null);
  const [sentCopy, setSentCopy] = useState(null);
  const [template, setTemplate] = useState(null);
  const busy = phase === 'create' || phase === 'email';

  useEffect(() => { adminGet(pw, { action: 'key_email' }).then((d) => setTemplate(d.email)).catch(() => {}); }, [pw]);

  async function start(allowDuplicate = false) {
    if (busy) return;
    setErr(''); setDup(null); setSentCopy(null); setPhase('create');
    try {
      const d = await adminPostRaw(pw, 'create', { name: f.name, email: f.email, company: f.company, title: f.title, allow_duplicate: allowDuplicate ? '1' : '' });
      if (!d?.ok) { setPhase('idle'); setErr(d?.error || 'Something went wrong. Try again.'); if (d?.duplicate) setDup(d.duplicate); return; }
      setProject(d.project);
      onChanged();
      if (f.notify) {
        setPhase('email');
        try {
          const r = await adminPost(pw, 'send_key', { key: d.project.key });
          setProject(r.project);
          setSentCopy(r.email);
          if (!r.email.sent) setErr("The project is open, but the server couldn't send the email. Use Send it again on the project page once mail is working.");
        } catch (x) { setErr(`The project is open, but the email step failed: ${x.message}`); }
        onChanged();
      }
      setPhase('done');
    } catch (x) { setPhase('idle'); setErr(x.message); }
  }

  const fill = (s) => (s || '')
    .replaceAll('{name}', f.name.trim() || 'Client name')
    .replaceAll('{email}', f.email.trim())
    .replaceAll('{key}', project?.key || 'J747-····-····');
  const preview = template && { ...template, to: fill(template.to), subject: fill(template.subject), body: fill(template.body) };
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  return (
    <form className="admin-block create" onSubmit={(e) => { e.preventDefault(); start(false); }}>
      <h3>Open a project for a client</h3>
      <p>For leads that came by phone or in person. They get a project key like everyone else.</p>
      <fieldset disabled={busy || phase === 'done'} className="create-fields">
        <div className="field-row">
          <label className="field"><span>Client name</span><input value={f.name} onChange={set('name')} /></label>
          <label className="field"><span>Client email</span><input type="email" value={f.email} onChange={set('email')} /></label>
        </div>
        <div className="field-row">
          <label className="field"><span>Company</span><input value={f.company} onChange={set('company')} /></label>
          <label className="field"><span>Project title</span><input value={f.title} onChange={set('title')} /></label>
        </div>
        <label className="check"><input type="checkbox" checked={f.notify} onChange={set('notify')} /><span>Email them their project key</span></label>
      </fieldset>
      {err && <p className="form-error" role="alert">{err}</p>}
      {dup && (
        <div className="btn-row">
          <button type="button" className="btn btn-primary" onClick={() => onOpen(dup)}>Open {dup.key}</button>
          <button type="button" className="btn btn-ghost" onClick={() => start(true)}>Open a new one anyway</button>
        </div>
      )}
      {phase === 'idle' && !dup && <button className="btn btn-primary">{f.notify ? 'Open project and email key' : 'Open project'}</button>}
      {phase !== 'idle' && <CreateProgress phase={phase} notify={f.notify} emailFailed={f.notify && phase === 'done' && !sentCopy?.sent} />}
      {phase === 'done' && project && (
        <div className="btn-row">
          <button type="button" className="btn btn-primary" onClick={() => onOpen(project)}>Open {project.key}</button>
          <button type="button" className="btn btn-ghost" onClick={() => { setF(blank); setProject(null); setSentCopy(null); setErr(''); setPhase('idle'); }}>Start another</button>
        </div>
      )}
      {sentCopy
        ? <EmailCopy email={sentCopy} note={sentCopy.sent ? `Sent ${new Date(sentCopy.at).toLocaleTimeString()}. This is what ${f.name || 'they'} got:` : "Not sent. This is the email that would have gone out:"} />
        : preview && <EmailCopy email={preview} note={f.notify ? 'Email preview. The key fills in when the project opens.' : "Preview only. With the box unchecked, no email is sent."} />}
    </form>
  );
}
