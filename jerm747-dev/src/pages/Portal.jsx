import { useEffect, useState } from 'react';
import { getProject, sendClientMessage } from '../api.js';
import { normalizeKey, KEY_PATTERN } from '../quote.js';
import ProjectView from '../components/ProjectView.jsx';

export default function Portal({ routeKey }) {
  const [input, setInput] = useState(routeKey || '');
  const [project, setProject] = useState(null);
  const [status, setStatus] = useState(routeKey ? 'loading' : 'idle');
  const [error, setError] = useState('');
  const [lastKey, setLastKey] = useState('');

  useEffect(() => {
    try { setLastKey(localStorage.getItem('j747-last-key') || ''); } catch { /* storage off */ }
  }, []);

  async function load(key) {
    setStatus('loading');
    setError('');
    try {
      const { project } = await getProject(key);
      setProject(project);
      setStatus('ready');
      try { localStorage.setItem('j747-last-key', key); } catch { /* storage off */ }
      if (window.location.hash !== `#/project/${key}`) window.history.replaceState(null, '', `#/project/${key}`);
    } catch (err) {
      setProject(null);
      setStatus('error');
      setError(err.message);
    }
  }

  useEffect(() => {
    const key = normalizeKey(routeKey);
    if (KEY_PATTERN.test(key)) load(key);
    else if (routeKey) { setStatus('error'); setError('That doesn\'t look like a project key. Keys look like J747-7KQ4-M2XD.'); }
  }, [routeKey]);

  function submit(e) {
    e.preventDefault();
    const key = normalizeKey(input);
    if (!KEY_PATTERN.test(key)) {
      setStatus('error');
      setError('Keys look like J747-7KQ4-M2XD. Check the confirmation email from admin@jerm747.dev.');
      return;
    }
    load(key);
  }

  async function onSend(body, files) {
    const { project: next } = await sendClientMessage(project.key, body, files);
    setProject(next);
  }

  if (project) {
    return (
      <main className="page portal">
        <ProjectView project={project} viewer="client" onSend={onSend} />
        <p className="portal-foot">
          Keep your project key private. Anyone with it can open this page. <a href="#/project" onClick={() => setProject(null)}>Open a different project</a>
        </p>
      </main>
    );
  }

  return (
    <main className="page portal">
      <section className="key-entry">
        <h1>Check your project</h1>
        <p>Enter the project key from your confirmation email to see messages, updates, deliverables and files.</p>
        <form onSubmit={submit} className="key-form">
          <label className="sr-only" htmlFor="key">Project key</label>
          <input id="key" value={input} onChange={(e) => setInput(e.target.value)} placeholder="J747-XXXX-XXXX"
            autoComplete="off" autoCapitalize="characters" spellCheck="false" />
          <button className="btn btn-primary" disabled={status === 'loading'}>{status === 'loading' ? 'Opening…' : 'Open project'}</button>
        </form>
        {status === 'error' && <p className="form-error" role="alert">{error}</p>}
        {lastKey && status !== 'loading' && (
          <p className="last-key">Last opened on this device: <button className="link-btn" onClick={() => load(lastKey)}>{lastKey}</button></p>
        )}
        <p className="key-help">No key yet? <a href="#contact">Send a request</a> and you'll get one right away.</p>
      </section>
    </main>
  );
}
