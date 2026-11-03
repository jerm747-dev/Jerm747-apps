import { useEffect, useState } from 'react';
import Home from './pages/Home.jsx';
import Portal from './pages/Portal.jsx';
import Admin from './pages/Admin.jsx';
import About from './pages/About.jsx';
import Sites from './pages/Sites.jsx';

function trackView(path) {
  try {
    if (localStorage.getItem('j747-nocount') === '1' || path.startsWith('/#/admin')) return;
    const body = JSON.stringify({ type: 'view', path, ref: document.referrer });
    navigator.sendBeacon?.('/api/track.php', new Blob([body], { type: 'application/json' }));
  } catch { /* offline or blocked */ }
}

// Routes live in the hash (#/project/KEY, #/admin) so the site works as plain files on any host.
// Plain hashes like #contact are section links on the home page.
function parse(hash) {
  if (hash.startsWith('#/project')) return { page: 'project', key: decodeURIComponent(hash.split('/')[2] || '') };
  if (hash.startsWith('#/admin')) return { page: 'admin' };
  if (hash.startsWith('#/about')) return { page: 'about' };
  if (hash.startsWith('#/sites')) {
    const [, , slug = '', token = ''] = hash.split('/');
    return { page: 'sites', slug: decodeURIComponent(slug), token: decodeURIComponent(token) };
  }
  return { page: 'home', anchor: hash.replace('#', '') };
}

export default function App() {
  const [route, setRoute] = useState(() => parse(window.location.hash));

  useEffect(() => {
    const onHash = () => setRoute(parse(window.location.hash));
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    trackView(route.page === 'home' ? '/' : '/#/' + route.page);
  }, [route.page]);

  useEffect(() => {
    if (route.page === 'home' && route.anchor) {
      requestAnimationFrame(() => document.getElementById(route.anchor)?.scrollIntoView());
    } else if (route.page !== 'home') {
      window.scrollTo(0, 0);
    }
    if (route.page === 'sites' && route.slug) return; // the site page sets its own title
    document.title = route.page === 'about' ? 'About | jerm747.dev'
      : route.page === 'sites' ? 'Sites in development | jerm747.dev'
      : route.page === 'project' ? 'Your project | jerm747.dev'
      : route.page === 'admin' ? 'Admin | jerm747.dev'
      : 'jerm747.dev | Custom software and web development';
  }, [route]);

  return (
    <>
      <a className="skip" href="#main-content">Skip to content</a>
      <header className={`topbar ${route.page === 'home' ? 'topbar-home' : ''}`}>
        <div className="wrap topbar-inner">
          <a className="wordmark" href="#">jerm747<span>.dev</span></a>
          <nav aria-label="Main">
            <a className={`nav-sites ${route.page === 'sites' ? 'is-on' : ''}`} href="#/sites" aria-current={route.page === 'sites' ? 'page' : undefined}>Sites</a>
            <a href="#services">Services</a>
            <a href="#packages">Packages</a>
            <a href="#quote">Estimate</a>
            <a href="#/about">About</a>
            <a href="#/project">Your project</a>
            <a className="nav-cta" href="#contact">Request a quote</a>
          </nav>
        </div>
      </header>
      <div id="main-content">
        {route.page === 'home' && <Home />}
        {route.page === 'project' && <Portal routeKey={route.key} />}
        {route.page === 'admin' && <Admin />}
        {route.page === 'about' && <About />}
        {route.page === 'sites' && <Sites slug={route.slug} token={route.token} />}
      </div>
      <footer className="footer">
        <div className="wrap footer-inner">
          <p className="wordmark">jerm747<span>.dev</span></p>
          <p>Freelance development and consulting, Charlotte, NC</p>
          <p><a href="mailto:admin@jerm747.dev">admin@jerm747.dev</a></p>
          <p><a href="#/sites">Sites in development</a></p>
          <p><a href="#/about">About</a></p>
          <p><a href="#/project">Check your project</a></p>
          <p className="copy">© {new Date().getFullYear()} Jeremy Currence</p>
        </div>
      </footer>
    </>
  );
}
