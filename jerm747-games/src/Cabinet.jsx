import { cabinetArt } from './cabinet-art.js';

const crews = {
  left: ['OG Jerm', 'Kiana', 'Jado', 'Eli'],
  right: ['Shadow', 'Akeem', 'Nika', 'Billie'],
};

function Wing({ side, project }) {
  const art = project?.cover || cabinetArt[side];
  return (
    <aside className={`cabinet-wing cabinet-wing--${side} ${art ? 'has-art' : ''}`} aria-label={project ? `${project.title} cabinet artwork` : `${side} character panel`}>
      {art && <img className="cabinet-wing-art" src={art} alt={project ? `${project.title} cover` : crews[side].join(', ')} />}
      <div className="cabinet-wing-grain" aria-hidden="true" />
      <span className="cabinet-wing-number" aria-hidden="true">{side === 'left' ? '01' : '02'}</span>
      <span className="cabinet-wing-word" aria-hidden="true">{side === 'left' ? 'PLAY' : 'CREATE'}</span>
      <div className="cabinet-wing-caption">
        <span className="cabinet-eyebrow">{project ? 'Now playing' : 'The Jerm747 universe'}</span>
        {project ? <strong>{project.title}</strong> : <><strong className="cabinet-home-title">{side === 'left' ? 'Groove Squad' : 'GS Fighter'}</strong><ul className="sr-only">{crews[side].map(name => <li key={name}>{name}</li>)}</ul></>}
        <span className="cabinet-wing-rule" aria-hidden="true" />
        <span className="cabinet-wing-small">Games. Characters. New worlds.</span>
      </div>
    </aside>
  );
}

export default function Cabinet({ children, project }) {
  return (
    <div className={`cabinet ${project ? 'cabinet--playing' : ''}`}>
      <header className="cabinet-marquee">
        <span className="cabinet-speaker" aria-hidden="true" />
        <a href="/" className="cabinet-logo" aria-label="Jerm747.games home">JERM<span>747</span><b>.GAMES</b></a>
        <span className="cabinet-speaker" aria-hidden="true" />
        <p>Independent games &amp; game design</p>
      </header>
      <Wing side="left" project={project} />
      <div className="cabinet-bezel"><div className="cabinet-screen">{children}</div></div>
      <Wing side="right" project={project} />
      <div className="cabinet-deck" aria-hidden="true">
        <span className="cabinet-deck-label">JERM747 • ORIGINAL PLAY</span>
        <span className="cabinet-deck-line" /><i /><i /><i />
        <span className="cabinet-deck-label">FREE TO EXPLORE</span>
      </div>
    </div>
  );
}
