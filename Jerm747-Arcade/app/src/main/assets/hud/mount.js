'use strict';
/* Embed the offline visor in an existing HTML game or cabinet WebView. */
window.Jerm747HUD=(()=>{
  const assets=new URL('.',document.currentScript.src);
  const allowed=new Set(['game','title','cabinet']);
  function mount(surface,options={}){
    if(!(surface instanceof HTMLElement))throw new TypeError('Pass the game surface element.');
    const url=new URL('index.html',assets);
    let context=options.context||'game',gameId=String(options.gameId||'game');
    if(!allowed.has(context))throw new TypeError('Use game, title, or cabinet.');
    url.search=new URLSearchParams({embed:'1',v:'workshop-1',context,game:gameId});
    if(!document.querySelector('link[data-j747-hotkey]')){
      const css=document.createElement('link');css.rel='stylesheet';css.href=new URL('hotkey.css?v=workshop-1',assets);
      css.dataset.j747Hotkey='';document.head.append(css);
    }
    const layer=document.createElement('div'),frame=document.createElement('iframe');
    layer.style.cssText='position:absolute;inset:0;z-index:var(--jerm747-hud-z,99);pointer-events:none;';
    if(surface===document.body){layer.style.position='fixed';layer.style.zIndex='10000';}
    const frost=document.createElement('div');frost.className='j747-scene-frost';frost.hidden=true;
    const launcher=document.createElement('button'),image=document.createElement('img');
    launcher.type='button';launcher.className='j747-hotkey';image.alt='';
    image.draggable=false;launcher.append(image);launcher.classList.add('j747-hotkey-direct');if(surface===document.body)launcher.style.position='fixed';
    frame.title='Jerm747 Arcade Settings';frame.allow='accelerometer; gyroscope; gamepad; fullscreen';
    frame.allowFullscreen=true;frame.tabIndex=-1;frame.style.cssText='color-scheme:dark;position:absolute;inset:0;width:100%;height:100%;border:0;background:transparent;visibility:hidden;pointer-events:none;';
    let ready=false,isOpen=false,queuedPanel=null,visible=true,enabled=true,destroyed=false,returnFocus=null;
    const origin=url.origin,target=origin==='null'?'*':origin;
    function send(action,extra={}){
      frame.contentWindow?.postMessage({channel:'jerm747-host',action,context,gameId,...extra},target);
    }
    let placing=false,cabinetPositioned=false;
    const blocked=new Map();
    function unblock(){
      for(const [el,wasInert] of blocked)el.inert=wasInert;
      blocked.clear();
    }
    function display(open){
      if(open&&!isOpen){
        for(const el of surface.children){
          if(el===layer||el===launcher)continue;
          blocked.set(el,el.inert);el.inert=true;
        }
      }else if(!open&&isOpen)unblock();
      isOpen=open;frost.hidden=!open;
      frame.style.visibility=open?'visible':'hidden';frame.style.pointerEvents=open?'auto':'none';
      frame.setAttribute('aria-hidden',String(!open));frame.tabIndex=open?0:-1;
      const movedCabinet=context==='cabinet'&&cabinetPositioned&&visible;
      const preview=open&&placing;
      surface.classList.toggle('j747-cabinet-positioned',enabled&&movedCabinet);
      launcher.hidden=!enabled||(open?!preview:context==='cabinet'&&!movedCabinet);
      launcher.classList.toggle('j747-placement-preview',preview);
      launcher.inert=preview;
      launcher.tabIndex=preview?-1:0;
      image.src=new URL(visible?'icons/hud-overlay.svg':'icons/hud-gear.svg',assets);
      launcher.dataset.gear=String(!visible);launcher.title=visible?'Open HUD menu':'HUD overlay settings';
      launcher.setAttribute('aria-label',launcher.title);
    }
    function open(panel='main'){
      if(destroyed||isOpen||!enabled)return;
      cancelDrag();returnFocus=document.activeElement;queuedPanel=panel;
      if(!ready)return;
      options.onOpening?.();display(true);frame.focus();
      // The underlying game canvas is sampled locally when the page permits it.
      try{
        const source=options.getScene?.();
        const stage=frame.contentDocument?.getElementById('stage');
        if(stage&&source)stage.dispatchEvent(new CustomEvent('hud:scene-frame',{detail:{source}}));
      }catch{/* The transparent lens and local contrast backing remain available. */}
      send('open',{panel:queuedPanel,menu:options.getMenu?.()});queuedPanel=null;
    }
    const safeBounds=document.createElement('div');
    safeBounds.className='j747-hotkey-bounds';layer.append(safeBounds);
    let drag=null,holdTimer=null,suppressClickUntil=0;
    function cancelDrag(){
      clearTimeout(holdTimer);holdTimer=null;
      if(drag?.active)suppressClickUntil=performance.now()+600;
      drag=null;launcher.classList.remove('is-moving');
    }
    function moveIcon(event){
      if(!drag?.active)return;
      const rect=safeBounds.getBoundingClientRect();
      const position={
        x:Math.max(0,Math.min(1,(event.clientX-drag.offsetX-rect.left)/Math.max(1,rect.width))),
        y:Math.max(0,Math.min(1,(event.clientY-drag.offsetY-rect.top)/Math.max(1,rect.height)))
      };
      launcher.style.setProperty('--hud-x',position.x);launcher.style.setProperty('--hud-y',position.y);
      send('place',{position});
    }
    function beginDrag(event){
      if(event.button!==0||!event.isPrimary||isOpen||!ready)return;
      const box=launcher.getBoundingClientRect();
      drag={id:event.pointerId,x:event.clientX,y:event.clientY,offsetX:event.clientX-box.x-box.width/2,offsetY:event.clientY-box.y-box.height/2,active:false};
      launcher.setPointerCapture(event.pointerId);
      holdTimer=setTimeout(()=>{
        if(!drag)return;
        drag.active=true;suppressClickUntil=performance.now()+600;
        launcher.classList.add('is-moving');
        window.EncoreAndroid?.rumble?.(12,40);
      },350);
    }
    launcher.addEventListener('pointerdown',beginDrag);
    launcher.addEventListener('pointermove',event=>{
      if(!drag||event.pointerId!==drag.id)return;
      if(!drag.active&&Math.hypot(event.clientX-drag.x,event.clientY-drag.y)>12){cancelDrag();suppressClickUntil=performance.now()+600;return;}
      if(drag.active){event.preventDefault();moveIcon(event);}
    });
    launcher.addEventListener('pointerup',event=>{
      if(event.pointerId!==drag?.id)return;
      moveIcon(event);cancelDrag();
    });
    for(const type of ['pointercancel','lostpointercapture'])launcher.addEventListener(type,cancelDrag);
    launcher.addEventListener('contextmenu',event=>event.preventDefault());
    window.addEventListener('blur',cancelDrag);
    const onLauncher=()=>{if(performance.now()<suppressClickUntil)return;open(visible?'main':'overlay');};
    const onCabinet=()=>{if(context==='cabinet')open();};
    const fullState=()=>{if(ready)send('fullscreen-state',{active:options.isFullscreen?.()??!!document.fullscreenElement});};
    function receive(e){
      if(e.source!==frame.contentWindow||e.origin!==origin||e.data?.channel!=='jerm747-hud')return;
      const m=e.data;
      if(m.action==='ready'){
        ready=true;send('context');fullState();if(queuedPanel)open(queuedPanel);return;
      }
      if(m.action==='fullscreen'){
        try{
          const result=options.onFullscreen?options.onFullscreen():document.fullscreenElement?document.exitFullscreen():surface.requestFullscreen?.();
          Promise.resolve(result).then(fullState).catch(()=>{});
        }catch{/* Native hosts may manage their own fullscreen UI. */}
        return;
      }
      if(m.position&&Number.isFinite(m.position.x)&&Number.isFinite(m.position.y)){
        launcher.style.setProperty('--hud-x',m.position.x);launcher.style.setProperty('--hud-y',m.position.y);
      }
      placing=!!m.placing;cabinetPositioned=!!m.cabinetPositioned;visible=m.visible!==false;
      if(m.action==='state'){display(isOpen);return;}
      if(m.action==='open'){display(true);options.onOpen?.({context,gameId});return;}
      if(!['start','resume','title','cabinet','close','command'].includes(m.action))return;
      context=allowed.has(m.context)?m.context:context;display(false);
      if(returnFocus?.isConnected&&returnFocus!==document.body&&returnFocus.getClientRects().length)returnFocus.focus({preventScroll:true});
      else if(context==='cabinet')options.cabinetButton?.focus({preventScroll:true});
      else launcher.focus({preventScroll:true});
      options.onAction?.(m.action,{context,gameId,command:m.command});
    }
    launcher.addEventListener('click',onLauncher);
    options.cabinetButton?.addEventListener('click',onCabinet);
    window.addEventListener('message',receive);document.addEventListener('fullscreenchange',fullState);
    display(false);layer.append(frost,frame);frame.src=url;surface.append(layer,launcher);
    return {
      open,input(key){if(isOpen)send('input',{key});},
      enable(on){enabled=on;display(isOpen);},
      back(){if(queuedPanel&&!isOpen){queuedPanel=null;options.onAction?.('close',{context,gameId});return true;}if(!isOpen)return false;send('back');return true;},
      setContext(next,id=gameId){
        if(!allowed.has(next))throw new TypeError('Unknown HUD context.');
        cancelDrag();context=next;gameId=String(id);display(isOpen);if(ready)send('context');
      },
      get isOpen(){return isOpen||!!queuedPanel;},
      destroy(){
        destroyed=true;cancelDrag();window.removeEventListener('blur',cancelDrag);unblock();surface.classList.remove('j747-cabinet-positioned');window.removeEventListener('message',receive);document.removeEventListener('fullscreenchange',fullState);
        options.cabinetButton?.removeEventListener('click',onCabinet);layer.remove();launcher.remove();
      }
    };
  }
  return {mount};
})();
