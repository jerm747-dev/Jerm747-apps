import { useState } from 'react';
import { submitRequest } from '../api.js';
import { PROJECT_TYPES, money } from '../quote.js';

const EMAIL = 'admin@jerm747.dev';

export default function ContactForm({ attached, onDetach }) {
  const [form, setForm] = useState({ name: '', email: '', company: '', type: '', budget: '', timeline: '', message: '', website: '' });
  const [state, setState] = useState({ status: 'idle', error: '', key: '' });
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const estimateText = attached
    ? `${attached.type.label}, ${attached.pace.label} pace: ${money(attached.price[0])}–${money(attached.price[1])}, about ${attached.fraction.label} of a working year, ${attached.weeks[0]}–${attached.weeks[1]} weeks`
    : '';

  async function onSubmit(e) {
    e.preventDefault();
    setState({ status: 'sending', error: '', key: '' });
    const payload = { ...form, type: form.type || attached?.type.label || '', estimate: estimateText };
    try {
      const { key } = await submitRequest(payload);
      try { localStorage.setItem('j747-last-key', key); } catch { /* storage off */ }
      setState({ status: 'sent', error: '', key });
    } catch (err) {
      setState({ status: 'error', error: err.message, key: '' });
    }
  }

  function mailtoFallback() {
    const body = [
      `Name: ${form.name}`, `Email: ${form.email}`, `Company: ${form.company}`,
      `Type: ${form.type || attached?.type.label || ''}`, `Budget: ${form.budget}`, `Timeline: ${form.timeline}`,
      estimateText ? `Estimate: ${estimateText}` : '', '', form.message,
    ].filter((l) => l !== null).join('\n');
    return `mailto:${EMAIL}?subject=${encodeURIComponent('Project request from ' + (form.name || 'jerm747.dev'))}&body=${encodeURIComponent(body)}`;
  }

  if (state.status === 'sent') {
    return (
      <div className="sent">
        <h3>Request sent</h3>
        <p>Your project key is</p>
        <p className="key-display">{state.key}</p>
        <p>It's also in the confirmation email headed to {form.email}. Use it any time to see messages, updates and files for this project.</p>
        <div className="btn-row">
          <a className="btn btn-primary" href={`#/project/${state.key}`}>Open your project page</a>
          <button type="button" className="btn btn-ghost" onClick={() => navigator.clipboard?.writeText(state.key)}>Copy key</button>
        </div>
      </div>
    );
  }

  return (
    <form className="contact-form" onSubmit={onSubmit} noValidate>
      {attached && (
        <div className="attached">
          <p><strong>Estimate attached:</strong> {estimateText}</p>
          <button type="button" className="link-btn" onClick={onDetach}>Remove</button>
        </div>
      )}
      <div className="field-row">
        <label className="field"><span>Your name</span><input required value={form.name} onChange={set('name')} autoComplete="name" /></label>
        <label className="field"><span>Email</span><input required type="email" value={form.email} onChange={set('email')} autoComplete="email" /></label>
      </div>
      <div className="field-row">
        <label className="field"><span>Company or project name <em>optional</em></span><input value={form.company} onChange={set('company')} autoComplete="organization" /></label>
        <label className="field"><span>Type of work</span>
          <select value={form.type || attached?.type.label || ''} onChange={set('type')}>
            <option value="">Choose one</option>
            {PROJECT_TYPES.map((t) => <option key={t.id}>{t.label}</option>)}
            <option>Not sure yet</option>
          </select>
        </label>
      </div>
      <div className="field-row">
        <label className="field"><span>Budget</span>
          <select value={form.budget} onChange={set('budget')}>
            <option value="">Choose a range</option>
            <option>Under $5,000</option><option>$5,000–$15,000</option><option>$15,000–$40,000</option>
            <option>$40,000–$80,000</option><option>$80,000+</option><option>Monthly retainer</option><option>Not sure yet</option>
          </select>
        </label>
        <label className="field"><span>When do you need it?</span>
          <select value={form.timeline} onChange={set('timeline')}>
            <option value="">Choose a timeframe</option>
            <option>Flexible</option><option>Within 3 months</option><option>Within 1 month</option><option>Hard deadline (I'll explain)</option>
          </select>
        </label>
      </div>
      <label className="field">
        <span>What do you need built?</span>
        <textarea required rows="6" value={form.message} onChange={set('message')}
          placeholder="What it should do, who uses it, what you have today (site, designs, data), and any deadline." />
      </label>
      <label className="hp" aria-hidden="true">Website<input tabIndex="-1" autoComplete="off" value={form.website} onChange={set('website')} /></label>

      {state.status === 'error' && (
        <div className="form-error" role="alert">
          <p>{state.error}</p>
          <p>You can also <a href={mailtoFallback()}>send it from your email app</a> instead.</p>
        </div>
      )}
      <div className="agreement" id="agreement">
        <p><strong>How I work.</strong> I build with modern tools, including AI models for code generation, testing and analysis of your requirements. They help me understand the scope and keep your project up to date faster. I review and stand behind everything I deliver.</p>
        <p>By sending this request, you agree that what you share here may be processed with those tools to scope and build your project. Please don't include passwords or confidential data; we'll set up a secure way to share those.</p>
      </div>
      <div className="btn-row">
        <button className="btn btn-primary" disabled={state.status === 'sending'} aria-describedby="agreement">
          {state.status === 'sending' ? 'Sending request…' : 'Send request'}
        </button>
        <p className="form-aside">Or email <a href={`mailto:${EMAIL}`}>{EMAIL}</a></p>
      </div>
    </form>
  );
}
