import circuitBoard from "./ribbon-assets/dev-circuit-board.webp";
import grooveMural from "./ribbon-assets/groove-squad-mural.webp";
import fighterMural from "./ribbon-assets/gs-fighter-mural.webp";
import musicSplash from "./ribbon-assets/music-library-splash.webp";
import "./site-ribbons.css";

/*
  Shared Jerm747 contact ribbons. The same three files go in every site:
    SiteRibbons.jsx, site-ribbons.css, ribbon-assets/
  Each site passes its own key and the ribbon for that site is left out:
    jerm747.com   -> <SiteRibbons current="com" />
    jerm747.dev   -> <SiteRibbons current="dev" />
    jerm747.games -> <SiteRibbons current="games" />
  No icon library needed, so it drops into any React + Vite project.
*/
const RIBBONS = [
  {
    key: "com",
    href: "https://jerm747.com",
    domain: "jerm747.com",
    kicker: "Original music library",
    title: "Your music. Your way.",
    blurb: "Instrumentals and original tracks by Jerm747. Stream the library, build a playlist, meet the Groove Squad.",
    action: "Start listening",
    detail: "Instrumentals / Playlists / Groove Squad",
  },
  {
    key: "dev",
    href: "https://jerm747.dev",
    domain: "jerm747.dev",
    kicker: "Freelance & contract work",
    title: "Need something built?",
    blurb: "Websites, apps, and custom programs. Explore the work and request a quote.",
    action: "Explore & get a quote",
    detail: "Websites / Apps / Custom builds",
  },
  {
    key: "games",
    href: "https://jerm747.games",
    domain: "jerm747.games",
    kicker: "Games & game designs",
    title: "Press start.",
    blurb: "Fighters, flight decks, and puzzles. Step into the Jerm747 arcade.",
    action: "Explore the arcade",
    detail: "Fighters / Flight / Puzzles",
  },
];

function ArrowUpRight() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M7 7h10v10" />
      <path d="M7 17 17 7" />
    </svg>
  );
}

function RibbonArt({ site }) {
  if (site === "com") {
    return <img className="j747-splash" src={musicSplash} width="1600" height="900" alt="" loading="lazy" decoding="async" />;
  }
  if (site === "dev") {
    return <img className="j747-circuit" src={circuitBoard} width="1774" height="887" alt="" loading="lazy" decoding="async" />;
  }
  return (
    <div className="j747-arcade-stage">
      <div className="j747-arcade-plane">
        <div className="j747-arcade-face">
          <div className="j747-mural-panel j747-mural-panel--groove">
            <img src={grooveMural} width="724" height="2172" alt="" loading="lazy" decoding="async" />
          </div>
          <div className="j747-mural-panel j747-mural-panel--fighters">
            <img src={fighterMural} width="724" height="2172" alt="" loading="lazy" decoding="async" />
          </div>
          <div className="j747-arcade-caption">JERM747 <span>ARCADE</span></div>
        </div>
      </div>
    </div>
  );
}

/** Contact-page banners linking to the other Jerm747 sites. Images are bundled locally. */
export default function SiteRibbons({ current = "com", heading = "More from Jerm747" }) {
  const ribbons = RIBBONS.filter((r) => r.key !== current);
  return (
    <section className="site-ribbons" aria-label={heading}>
      <h2 className="contact-h2 j747-ribbons-heading">{heading}</h2>
      <div className="j747-ribbons-list">
        {ribbons.map(({ key, href, domain, kicker, title, blurb, action, detail }) => (
          <article className={`j747-ribbon j747-ribbon--${key}`} key={key}>
            <div className="j747-ribbon-surface">
              <div className="j747-ribbon-art" aria-hidden="true">
                <RibbonArt site={key} />
              </div>
              <div className="j747-ribbon-body">
                <p className="j747-ribbon-kicker"><span aria-hidden="true" />{kicker}</p>
                <h3 className="j747-ribbon-title">{title}</h3>
                <p className="j747-ribbon-blurb">{blurb}</p>
                <a className="j747-ribbon-button" href={href} target="_blank" rel="noopener noreferrer" aria-label={`${action} at ${domain} (opens in a new tab)`}>
                  <span className="j747-button-copy">
                    <span className="j747-button-domain">{domain}</span>
                    <span className="j747-button-action">{action}</span>
                  </span>
                  <span className="j747-button-arrow" aria-hidden="true"><ArrowUpRight /></span>
                </a>
                <p className="j747-ribbon-detail">{detail}<span>Opens a new tab ↗</span></p>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
