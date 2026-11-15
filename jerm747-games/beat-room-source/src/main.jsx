import { StrictMode, useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './theme/theme.css';
import './theme/gear.css';
import './theme/sections.css';
import './theme/synth.css';
import './theme/lab.css';
import { installBackKey } from './engine/backkey.js';
installBackKey();

function BeatRoomEntry(){
  const [started,setStarted]=useState(false);
  useEffect(()=>{
    if(started||window.parent!==window)return;
    let frame=0,held=false;
    const poll=()=>{let down=false;try{down=Array.from(navigator.getGamepads?.()||[]).some(p=>p?.buttons[9]?.pressed)}catch{}
      if(down&&!held)setStarted(true);held=down;frame=requestAnimationFrame(poll)};
    frame=requestAnimationFrame(poll);return()=>cancelAnimationFrame(frame);
  },[started]);
  if(started)return <App />;
  const back=()=>{
    if(window.BeatRoomAndroid?.leaveTitle){window.BeatRoomAndroid.leaveTitle();return}
    if(parent!==window){parent.postMessage({type:'arcade-return'},location.origin);return}
    if(document.referrer && new URL(document.referrer).origin===location.origin){history.back();return}
    location.assign('/'); 
  };
  return <main className="beat-title"><section><small>JERM747</small><h1>Beat Room</h1><div><button id="beat-start" autoFocus onClick={()=>setStarted(true)}>Start</button><button onClick={back}>Back</button></div></section></main>;
}
createRoot(document.getElementById('root')).render(<StrictMode><BeatRoomEntry /></StrictMode>);
