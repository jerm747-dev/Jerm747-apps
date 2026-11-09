/* v138: keyboard-style TV remotes. No OS key registration; browser-delivered keys only. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.Jerm747TVNavigation=api;})(typeof window==='object'?window:globalThis,function(){'use strict';
const TARGETS='button,a[href],input:not([type="hidden"]),select,textarea,summary,[tabindex]:not([tabindex="-1"]),iframe';
function key(e){const k=e.key||'';return ({Up:'ArrowUp',Down:'ArrowDown',Left:'ArrowLeft',Right:'ArrowRight',Select:'Enter',GoBack:'Back',BrowserBack:'Back',Escape:'Back',Esc:'Back'})[k]||({8:'Backspace',9:'Tab',13:'Enter',27:'Back',33:'PageUp',34:'PageDown',37:'ArrowLeft',38:'ArrowUp',39:'ArrowRight',40:'ArrowDown',461:'Back',10009:'Back',176:'MediaTrackNext',177:'MediaTrackPrevious',179:'MediaPlayPause'})[e.keyCode]||k;}
function create(doc,options={}){
 const win=doc.defaultView,css=()=>{if(doc.getElementById('jerm747-tv-focus-style'))return;const s=doc.createElement('style');s.id='jerm747-tv-focus-style';s.textContent='.tv-remote-focus{outline:4px solid #78f2ff!important;outline-offset:3px!important;box-shadow:0 0 0 7px #131226!important}.tv-website{scroll-padding-top:12px}';doc.head.appendChild(s);};css();
 const usable=el=>{if(!el||!el.isConnected||el.disabled||el.getAttribute('aria-disabled')==='true'||el.closest('[hidden],[inert],[aria-hidden="true"]'))return false;for(let n=el;n&&n.nodeType===1;n=n.parentElement){const style=win.getComputedStyle(n);if(style.display==='none'||style.visibility==='hidden'||style.opacity==='0')return false;}const r=el.getBoundingClientRect();return r.width>0&&r.height>0;};
 function scope(){const list=Array.from(doc.querySelectorAll('[role="dialog"],dialog[open],.menu-panel.is-open,.sheet-layer,.art-view')).filter(usable);const depth=e=>{let z=0;for(let n=e;n&&n!==doc.documentElement;n=n.parentElement)z=Math.max(z,parseInt(win.getComputedStyle(n).zIndex)||0);return z;};return list.sort((a,b)=>depth(a)-depth(b)).pop()||doc.body;}
 function list(s=scope()){return Array.from(s.querySelectorAll(TARGETS)).filter(usable);}
 function mark(el){if(!usable(el))return false;doc.querySelectorAll('.tv-remote-focus').forEach(n=>n.classList.remove('tv-remote-focus'));el.focus({preventScroll:true});el.classList.add('tv-remote-focus');el.scrollIntoView?.({block:'nearest',inline:'nearest',behavior:'instant'});return true;}
 function first(){const nodes=list(),visible=nodes.filter(el=>{const r=el.getBoundingClientRect();return r.bottom>0&&r.top<win.innerHeight&&r.right>0&&r.left<win.innerWidth;});return mark(visible[0]||nodes[0]);}
 function scroll(direction){const vertical=direction==='up'||direction==='down',sign=['up','left'].includes(direction)?-1:1,active=doc.activeElement,s=scope();let target=null;
  const can=n=>n&&n!==doc.body&&(vertical?n.scrollHeight>n.clientHeight+2:n.scrollWidth>n.clientWidth+2)&&/(auto|scroll)/.test(vertical?win.getComputedStyle(n).overflowY:win.getComputedStyle(n).overflowX);
  for(let n=active;n&&s.contains(n);n=n.parentElement)if(can(n)){target=n;break;}
  if(!target){const all=Array.from(s.querySelectorAll('.gm-list,main,[role="listbox"],.tv-overlay,[style*="overflow"]')).filter(can);target=all.sort((a,b)=>b.clientHeight-a.clientHeight)[0];}
  const amount=Math.max(120,Math.min(600,(vertical?(target?.clientHeight||win.innerHeight):(target?.clientWidth||win.innerWidth))*.65))*sign;
  const movement=vertical?{top:amount,left:0,behavior:'instant'}:{left:amount,top:0,behavior:'instant'};if(target)target.scrollBy(movement);else win.scrollBy(movement);return true;
 }
 function adjust(el,dir){if(!['left','right'].includes(dir))return false;const sign=dir==='right'?1:-1;if(el.matches('select')){const opts=Array.from(el.options).filter(o=>!o.disabled),i=opts.findIndex(o=>o.value===el.value),n=opts[Math.max(0,Math.min(opts.length-1,i+sign))];if(n){const set=Object.getOwnPropertyDescriptor(win.HTMLSelectElement.prototype,'value')?.set;if(set)set.call(el,n.value);else el.value=n.value;el.dispatchEvent(new win.Event('change',{bubbles:true}));}return true;}if(el.matches('input[type="range"]')){const min=Number(el.min)||0,max=Number(el.max)||100,step=Number(el.step)||Math.max((max-min)/20,.01),value=Math.max(min,Math.min(max,Number(el.value)+sign*step));Object.getOwnPropertyDescriptor(win.HTMLInputElement.prototype,'value').set.call(el,String(value));el.dispatchEvent(new win.Event('input',{bubbles:true}));el.dispatchEvent(new win.Event('change',{bubbles:true}));return true;}return false;}
 function move(dir){const s=scope(),nodes=list(s),current=doc.activeElement;if(!nodes.includes(current))return first();if(adjust(current,dir))return true;
  const a=current.getBoundingClientRect(),dx=dir==='left'?-1:dir==='right'?1:0,dy=dir==='up'?-1:dir==='down'?1:0;let best=null,cost=Infinity;
  for(const el of nodes){if(el===current)continue;const r=el.getBoundingClientRect(),x=r.left+r.width/2-a.left-a.width/2,y=r.top+r.height/2-a.top-a.height/2,forward=x*dx+y*dy;if(forward<4)continue;const score=forward+Math.abs(x*dy-y*dx)*3;if(score<cost){cost=score;best=el;}}
  if(best){mark(best);if(best.tagName==='IFRAME')options.enterFrame?.(best);return true;}
  if(dir==='up'&&s===doc.body&&win.scrollY<=4){options.onTop?.();return true;}return scroll(dir);
 }
 function activate(){const el=doc.activeElement;if(!usable(el)||!list().includes(el))return first();if(el.tagName==='IFRAME'){options.enterFrame?.(el);return true;}if(el.matches('textarea,input:not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="button"]):not([type="submit"])')){options.say?.('Use your TV keyboard, phone, or another keyboard for text entry.');return true;}if(el.tagName==='SELECT'){options.say?.('Left / right changes this list.');return true;}el.click();return true;}
 function back(){const s=scope();if(s!==doc.body){const close=Array.from(s.querySelectorAll('button')).filter(usable).find(b=>/^(close|cancel|back to|return to|✕|×)/i.test(b.getAttribute('aria-label')||b.textContent.trim()));if(close){close.click();return true;}const esc=new win.KeyboardEvent('keydown',{key:'Escape',code:'Escape',bubbles:true});Object.defineProperty(esc,'__jermTVSynthetic',{value:true});doc.activeElement?.dispatchEvent(esc);if(options.afterEscape?.())return true;}
  options.onBack?.();return true;
 }
 let last=0;
 function handle(e){if(e.__jermTVSynthetic)return false;const k=key(e),active=doc.activeElement,text=active?.matches('textarea,input:not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="button"]):not([type="submit"])');if(text&&k!=='Back'&&k!=='Tab'&&!['PageUp','PageDown'].includes(k))return false;
  const game=win.Jerm747GameControls?.context?.(),live=game?.screen==='fight'&&!game.paused;
  // Once a fight is live, arrows remain the game's keyboard movement. Back can still reach the hub.
  if(live&&k.startsWith('Arrow'))return false;
  const handled=['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Enter','Tab','Back','Backspace','PageUp','PageDown','MediaPlayPause','MediaPlay','MediaPause','MediaTrackNext','MediaTrackPrevious'].includes(k);if(!handled)return false;if(k==='Backspace'&&text)return false;
  e.preventDefault();e.stopImmediatePropagation();if(e.repeat&&!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','PageUp','PageDown'].includes(k))return true;const now=Date.now();if(e.repeat&&now-last<160)return true;last=now;
  if(k.startsWith('Media')){options.media?.(({MediaPlayPause:'toggle',MediaPlay:'play',MediaPause:'pause',MediaTrackNext:'next',MediaTrackPrevious:'previous'})[k]);return true;}
  if(k==='Back'||k==='Backspace')return back();if(k==='Enter')return activate();if(k==='PageUp'||k==='PageDown')return scroll(k==='PageUp'?'up':'down');
  if(k==='Tab'){const nodes=list(),at=nodes.indexOf(active),next=at+(e.shiftKey?-1:1);if((next<0||next>=nodes.length)&&scope()===doc.body&&options.onTop){options.onTop();return true;}return mark(nodes[(next+nodes.length)%nodes.length]);}
  const dir=k.slice(5).toLowerCase();if(options.scrollMode?.()&&['up','down'].includes(dir))return scroll(dir);return move(dir);
 }
 return {usable,scope,list,mark,first,move,scroll,activate,back,handle};
}
return {key,create};});
