import * as zt from "react";
import * as Z from "react/jsx-runtime";
function createJourneyPad(keys) {
  const pointers = new Map(), keyboard = new Set();
  const sync = () => { keys.current.left = keyboard.has('left') || [...pointers.values()].includes('left'); keys.current.right = keyboard.has('right') || [...pointers.values()].includes('right'); };
  function pressed(root) { if (!root) return; for (const button of root.querySelectorAll('[data-direction]')) button.dataset.pressed = String(keyboard.has(button.dataset.direction) || [...pointers.values()].includes(button.dataset.direction)); }
  function direction(event) { const rect=event.currentTarget.getBoundingClientRect(), x=event.clientX-rect.left, center=rect.width/2; return Math.abs(x-center)<9 ? null : x<center?'left':'right'; }
  return {
    reset(root) { pointers.clear(); keyboard.clear(); keys.current={}; if(root) for(const b of root.querySelectorAll('[data-pressed]')) b.dataset.pressed='false'; },
    down(event) { if(event.pointerType==='mouse'&&event.button!==0)return; event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); pointers.set(event.pointerId,direction(event)); sync(); pressed(event.currentTarget); },
    move(event) { if(!pointers.has(event.pointerId))return; pointers.set(event.pointerId,direction(event)); sync(); pressed(event.currentTarget); },
    up(event) { pointers.delete(event.pointerId); sync(); pressed(event.currentTarget); },
    key(action,down,event) { if(!['Space','Enter'].includes(event.code))return; event.preventDefault(); event.stopPropagation(); if(action==='jump'){if(down&&!event.repeat)keys.current.jump=true;}else{down?keyboard.add(action):keyboard.delete(action);sync();event.currentTarget.dataset.pressed=String(down);} },
    jumpDown(event) { if(event.pointerType==='mouse'&&event.button!==0)return;event.preventDefault();event.currentTarget.setPointerCapture(event.pointerId);keys.current.jump=true;event.currentTarget.dataset.pressed='true'; },
    jumpUp(event) { event.currentTarget.dataset.pressed='false'; },
    jumpCancel(event) { keys.current.jump=false;event.currentTarget.dataset.pressed='false'; }
  };
}
function JourneyEmulatorControls({keys,paused}) {
 const root=zt.useRef(null),pad=zt.useRef(null);if(!pad.current)pad.current=createJourneyPad(keys);const input=pad.current;
 zt.useEffect(()=>{input.reset(root.current);const reset=()=>input.reset(root.current);window.addEventListener('blur',reset);return()=>{reset();window.removeEventListener('blur',reset)}},[paused]);
 const direction=(action,symbol)=>Z.jsx('button',{type:'button',className:'journey-direction','data-direction':action,'aria-label':`Move ${action}`,'data-pressed':'false',disabled:paused,onKeyDown:event=>input.key(action,true,event),onKeyUp:event=>input.key(action,false,event),onBlur:event=>input.key(action,false,{...event,code:'Space',preventDefault(){},stopPropagation(){}}),children:Z.jsx('span',{'aria-hidden':true,children:symbol})});
 return Z.jsxs('div',{ref:root,className:'journey-controls journey-emulator-controls',children:[Z.jsxs('div',{className:'journey-thumb-zone',children:[Z.jsxs('div',{className:'journey-thumb-pad',onPointerDown:paused?undefined:input.down,onPointerMove:input.move,onPointerUp:input.up,onPointerCancel:input.up,onLostPointerCapture:input.up,children:[direction('left','◀'),Z.jsx('span',{className:'journey-pad-center','aria-hidden':true}),direction('right','▶')]}),Z.jsx('small',{children:'HOLD / SLIDE'})]}),Z.jsxs('small',{className:'journey-control-hint',children:['MOVE + JUMP TOGETHER',Z.jsx('br',{}),'A / D or ← / → · Space jumps · P pauses',Z.jsx('br',{}),'Lanterns save your place.']}),Z.jsxs('div',{className:'journey-jump-zone',children:[Z.jsxs('button',{type:'button',className:'journey-jump-button','aria-label':'Jump','data-pressed':'false',disabled:paused,onPointerDown:input.jumpDown,onPointerUp:input.jumpUp,onPointerCancel:input.jumpCancel,onLostPointerCapture:input.jumpUp,onKeyDown:event=>input.key('jump',true,event),onKeyUp:event=>input.key('jump',false,event),children:[Z.jsx('span',{'aria-hidden':true,children:'A'}),Z.jsx('small',{children:'JUMP'})]}),Z.jsx('small',{children:'TAP TO LEAP'})]})]});
}
function useJourneyEmulatorView(root,enabled) {
 const [expanded,setExpanded]=zt.useState(false),[fullscreen,setFullscreen]=zt.useState(false),[notice,setNotice]=zt.useState(''),[viewport,setViewport]=zt.useState(null);
 const ownsFullscreen=()=>!!root.current&&(document.fullscreenElement===root.current||document.webkitFullscreenElement===root.current);
 function exitFullscreen(){const exit=document.exitFullscreen||document.webkitExitFullscreen;if(ownsFullscreen()&&exit){try{Promise.resolve(exit.call(document)).catch(()=>{});}catch{}}}
 zt.useEffect(()=>{if(!enabled)return;const mountedElement=root.current;const update=()=>{setFullscreen(ownsFullscreen());},resize=()=>{const v=window.visualViewport;setViewport({height:Math.round(v?.height||window.innerHeight),top:Math.round(v?.offsetTop||0)});};update();resize();document.addEventListener('fullscreenchange',update);document.addEventListener('webkitfullscreenchange',update);window.addEventListener('resize',resize);window.visualViewport?.addEventListener('resize',resize);window.visualViewport?.addEventListener('scroll',resize);return()=>{if(mountedElement&&(document.fullscreenElement===mountedElement||document.webkitFullscreenElement===mountedElement)){const exit=document.exitFullscreen||document.webkitExitFullscreen;try{if(exit)Promise.resolve(exit.call(document)).catch(()=>{});}catch{}}document.removeEventListener('fullscreenchange',update);document.removeEventListener('webkitfullscreenchange',update);window.removeEventListener('resize',resize);window.visualViewport?.removeEventListener('resize',resize);window.visualViewport?.removeEventListener('scroll',resize);}},[enabled]);
 const restore=()=>{exitFullscreen();setExpanded(false);setNotice('');};
 const toggleExpand=()=>{expanded||fullscreen?restore():(setExpanded(true),setNotice(''));};
 async function toggleFullscreen(){if(ownsFullscreen()){exitFullscreen();return;}setExpanded(true);setNotice('');const element=root.current,request=element?.requestFullscreen||element?.webkitRequestFullscreen;if(!request){setNotice('Expanded view is on. Browser fullscreen is unavailable here.');return;}try{await request.call(element);}catch{setNotice('Expanded view is on. Your browser kept its controls visible.');}}
 const controls=Z.jsxs('div',{className:'journey-view-actions',children:[Z.jsx('button',{type:'button',className:'btn btn-ghost','aria-pressed':expanded||fullscreen,onClick:toggleExpand,children:expanded||fullscreen?'Restore view':'Expand view'}),Z.jsx('button',{type:'button',className:'btn btn-ghost','aria-pressed':fullscreen,onClick:toggleFullscreen,children:fullscreen?'Exit fullscreen':'Fullscreen'})]});
 return {expanded:expanded||fullscreen,fullscreen,notice,controls,restore,style:enabled&&(expanded||fullscreen)&&viewport&&!fullscreen?{'--journey-view-height':`${viewport.height}px`,'--journey-view-top':`${viewport.top}px`}:{}};
}

export {createJourneyPad,JourneyEmulatorControls,useJourneyEmulatorView};
