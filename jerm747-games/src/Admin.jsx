import { useEffect, useState } from 'react';
import { adminStatus, adminSetup, adminGet } from './api.js';
import Traffic from './Traffic.jsx';
import PadIcon from './PadIcon.jsx';

export default function Admin() {
  const [pw, setPwState] = useState(() => { try { return sessionStorage.getItem('j747-admin') || ''; } catch { return ''; } });
  const [setupDone, setSetupDone] = useState(null);
  const [input, setInput] = useState('');
  const [error, setError] = useState('');

  const setPw = (v) => {
    setPwState(v);
    try { v ? sessionStorage.setItem('j747-admin', v) : sessionStorage.removeItem('j747-admin'); } catch { /* storage off */ }
  };

  useEffect(() => { adminStatus().then((d) => setSetupDone(d.setup)).catch((e) => setError(e.message)); }, []);

  async function signIn(e) {
    e.preventDefault();
    setError('');
    try {
      if (!setupDone) { await adminSetup(input); setSetupDone(true); }
      await adminGet(input, { action: 'settings' });
      setPw(input);
      setInput('');
    } catch (err) { setError(err.message); }
  }

  return (
    <div className="admin-shell">
      <header className="sb-top">
        <a className="sb-brand" href="/"><PadIcon /><span>jerm747<b>.games</b></span><span className="sb-sub">Admin</span></a>
        <div className="sb-status">
          <a className="sb-btn" href="/">Arcade</a>
          {pw && <button className="sb-btn" onClick={() => setPw('')}>Sign out</button>}
        </div>
      </header>
      <main className="admin-main">
        {!pw ? (
          <section className="admin-login">
            <h1>{setupDone === false ? 'Set your admin password' : 'Admin'}</h1>
            <p>{setupDone === false
              ? 'First visit: choose a password of 12 or more characters. Set it right after uploading the site.'
              : 'Sign in to see visitors, plays and report settings.'}</p>
            <form onSubmit={signIn} className="admin-form">
              <label className="sr-only" htmlFor="pw">Password</label>
              <input id="pw" type="password" value={input} onChange={(e) => setInput(e.target.value)}
                autoComplete={setupDone === false ? 'new-password' : 'current-password'} />
              <button className="sb-launch">{setupDone === false ? 'Set password' : 'Sign in'}</button>
            </form>
            {error && <p className="form-error" role="alert">{error}</p>}
          </section>
        ) : (
          <>
            <h1 className="admin-title">Traffic</h1>
            <Traffic pw={pw} />
          </>
        )}
      </main>
    </div>
  );
}
