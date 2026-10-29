import { useEffect, useState } from 'react';
import { adminStatus, adminSetup, adminGet, adminPost } from '../api.js';
import ProjectView, { STAGES } from '../components/ProjectView.jsx';
import Traffic from './Traffic.jsx';

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
    const { project } = await adminPost(pw, action, { key: current.key, ...fields }, files);
    setCurrent(project);
    refresh();
    return project;
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
          adminPanel={<AdminPanel project={current} act={act} />}
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
        <button role="tab" aria-selected={view === 'traffic'} className={`tab ${view === 'traffic' ? 'is-on' : ''}`} onClick={() => setView('traffic')}>Traffic</button>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      {view === 'traffic' ? <Traffic pw={pw} /> : <>
      {showCreate && <CreateProject pw={pw} onCreated={(p) => { setShowCreate(false); setCurrent(p); refresh(); }} />}
      {projects.length === 0 ? (
        <p className="empty">No requests yet. New ones from the contact form land here and in your inbox.</p>
      ) : (
        <ul className="project-list">
          {projects.map((p) => (
            <li key={p.key}>
              <button onClick={() => open(p.key)}>
                <span className="pl-title">{p.title}{p.waiting && <span className="badge">Needs reply</span>}</span>
                <span className="pl-meta">{p.key}, {p.client.name}, {STAGES.find((s) => s.id === p.stage)?.label}, updated {new Date(p.updated).toLocaleDateString()}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      </>}
    </main>
  );
}

function AdminPanel({ project, act }) {
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

        {project.request?.estimate && (
          <div className="admin-block"><h3>Their request</h3>
            <p>{project.request.type}, budget {project.request.budget || 'not given'}, timeline {project.request.timeline || 'not given'}</p>
            <p>Estimate they saw: {project.request.estimate}</p>
          </div>
        )}
      </div>
      {msg && <p className="admin-msg" role="status">{msg}</p>}
    </details>
  );
}

function CreateProject({ pw, onCreated }) {
  const [f, setF] = useState({ name: '', email: '', company: '', title: '', notify: true });
  const [err, setErr] = useState('');
  return (
    <form className="admin-block create" onSubmit={async (e) => {
      e.preventDefault();
      try { const { project } = await adminPost(pw, 'create', { ...f, notify: f.notify ? '1' : '' }); onCreated(project); }
      catch (x) { setErr(x.message); }
    }}>
      <h3>Open a project for a client</h3>
      <p>For leads that came by phone or in person. They get a project key like everyone else.</p>
      <div className="field-row">
        <label className="field"><span>Client name</span><input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
        <label className="field"><span>Client email</span><input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></label>
      </div>
      <div className="field-row">
        <label className="field"><span>Company</span><input value={f.company} onChange={(e) => setF({ ...f, company: e.target.value })} /></label>
        <label className="field"><span>Project title</span><input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></label>
      </div>
      <label className="check"><input type="checkbox" checked={f.notify} onChange={(e) => setF({ ...f, notify: e.target.checked })} /><span>Email them their project key</span></label>
      {err && <p className="form-error">{err}</p>}
      <button className="btn btn-primary">Open project</button>
    </form>
  );
}
