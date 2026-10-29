import { useEffect, useRef, useState } from 'react';
import { fileUrl } from '../api.js';

export const STAGES = [
  { id: 'received', label: 'Received' },
  { id: 'reviewing', label: 'Reviewing' },
  { id: 'quoted', label: 'Quoted' },
  { id: 'in_progress', label: 'Building' },
  { id: 'client_review', label: 'Your review' },
  { id: 'delivered', label: 'Delivered' },
  { id: 'closed', label: 'Closed' },
];

const ITEM_STATUS = { planned: 'Planned', in_progress: 'In progress', done: 'Done' };

function when(iso) {
  const d = new Date(iso);
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function size(n) {
  if (n > 1024 * 1024) return (n / 1024 / 1024).toFixed(1) + ' MB';
  return Math.max(1, Math.round(n / 1024)) + ' KB';
}

export function StageTrack({ stage }) {
  const idx = STAGES.findIndex((s) => s.id === stage);
  return (
    <ol className="stage-track" aria-label="Project stage">
      {STAGES.slice(0, 6).map((s, i) => (
        <li key={s.id} className={i < idx ? 'is-done' : i === idx ? 'is-now' : ''} aria-current={i === idx ? 'step' : undefined}>
          <span className="stage-dot" />
          <span className="stage-label">{s.label}</span>
        </li>
      ))}
    </ol>
  );
}

// The shared project window used by clients (viewer="client") and by Jeremy (viewer="jeremy").
export default function ProjectView({ project, viewer, onSend, adminPanel }) {
  const [tab, setTab] = useState('messages');
  const [body, setBody] = useState('');
  const [files, setFiles] = useState([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const threadEnd = useRef(null);
  const fileInput = useRef(null);
  const filesById = Object.fromEntries(project.files.map((f) => [f.id, f]));

  useEffect(() => {
    if (tab === 'messages') threadEnd.current?.scrollIntoView({ block: 'nearest' });
  }, [project.messages.length, tab]);

  async function send(e) {
    e.preventDefault();
    if (!body.trim() && files.length === 0) return;
    setSending(true);
    setError('');
    try {
      await onSend(body, files);
      setBody('');
      setFiles([]);
      if (fileInput.current) fileInput.current.value = '';
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  }

  const tabs = [
    { id: 'messages', label: 'Messages', count: project.messages.length },
    { id: 'updates', label: 'Updates', count: project.updates.length },
    { id: 'items', label: 'Deliverables', count: project.items.length },
    { id: 'files', label: 'Files', count: project.files.length },
  ];

  return (
    <section className="project">
      <header className="project-head">
        <div>
          <p className="project-key">{project.key}</p>
          <h1 className="project-title">{project.title}</h1>
          <p className="project-meta">
            {viewer === 'jeremy' ? `${project.client.name}, ${project.client.email}` : `Opened ${new Date(project.created).toLocaleDateString()}`}
          </p>
        </div>
        <StageTrack stage={project.stage} />
      </header>

      {adminPanel}

      <div className="tabs" role="tablist">
        {tabs.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} className={`tab ${tab === t.id ? 'is-on' : ''}`} onClick={() => setTab(t.id)}>
            {t.label} <span className="tab-count">{t.count}</span>
          </button>
        ))}
      </div>

      <div className="tab-panel" role="tabpanel">
        {tab === 'messages' && (
          <>
            <div className="thread">
              {project.messages.length === 0 && <p className="empty">No messages yet. Start the conversation below.</p>}
              {project.messages.map((m) => {
                const mine = m.from === viewer;
                return (
                  <article key={m.id} className={`msg ${mine ? 'msg-mine' : 'msg-theirs'}`}>
                    <p className="msg-meta">{mine ? 'You' : m.author} <span>{when(m.at)}</span></p>
                    {m.body && <p className="msg-body">{m.body}</p>}
                    {m.files?.length > 0 && (
                      <ul className="msg-files">
                        {m.files.map((id) => filesById[id] && (
                          <li key={id}><a href={fileUrl(project.key, id)}>{filesById[id].name}</a></li>
                        ))}
                      </ul>
                    )}
                  </article>
                );
              })}
              <div ref={threadEnd} />
            </div>
            <form className="composer" onSubmit={send}>
              <label className="sr-only" htmlFor="composer-body">Message</label>
              <textarea id="composer-body" rows="3" value={body} onChange={(e) => setBody(e.target.value)}
                placeholder={viewer === 'jeremy' ? `Reply to ${project.client.name}` : 'Write to Jeremy'} />
              <div className="composer-bar">
                <label className="attach">
                  <input ref={fileInput} type="file" multiple onChange={(e) => setFiles([...e.target.files])} />
                  <span>{files.length ? `${files.length} file${files.length > 1 ? 's' : ''} attached` : 'Attach files'}</span>
                </label>
                <button className="btn btn-primary" disabled={sending || (!body.trim() && !files.length)}>
                  {sending ? 'Sending…' : 'Send message'}
                </button>
              </div>
              {error && <p className="form-error" role="alert">{error}</p>}
              <p className="composer-note">
                {viewer === 'jeremy' ? 'The client gets an email with a link back here.' : 'Jeremy gets an email when you send. Files up to 10 MB each.'}
              </p>
            </form>
          </>
        )}

        {tab === 'updates' && (
          <ol className="updates">
            {[...project.updates].reverse().map((u) => (
              <li key={u.id}>
                <p className="update-date">{when(u.at)}</p>
                <h3>{u.title}</h3>
                {u.body && <p>{u.body}</p>}
              </li>
            ))}
          </ol>
        )}

        {tab === 'items' && (
          project.items.length === 0 ? (
            <p className="empty">Deliverables show up here once the scope is agreed.</p>
          ) : (
            <ul className="items">
              {project.items.map((it, i) => (
                <li key={i} className={`item item-${it.status}`}>
                  <span className="item-status">{ITEM_STATUS[it.status]}</span>
                  <div><h3>{it.label}</h3>{it.detail && <p>{it.detail}</p>}</div>
                </li>
              ))}
            </ul>
          )
        )}

        {tab === 'files' && (
          project.files.length === 0 ? (
            <p className="empty">No files yet. Attach one to a message to share it here.</p>
          ) : (
            <ul className="files">
              {[...project.files].reverse().map((f) => (
                <li key={f.id}>
                  <a href={fileUrl(project.key, f.id)}>{f.name}</a>
                  <span>{size(f.size)}, from {f.from === viewer ? 'you' : f.from === 'jeremy' ? 'Jeremy' : project.client.name}, {when(f.at)}</span>
                </li>
              ))}
            </ul>
          )
        )}
      </div>
    </section>
  );
}
