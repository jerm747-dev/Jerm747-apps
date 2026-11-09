import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './theme/theme.css';
import './theme/gear.css';
import './theme/sections.css';

createRoot(document.getElementById('root')).render(<StrictMode><App /></StrictMode>);
