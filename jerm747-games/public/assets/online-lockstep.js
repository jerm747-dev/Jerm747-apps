/* v137: six-step ordered input batches. Identical inputs are applied at identical simulation steps. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.Jerm747Lockstep=api;})(typeof window==='object'?window:globalThis,function(){'use strict';
const MOVES=['pHigh','pMid','pLow','kHigh','kMid','kLow','wave'];
function clean(x={}){const n={};for(const k of ['left','right','block','duck','jump'])n[k]=x[k]===true;n.attack=MOVES.includes(x.attack)?x.attack:null;n.moveAxis=Number.isFinite(x.moveAxis)?Math.round(Math.max(-1,Math.min(1,x.moveAxis))*1000)/1000:null;n.tapDirection=[-1,1].includes(x.tapDirection)?x.tapDirection:0;return n;}
function create({role,step,capture,hash,isDone}){
 let frame=0,next=0,received=0,pending=null,latestHash=null,own=new Map,peer=new Map;
 return {
  batch(){if(pending)return pending;if(next-frame>=18||isDone())return null;const first=clean(capture()),frames=Array.from({length:6},(_,i)=>i===0?first:{...first,jump:false,attack:null,tapDirection:0});pending={start:next,frames};return pending;},
  accept(d){if(pending&&d.accepted>=pending.start+6){for(let i=0;i<6;i++)own.set(pending.start+i,pending.frames[i]);next=pending.start+6;pending=null;}for(const x of d.peerFrames||[]){if(x.frame===received){peer.set(received,x.input);received++;}else if(x.frame>received)throw new Error('Missing remote input step.');}},
  advance(limit=1){let n=0;while(n<limit&&!isDone()&&own.has(frame)&&peer.has(frame)){const a=own.get(frame),b=peer.get(frame);step(role==='host'?a:b,role==='host'?b:a);own.delete(frame);peer.delete(frame);frame++;n++;if(frame%120===0||isDone())latestHash={frame,value:hash(),done:isDone()};}return n;},
  request(){return {ack:frame,received,hash:latestHash||undefined};},
  state(){return {frame,next,received,done:isDone(),hash:latestHash,waiting:!own.has(frame)||!peer.has(frame)};}
 };
}
return {create,clean};});
