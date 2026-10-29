const PATH = [
  ['Phillip O. Berry Academy of Technology', 'Technology track, graduating with honors and academic awards.'],
  ['North Carolina State University, Raleigh', 'Studied computer and electrical engineering.'],
  ['15 years in enterprise Java and full-stack development', 'Building, upgrading and supporting large production systems, with strong reviews from managers along the way and no gaps in the climb.'],
  ['jerm747.dev', 'Independent development and consulting: the same experience, put to work on your project.'],
];

export default function About() {
  return (
    <main className="about-page">
      <section className="about-hero">
        <div className="wrap about-hero-inner">
          <figure className="portrait about-portrait">
            <img src="/jeremy.jpg" alt="Jeremy Currence" width="480" height="600"
              onError={(e) => { e.currentTarget.remove(); }} />
            <span className="portrait-fallback" aria-hidden="true">JC</span>
          </figure>
          <div>
            <h1>About</h1>
            <p className="about-lead">
              I'm Jeremy Currence, a software engineer in Charlotte, North Carolina. For the last 15 years I've worked in
              enterprise Java and full-stack development, building and maintaining systems that companies depend on every day.
            </p>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap about-cols">
          <div>
            <h2>The path here</h2>
            <ol className="path">
              {PATH.map(([t, d]) => (
                <li key={t}><h3>{t}</h3><p>{d}</p></li>
              ))}
            </ol>
          </div>
          <div className="about-work">
            <h2>How I work</h2>
            <p>
              Your goals set the direction. I bring the engineering experience: client side, server side and database, plus
              the discipline of enterprise work, where systems have to stay up and changes have to be tested.
            </p>
            <p>
              I also use modern AI tools for writing code, testing and analyzing requirements. They let one experienced
              developer move faster and check more, and I review everything before it reaches you.
            </p>
            <p>
              You get one person who understands the whole project, clear updates on your project page, and something you
              can run and own when we're done.
            </p>
            <div className="about-contact">
              <h3>Get in touch</h3>
              <p><a href="mailto:admin@jerm747.dev">admin@jerm747.dev</a></p>
              <div className="btn-row">
                <a className="btn btn-primary" href="#contact">Request a quote</a>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
