/* Add cabinet navigation only to the game's own title surface. */
(() => {
 const path=location.pathname;
 const routes=[
  [/wave-run-747/,'#menu','#startBtn'],[/cyborg-coliseum/,'#poster','#start'],
  [/flight-control-deck/,'#mission','#mission-start'],[/pulse-runner/,'#selection,#cover','#launch'],
  [/sumi-sudoku/,'#splash','#titleResume'],[/big-bowl-smash/,'#overlay .title-card,#overlay:has(.title-art),#overlay:has(.kick-button)','#go'],
  [/gs-fighter-3|\/gs3\//,'#title-screen','#press-start'],[/gs-fighter-2|groove-squad-get-down/,'#gs-boot,#lobby','#start'],
  [/\/encore\/(?:index.html)?$/,'#sleeve','#press-start'],[/journey/,'#root .chapter-text,.climb-intro','#root button'],
 ];
 const route=routes.find(([r])=>r.test(path));if(!route)return;
 const back=()=>{if(parent!==window){if(parent.Arcade?.returnToCabinet)parent.Arcade.returnToCabinet();else parent.postMessage({type:'arcade-return'},location.origin)}else location.assign('/')};
 const css=document.createElement('style');css.textContent='.j747-title-back{position:absolute!important;top:6px!important;left:6px!important;right:auto!important;bottom:auto!important;z-index:22!important;width:auto!important;height:auto!important;min-height:28px!important;padding:4px 9px!important;background:#172128eb!important;color:#f4fbfb!important;border:1px solid #829395!important;border-radius:5px!important;font:600 12px/1.2 system-ui!important;cursor:pointer!important}';document.head.append(css);
 function mount(){for(const root of document.querySelectorAll(route[1])){if(root.querySelector('.j747-title-back,[data-cabinet-back]')||[...root.querySelectorAll('button,a')].some(e=>/^(back|cabinet|back to (arcade|cabinet|shelf))$/i.test(e.textContent.trim())))continue;
  const b=document.createElement('button');b.type='button';b.className='j747-title-back';b.textContent='‹ Back';b.setAttribute('aria-label','Back to cabinet');b.onclick=e=>{e.stopPropagation();back()};root.append(b);
 }}
 function init(){mount();new MutationObserver(changes=>{if(changes.some(c=>[...c.addedNodes].some(n=>n.nodeType===1&&(n.matches(route[1])||n.querySelector(route[1])))))mount()}).observe(document.body,{subtree:true,childList:true})}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
