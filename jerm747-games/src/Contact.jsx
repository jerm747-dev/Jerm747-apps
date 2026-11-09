import Cabinet from './Cabinet.jsx';
import PadIcon from './PadIcon.jsx';
import SiteRibbons from './components/SiteRibbons.jsx';

// Change this if the games site gets its own inbox.
const EMAIL = 'jerm@jerm747.com';

/** #/contact — reach Jerm747, plus banners to jerm747.com and jerm747.dev */
export default function Contact() {
  return (
    <Cabinet>
      <div className="sb gc">
        <header className="sb-top">
          <a className="sb-brand" href="#/">
            <PadIcon />
            <span>jerm747<b>.games</b></span>
            <span className="sb-sub">Contact</span>
          </a>
          <div className="sb-status">
            <a className="sb-btn" href="#/">← Back to games</a>
          </div>
        </header>

        <main className="gc-main">
          <p className="gc-eyebrow">Contact</p>
          <h1 className="gc-title">Say hello</h1>
          <p className="gc-lead">
            Played something you liked, found a bug, or have an idea for a game? Send me a message.
          </p>

          <section className="gc-card" aria-label="Email">
            <div>
              <span className="gc-label">Email</span>
              <a className="gc-email" href={`mailto:${EMAIL}?subject=${encodeURIComponent('Hello from jerm747.games')}`}>{EMAIL}</a>
            </div>
            <a className="sb-btn gc-send" href={`mailto:${EMAIL}?subject=${encodeURIComponent('Hello from jerm747.games')}`}>Send an email</a>
          </section>

          <SiteRibbons current="games" />
        </main>
      </div>
    </Cabinet>
  );
}
