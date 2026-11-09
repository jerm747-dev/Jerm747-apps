import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import JapanJourney from './story/components/JapanJourney.jsx';
const jerm={id:'og-jerm',name:'OG Jerm',image:'/images/groove-squad/level9-sprites/og-jerm-reference.webp'};
function Journey(){
 const [level,setLevel]=useState(()=>Math.max(8,Math.min(10,Number(localStorage.getItem('arcade-catalog-chapter'))||8)));
 const [choice,choose]=useState(true);
 function start(n){
  localStorage.setItem('arcade-catalog-chapter',n);
  if(n===10){location.replace('/catalog-clash-level10.html');return;}
  setLevel(n);choose(false);
 }
 React.useEffect(()=>{
  window.arcadeMenuBack=()=>{
   if(choice)return false;
   const previous=document.querySelector('[data-story=back]:not(:disabled), .journey-pause button');
   if(previous)previous.click();else choose(true);
   return true;
  };
  return ()=>{delete window.arcadeMenuBack};
 },[choice]);
 if(choice)return <main className="chapters"><div className="chapter-text"><small>GROOVE SQUAD</small><h1>Catalog Clash</h1><p>From the recording studio to the riverside arena.</p><div>{[[8,'Next stop: Japan'],[9,'Follow Kiana'],[10,'The showdown']].map(([n,title])=><button key={n} onClick={()=>start(n)} autoFocus={n===level}><b>{n}</b>{title}<span>›</span></button>)}</div></div></main>;
 return <JapanJourney key={level} level={level} member={jerm} image={jerm.image} roster={[jerm]} onClose={()=>parent.postMessage({type:'arcade-return'},location.origin)} onNext={()=>start(level+1)}/>;
}
createRoot(document.getElementById('root')).render(<Journey/>);
// Use A to advance dialogue, or jump during the climb. The D-pad and left stick share navigation.
let previous={},raf;
function poll(){
 const p=Array.from(navigator.getGamepads?.()||[]).find(Boolean);
 const down=i=>!!p?.buttons[i]?.pressed, active={left:down(14)||p?.axes[0]<-.45,right:down(15)||p?.axes[0]>.45,up:down(12)||p?.axes[1]<-.5,down:down(13)||p?.axes[1]>.5,a:down(0)};
 const canvas=document.querySelector('.journey-playfield canvas'),climbing=canvas&&!document.querySelector('.journey-pause');
 for(const [action,pressed] of Object.entries(active)){
  if(!!previous[action]===!!pressed)continue;
  if(climbing){const code={left:'ArrowLeft',right:'ArrowRight',a:'Space',up:'ArrowUp'}[action];if(code)canvas.dispatchEvent(new KeyboardEvent(pressed?'keydown':'keyup',{code,key:code==='Space'?' ':code,bubbles:true,cancelable:true}));}
  else if(pressed){const targets=[...document.querySelectorAll('button:not(:disabled)')].filter(b=>b.offsetWidth&&b.offsetHeight);if(action==='a')(targets.includes(document.activeElement)?document.activeElement:targets[0])?.click();else if(targets.length){const step=['up','left'].includes(action)?-1:1;targets[(targets.indexOf(document.activeElement)+step+targets.length)%targets.length].focus();}}
 }
 previous=active;raf=requestAnimationFrame(poll);
}
raf=requestAnimationFrame(poll);window.addEventListener('pagehide',()=>cancelAnimationFrame(raf));
