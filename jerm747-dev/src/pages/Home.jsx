import { useState } from 'react';
import CircuitBoard from '../components/CircuitBoard.jsx';
import QuoteEngine from '../components/QuoteEngine.jsx';
import ContactForm from '../components/ContactForm.jsx';

const BUILD = [
  ['Websites', 'Business sites, portfolios and landing pages that load fast and are easy to update.'],
  ['Web apps', 'Accounts, dashboards and tools that do real work in the browser.'],
  ['Server and database', 'APIs, data models and the back end that keeps it all running.'],
  ['Games and media', 'Browser games, music players and interactive pieces.'],
  ['Marketing and entertainment', 'Campaign sites, launches, artist and event pages.'],
  ['Consulting', 'Sorting out hosting, domains, code and tools so your tech works together.'],
];

const OUT_OF_SCOPE = [
  ['Payment processing platforms', 'Card handling needs PCI compliance and ongoing audits. I integrate Shopify, Stripe and similar platforms, which already carry that work.'],
  ['Life-safety and navigation systems', 'Emergency signaling, GPS and satellite systems need certified teams and round-the-clock operations.'],
  ['Defense and high-security programs', 'These call for clearances, secure facilities and dedicated contractors.'],
];

const PACKAGES = [
  { name: 'Launch', share: '1/48 of a year', from: '$2,500', length: '2–3 weeks',
    gets: 'A site of up to five pages, mobile-ready, with a contact form, launched on your domain. Two rounds of changes.' },
  { name: 'Build', share: '1/12 of a year', from: '$10,000', length: '6–10 weeks',
    gets: 'A custom web app or larger site with a database, accounts or an admin area, and a project page to track it all.' },
  { name: 'Platform', share: '1/4 of a year', from: '$30,000', length: 'About a quarter',
    gets: 'A full-stack product: front end, API, database and outside services, released in stages you review.' },
  { name: 'Retainer', share: 'Set hours each month', from: '$1,500 / month', length: 'Month to month',
    gets: '16 hours a month for fixes, features and support. Unused hours don\'t roll over.' },
];

const TERMS = [
  ['Scheduled hours', 'Your project gets a set number of hours each week. You always know where the time goes.'],
  ['Scope changes', 'If the work grows, I stop and send a written change before going further. No surprise invoices.'],
  ['Priority pace', 'Need it sooner? Extended hours are available at a premium, agreed in writing up front.'],
  ['You own it', 'Code, designs and content are yours once the final invoice is paid.'],
  ['Modern tools', 'I build with current frameworks and AI-assisted coding, testing and analysis, so your budget goes further. I review everything before it ships.'],
];

const STEPS = [
  ['Request', 'Send the form below. You get a project key instantly.'],
  ['Scope call', 'A 30-minute call to pin down what you need.'],
  ['Proposal', 'A written quote with deliverables, schedule and price.'],
  ['Build', 'Work in stages, with updates and files on your project page.'],
  ['Handoff', 'Launch, walkthrough and everything you need to own it.'],
];

const scrollTo = (id) => (e) => {
  e.preventDefault();
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
};

export default function Home() {
  const [quote, setQuote] = useState({ typeId: 'webapp', featureIds: ['database'], paceId: 'steady' });
  const [attached, setAttached] = useState(null);

  return (
    <main>
      <section className="hero">
        <CircuitBoard />
        <div className="hero-inner">
          <h1>Custom software, built to spec.</h1>
          <p className="hero-sub">
            Websites, web apps, games and the systems behind them. Client side, server side and database, for small businesses, artists and teams.
          </p>
          <div className="btn-row">
            <a className="btn btn-gold" href="#contact" onClick={scrollTo('contact')}>Request a quote</a>
            <a className="btn btn-outline" href="#/project">Check your project</a>
          </div>
        </div>
      </section>

      <section className="section" id="services">
        <div className="wrap split">
          <div>
            <h2>What I build</h2>
            <dl className="spec-list">
              {BUILD.map(([t, d]) => <div key={t}><dt>{t}</dt><dd>{d}</dd></div>)}
            </dl>
          </div>
          <div className="out-of-scope">
            <h2>Out of scope for a single developer</h2>
            <p className="scope-note">Some systems need full teams, certifications and 24/7 support. They're best handled by specialized firms, and I'm glad to build the website or tools around them.</p>
            <dl className="spec-list">
              {OUT_OF_SCOPE.map(([t, d]) => <div key={t}><dt>{t}</dt><dd>{d}</dd></div>)}
            </dl>
          </div>
        </div>
      </section>

      <section className="section section-alt" id="packages">
        <div className="wrap">
          <h2>Packages</h2>
          <p className="lede">Every project is measured against a full working year of my time. Packages are starting points; the quote engine below gets closer to yours.</p>
          <div className="packages">
            {PACKAGES.map((p) => (
              <article key={p.name} className="package">
                <h3>{p.name}</h3>
                <p className="pkg-share">{p.share}</p>
                <p className="pkg-from"><span>From</span> {p.from}</p>
                <p className="pkg-length">{p.length}</p>
                <p className="pkg-gets">{p.gets}</p>
              </article>
            ))}
          </div>
          <div className="terms">
            <h3>How time works</h3>
            <dl>
              {TERMS.map(([t, d]) => <div key={t}><dt>{t}</dt><dd>{d}</dd></div>)}
            </dl>
          </div>
        </div>
      </section>

      <section className="section" id="quote">
        <div className="wrap">
          <h2>Estimate your project</h2>
          <p className="lede">Answer three questions for a price range and how much of my year it takes.</p>
          <QuoteEngine
            value={quote}
            onChange={setQuote}
            onRequest={(r) => { setAttached(r); document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' }); }}
          />
        </div>
      </section>

      <section className="section section-alt" id="process">
        <div className="wrap">
          <h2>How a project runs</h2>
          <ol className="steps">
            {STEPS.map(([t, d], i) => (
              <li key={t}><span className="step-n">{i + 1}</span><h3>{t}</h3><p>{d}</p></li>
            ))}
          </ol>
        </div>
      </section>

      <section className="section contact" id="contact">
        <div className="wrap contact-wrap">
          <div className="contact-intro">
            <h2>Start a project</h2>
            <p>Tell me what you need. You'll get a project key right away, and a reply within two business days.</p>
            <p>Your key opens a project page with our messages, updates, deliverables and files, so nothing gets lost in an inbox.</p>
            <p className="contact-email">admin@jerm747.dev</p>
          </div>
          <ContactForm attached={attached} onDetach={() => setAttached(null)} />
        </div>
      </section>

      <section className="section about" id="about">
        <div className="wrap about-wrap">
          <figure className="portrait">
            <img src="/jeremy.jpg" alt="Jeremy Currence" width="480" height="600" loading="lazy"
              onError={(e) => { e.currentTarget.parentElement.classList.add('no-photo'); e.currentTarget.remove(); }} />
            <span className="portrait-fallback" aria-hidden="true">JC</span>
          </figure>
          <div>
            <h2>Who's building it</h2>
            <p>
              I'm Jeremy Currence, a software engineer in Charlotte, NC, with 15 years in enterprise Java and full-stack
              development and a background in computer and electrical engineering from NC State.
            </p>
            <p>I write the code myself, keep you posted along the way, and hand over something you can run without me.</p>
            <p><a href="#/about">More about me</a></p>
          </div>
        </div>
      </section>

      <aside className="live-strip">
        <div className="wrap live-inner">
          <span className="live-dot" aria-hidden="true" />
          <p>See what I'm building right now on <a href="https://jerm747.com" target="_blank" rel="noopener">jerm747.com</a>, my music library with games, built in React and updated often.</p>
        </div>
      </aside>
    </main>
  );
}
