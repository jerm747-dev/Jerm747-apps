/* Two image layers; only the next approved portrait is decoded ahead of a fade. */
window.createGSFMenuCarousel=function(root,roster){
 const view=root.querySelector('.gs-title-view'),gallery=document.createElement('div');
 gallery.className='gs-menu-gallery';gallery.setAttribute('aria-hidden','true');
 gallery.innerHTML='<div class="gs-gallery-frame" data-side="left"><img alt=""><span></span></div><div class="gs-gallery-frame" data-side="right"><img alt=""><span></span></div>';
 view.prepend(gallery);
 const frames=[...gallery.children];let active=false,timer=0,index=-1,slot=1,generation=0;
 const slides=roster.map(f=>({id:f.id,color:f.energy.color,src:f.portrait.body}));
 // The action illustration joins the entire 14-fighter rotation.
 slides.unshift({id:'Akeem',color:'#70e7eb',src:'menu-art/akeem-vwave.png',action:true});
 const reduced=()=>root.dataset.reduced==='true'||root.dataset.effects==='off';
 async function advance(){
  if(!active||document.hidden)return;const token=generation;
  const next=(index+1)%slides.length,s=slides[next],image=new Image();image.src=s.src;
  try{await image.decode();}catch{if(token===generation&&active){index=next;schedule();}return;}
  if(token!==generation||!active)return;
  index=next;slot=1-slot;const frame=frames[slot];frame.classList.remove('is-visible');
  frame.style.setProperty('--gallery-color',s.color);frame.dataset.action=String(!!s.action);frame.querySelector('img').src=s.src;frame.querySelector('span').textContent=s.id.toUpperCase();
  gallery.dataset.fighter=s.id;
  requestAnimationFrame(()=>{if(token!==generation||!active)return;frames[1-slot].classList.remove('is-visible');frame.classList.add('is-visible');});
  if(!reduced())schedule();
 }
 function schedule(){clearTimeout(timer);timer=setTimeout(advance,5600);}
 function sync(show){if(show===active)return;active=show;generation++;clearTimeout(timer);if(active){if(index<0)advance();else if(!reduced())schedule();}}
 document.addEventListener('visibilitychange',()=>{clearTimeout(timer);if(!document.hidden&&active&&!reduced())schedule();});
 return {sync,get fighter(){return slides[index]?.id;}};
};
