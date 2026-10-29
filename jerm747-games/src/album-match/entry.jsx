import React from 'react';
import {createRoot} from 'react-dom/client';
import AlbumMatch from './AlbumMatch.jsx';
import './standalone.css';
function closeGame(){ if(window.parent!==window)window.parent.location.hash='';else window.location.href='/'; }
createRoot(document.getElementById('album-root')).render(<AlbumMatch member={{id:'og-jerm',name:'OG Jerm'}} image="" onClose={closeGame}/>);
