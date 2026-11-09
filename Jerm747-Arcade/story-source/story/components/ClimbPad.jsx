import React,{useEffect,useRef} from 'react';
import {dpad,jump} from './padMarkup.js';
// Keep these objects stable. React 19 re-applies dangerouslySetInnerHTML whenever the
// object changes, which swapped in fresh pad buttons on every landing and left the
// listeners below attached to the old, detached ones (controls froze after one jump).
const DPAD_HTML={__html:dpad},JUMP_HTML={__html:jump};
export function ClimbPad({keys,paused}){
 const root=useRef(null);
 useEffect(()=>{
  if(paused)return;
  const node=root.current, pad=node.querySelector('.dpad'), jumpButton=node.querySelector('.arc-jump');
  const lifetime=new AbortController(),options={signal:lifetime.signal},held=new Map();let last=new Set();
  function set(id,actions){if(actions.length)held.set(id,actions);else held.delete(id);const next=new Set([...held.values()].flat());keys.current.left=next.has('left');keys.current.right=next.has('right');if(next.has('jump')&&!last.has('jump'))keys.current.jump=true;last=next;
   for(const el of node.querySelectorAll('[data-key]'))el.classList.toggle('held',next.has(el.dataset.key));
   for(const el of node.querySelectorAll('[data-directions]'))el.classList.toggle('lit',el.dataset.directions.split(' ').every(k=>next.has(k)));
  }
  const point=e=>{const b=pad.getBoundingClientRect(),r=b.width/2;set(e.pointerId,window.EncoreInput.directions(e.clientX-b.left-r,e.clientY-b.top-r,r));};
  pad.addEventListener('pointerdown',e=>{e.preventDefault();pad.setPointerCapture(e.pointerId);point(e);},options);
  pad.addEventListener('pointermove',e=>{if(pad.hasPointerCapture(e.pointerId))point(e);},options);
  jumpButton.addEventListener('pointerdown',e=>{e.preventDefault();jumpButton.setPointerCapture(e.pointerId);set(e.pointerId,['jump']);},options);
  for(const el of [pad,jumpButton])for(const type of ['pointerup','pointercancel','lostpointercapture'])el.addEventListener(type,e=>set(e.pointerId,[]),options);
  for(const b of node.querySelectorAll('[data-key]'))b.addEventListener('click',e=>{if(e.detail===0){set('assist',[b.dataset.key]);setTimeout(()=>{if(!lifetime.signal.aborted)set('assist',[]);},130);}},options);
  return ()=>{lifetime.abort();held.clear();set('clear',[]);};
 },[keys,paused]);
 return <div ref={root} className="deck climb-deck" aria-label="Climb controls"><div className="direction-control" dangerouslySetInnerHTML={DPAD_HTML}/><div className="action-control actionpad" dangerouslySetInnerHTML={JUMP_HTML}/></div>;
}
