import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import Arcade from './Arcade.jsx';
import Admin from './Admin.jsx';
import './arcade.css';

// #/admin is the admin page; everything else (including #/play/<game>) is the arcade.
function App() {
  const [admin, setAdmin] = useState(() => window.location.hash.startsWith('#/admin'));
  useEffect(() => {
    const on = () => setAdmin(window.location.hash.startsWith('#/admin'));
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  useEffect(() => {
    document.body.classList.toggle('is-admin', admin);
    document.title = admin ? 'Admin | jerm747.games' : 'jerm747.games | Games and game designs by Jerm747';
  }, [admin]);
  return admin ? <Admin /> : <Arcade />;
}

createRoot(document.getElementById('root')).render(<StrictMode><App /></StrictMode>);
