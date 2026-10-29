import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import Sandbox from './Sandbox.jsx';
import './sandbox.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Sandbox />
  </StrictMode>,
);
