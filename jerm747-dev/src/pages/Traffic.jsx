import { useEffect, useState } from 'react';
import { adminGet, adminPost, noCountOn, setNoCount as saveNoCount } from '../api.js';

function Bars({ data, label, valueKey, format }) {
  const [hover, setHover] = useState(null);
  const max = Math.max(1, ...data.map((d) => d[valueKey]));
  const ticks = max >= 2 ? [0, Math.round(max / 2), max] : [0, max];
  return (
    <figure className="chart">
      <figcaption>{label}</figcaption>
      <div className="chart-body">
        <div className="chart-axis" aria-hidden="true">{[...ticks].reverse().map((t) => <span key={t}>{t}</span>)}</div>
        <div className="chart-plot" onMouseLeave={() => setHover(null)}>
          {ticks.slice(1).map((t) => <div key={t} className="chart-grid" style={{ bottom: `${(t / max) * 100}%` }} />)}
          {data.map((d, i) => (
            <div key={i} className="chart-col" onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)} tabIndex={0}
              aria-label={`${format(d)}: ${d[valueKey]}`}>
              <div className="chart-bar" style={{ height: `${(d[valueKey] / max) * 100}%` }} />
            </div>
          ))}
          {hover !== null && (
            <div className="chart-tip" style={{ left: `${((hover + 0.5) / data.length) * 100}%` }}>
              <strong>{data[hover][valueKey]}</strong> {format(data[hover])}
              {data[hover].visitors !== undefined && <span>{data[hover].visitors} visitors</span>}
            </div>
          )}
        </div>
      </div>
      <div className="chart-x" aria-hidden="true">
        <span>{format(data[0])}</span><span>{format(data[data.length - 1])}</span>
      </div>
    </figure>
  );
}

function Ranked({ title, items, empty }) {
  const max = Math.max(1, ...items.map((i) => i.count));
  return (
    <section className="ranked">
      <h3>{title}</h3>
      {items.length === 0 ? <p className="empty">{empty}</p> : (
        <ol>
          {items.map((i) => (
            <li key={i.name}>
              <span className="ranked-name">{i.name}</span>
              <span className="ranked-bar"><span style={{ width: `${(i.count / max) * 100}%` }} /></span>
              <span className="ranked-n">{i.count}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

const fmtDay = (d) => new Date(d.date + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
const fmtHour = (d) => {
  const h = Number(d.hour.slice(11, 13));
  return `${h % 12 || 12} ${h < 12 ? 'am' : 'pm'}`;
};

export default function Traffic({ pw }) {
  const [days, setDays] = useState(30);
  const [stats, setStats] = useState(null);
  const [settings, setSettings] = useState(null);
  const [msg, setMsg] = useState('');
  const [preview, setPreview] = useState('');
  const [noCount, setNoCount] = useState(noCountOn);

  useEffect(() => {
    adminGet(pw, { action: 'stats', days }).then((d) => setStats(d.stats)).catch((e) => setMsg(e.message));
  }, [pw, days]);
  useEffect(() => {
    adminGet(pw, { action: 'settings' }).then((d) => setSettings(d.settings)).catch((e) => setMsg(e.message));
  }, [pw]);

  const setHours = async (h) => {
    try { const d = await adminPost(pw, 'settings', { report_hours: String(h) }); setSettings(d.settings); setMsg(h ? `Reports every ${h} hours.` : 'Reports turned off.'); }
    catch (e) { setMsg(e.message); }
  };
  const sendNow = async () => {
    try { const d = await adminPost(pw, 'report_test'); setPreview(d.preview); setMsg(d.sent ? 'Report sent to admin@jerm747.dev.' : "The server couldn't send email. Here's what it would say."); }
    catch (e) { setMsg(e.message); }
  };
  const toggleNoCount = () => {
    const next = !noCount;
    setNoCount(next);
    saveNoCount(next);
  };

  if (!stats) return <p className="empty">{msg || 'Loading traffic…'}</p>;
  const t = stats.totals;

  return (
    <div className="traffic">
      <div className="traffic-head">
        <div className="seg" role="group" aria-label="Date range">
          {[7, 30, 90].map((d) => <button key={d} className={d === days ? 'is-on' : ''} onClick={() => setDays(d)}>{d} days</button>)}
        </div>
      </div>

      <dl className="tiles">
        <div><dt>Visitors, last 24 hours</dt><dd>{t.visitors24}</dd></div>
        <div><dt>Page views, last 24 hours</dt><dd>{t.views24}</dd></div>
        <div><dt>Visitors, {days} days</dt><dd>{t.visitors}</dd></div>
        <div><dt>New requests</dt><dd>{t.requests}</dd></div>
        <div><dt>Waiting on your reply</dt><dd>{t.waiting}</dd></div>
      </dl>

      <div className="charts">
        <Bars data={stats.daily} valueKey="views" label={`Page views per day, last ${days} days`} format={fmtDay} />
        <Bars data={stats.hourly} valueKey="views" label="Traffic by hour, last 24 hours" format={fmtHour} />
      </div>

      <div className="ranked-grid">
        <Ranked title="Top pages" items={stats.pages} empty="No visits yet." />
        <Ranked title="Came from" items={stats.referrers} empty="No outside links yet. Direct visits don't show here." />
        <Ranked title="Devices" items={stats.devices} empty="No visits yet." />
        <Ranked title="Browsers" items={stats.browsers} empty="No visits yet." />
      </div>

      <section className="admin-block report-settings">
        <h3>Email report</h3>
        <p>A traffic summary sent to admin@jerm747.dev. {settings?.last_report && `Last sent ${new Date(settings.last_report).toLocaleString()}.`}</p>
        <div className="seg" role="group" aria-label="Report frequency">
          {[[12, 'Every 12 hours'], [24, 'Every 24 hours'], [0, 'Off']].map(([h, l]) => (
            <button key={h} className={settings?.report_hours === h ? 'is-on' : ''} onClick={() => setHours(h)}>{l}</button>
          ))}
        </div>
        <div className="btn-row" style={{ marginTop: 12 }}>
          <button className="btn btn-ghost" onClick={sendNow}>Send a report now</button>
        </div>
        {settings && (
          <details className="cron">
            <summary>Make reports arrive on time (cPanel cron job)</summary>
            <p>Reports also go out on the first visit after one is due. For exact timing, add a cron job in cPanel → Cron Jobs, set to run once an hour, with this command:</p>
            <code>{settings.cron_command}</code>
            <p>Or use this private link with an outside cron service:</p>
            <code>{settings.cron_url}</code>
          </details>
        )}
        {preview && <pre className="report-preview">{preview}</pre>}
        <label className="check" style={{ marginTop: 12 }}>
          <input type="checkbox" checked={noCount} onChange={toggleNoCount} />
          <span>Don't count my own visits from this device</span>
        </label>
        {msg && <p className="admin-msg" role="status">{msg}</p>}
      </section>
      <p className="traffic-note">No tracking cookies. Visitors are counted with a hash that resets daily, so nobody is tracked across days and project keys never appear in these numbers.</p>
    </div>
  );
}
