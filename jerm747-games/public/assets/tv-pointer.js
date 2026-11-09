/* v139: paired-phone touchpad. Operates the same-origin TV page's actual visible controls. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.Jerm747TVPointer=api;})(typeof window==='object'?window:globalThis,function(){'use strict';
function create(doc,{back=()=>{}}={}){
 const win=doc.defaultView,cursor=doc.createElement('div');cursor.className='tv-phone-cursor';cursor.setAttribute('aria-hidden','true');cursor.hidden=true;cursor.innerHTML='<svg viewBox="0 0 30 38" width="30" height="38"><path d="M3 2L25 22H15L20 33L14 36L9 24L3 30Z" fill="#83f4ff" stroke="#101324" stroke-width="2"/></svg>';doc.body.appendChild(cursor);
 const style=doc.createElement('style');style.textContent='.tv-phone-cursor{position:fixed;z-index:2147483647;pointer-events:none;filter:drop-shadow(0 2px 3px #000);width:30px;height:38px}.tv-phone-cursor[hidden]{display:none!important}.tv-pointer-hover{outline:3px solid #83f4ff!important;outline-offset:2px}';doc.head.appendChild(style);
 let x=.5,y=.5,hover=null,hoverDoc=null;
 function clear(){hover?.classList.remove('tv-pointer-hover');hover=hoverDoc=null;}
 function hit(){let d=doc,px=x*win.innerWidth,py=y*win.innerHeight,element;for(let depth=0;depth<5;depth++){
  element=d.elementFromPoint(px,py);if(element?.tagName!=='IFRAME')break;
  try{const r=element.getBoundingClientRect(),child=element.contentDocument,w=element.contentWindow;if(!child||r.width<=0||r.height<=0)break;px=(px-r.left)*(w.innerWidth||r.width)/r.width;py=(py-r.top)*(w.innerHeight||r.height)/r.height;d=child;}catch{break;}
 }return {doc:d,element,x:px,y:py};}
 function paint(){cursor.style.left=(x*win.innerWidth)+'px';cursor.style.top=(y*win.innerHeight)+'px';const h=hit(),target=h.element?.closest('button,a[href],input,select,textarea,summary,[tabindex]')||h.element;clear();if(target){hover=target;hoverDoc=h.doc;target.classList.add('tv-pointer-hover');}}
 function handle(m){if(!m||typeof m!=='object')return false;const action=m.action;if(action==='hide'){cursor.hidden=true;clear();return true;}if(!['show','move','click','scroll','back'].includes(action))return false;
  if(action==='move'){if(!Number.isFinite(m.dx)||!Number.isFinite(m.dy))return false;x=Math.max(.005,Math.min(.985,x+Math.max(-.2,Math.min(.2,m.dx))));y=Math.max(.005,Math.min(.975,y+Math.max(-.2,Math.min(.2,m.dy))));}
  cursor.hidden=false;paint();
  if(action==='back'){back();return true;}
  if(action==='click'){const h=hit(),target=h.element?.closest('button,a[href],input,select,textarea,summary,[tabindex]')||h.element;if(!target||target.disabled||target.getAttribute('aria-disabled')==='true'||target.closest('[hidden],[inert]'))return false;target.focus?.({preventScroll:true});target.click?.();}
  if(action==='scroll'){if(!Number.isFinite(m.dy))return false;const h=hit(),delta=Math.max(-600,Math.min(600,m.dy));let target=null;for(let n=h.element;n&&n!==h.doc.body;n=n.parentElement)if(n.scrollHeight>n.clientHeight+2&&/(auto|scroll)/.test(h.doc.defaultView.getComputedStyle(n).overflowY)){target=n;break;}if(target)target.scrollBy({top:delta,behavior:'instant'});else h.doc.defaultView.scrollBy({top:delta,behavior:'instant'});}
  return true;
 }
 return {handle,hide:()=>handle({action:'hide'}),state:()=>({x,y,visible:!cursor.hidden}),destroy(){clear();cursor.remove();style.remove();}};
}
return {create};});
