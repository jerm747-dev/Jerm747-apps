/* GS Fighter III — production player menu. The preview owns a separate skeleton,
   mixer and scene; it never advances or re-parents the live match rigs. */
(function(){'use strict';
const L=window.FighterLab, S=window.GSFGameShell, T=window.THREE;
if(!L||!S||!window.GSFPlayerMenuMarkup)return;
const host=document.createElement('div');host.innerHTML=window.GSFPlayerMenuMarkup;
const root=host.firstElementChild;document.body.append(root);delete window.GSFPlayerMenuMarkup;
const $=s=>root.querySelector(s), $$=s=>[...root.querySelectorAll(s)],shell=$('.gs-console');
const params=new URLSearchParams(location.search),roster=window.GSFPostFightRoster||[];
let opened=false,screen='fighter',context='match',backTarget='fighter',savedFocus=null,wasPaused=false,inerted=[],draft={},preview=null,previewToken=0,currentMove='mp',returnTitle=false;
let padPrevious=[],padNeutral=false,padRepeat=0,lastFrame=performance.now();
const movement=[
 ['mp','Mid punch','A quick punch from guard.','X / □','Mid punch'],['hp','High punch','A high strike. Finish the motion before linking another attack.','Y / △','High punch'],['lp','Low punch','A compact punch from guard.','LB','Low punch'],
 ['mk','Mid kick','A forward kick combination.','A / ✕','Mid kick'],['hk','High kick','A high kick with a full recovery.','B / ○','High kick'],['lk','Low kick','A close-range kick.','LT','Low kick'],
 ['block','Guard','Hold guard to defend against incoming strikes.','RB','Block'],['walk','Walk','Hold left or right to move.','D-pad / left stick','Move'],['run','Run','Double-tap toward your opponent, then hold.','→ → hold','Move'],
 ['crouch','Crouch','Hold down to crouch.','↓','Crouch'],['up','Jump','Jump straight up. Use a diagonal to jump toward your opponent.','↑','Jump'],['jump','Backflip','Create space with a backflip.','Left stick click','Backflip'],
 ['sweep','Sweep','Hold crouch, then press low kick.','↓ + LT','Low kick'],['jumpkick','Jump kick','Press a kick while airborne.','↑ + kick','High kick'],['airpunch','Air punch','Press a punch while airborne.','↑ + punch','Mid punch'],
 ['vwave','V-Wave','Release a ranged energy blast. Allow the cooldown before casting again.','RT','V-Wave']
];
function fighter(){return roster.find(f=>f.id===(context==='select'?params.get('p1'):L.PLAYER))||roster[0];}
function sound(){if(S.get('menuSounds')!=='false')window.GSFAudio?.ui();}
function focusables(){return $$('button:not(:disabled),select,input,summary,a[href]').filter(e=>e.getClientRects().length&&!e.closest('[hidden]'));}
function focusFirst(){(screen==='title'?$('[data-mode="arcade"]'):screen==='fighter'?$('.gs-resume'):screen==='moves'?$('.gs-move[aria-pressed="true"]'):$('[data-option][aria-selected="true"]'))?.focus({preventScroll:true});}
function theme(){const f=fighter();if(!f)return;const color=f.id==='Akeem'?'#70e7eb':f.energy.color;
 root.style.setProperty('--gs-fighter-accent',color);root.style.setProperty('--gs-fighter-rgb',color.slice(1).match(/../g).map(v=>parseInt(v,16)).join(','));shell.dataset.fighter=f.id;
 $('#gs-hero').src=f.portrait.body;$('#gs-hero').alt=f.id+' fighter artwork';$('.gs-fighter-copy h1').textContent=f.id.toUpperCase();$('.gs-fighter-copy').dataset.longName=String(f.id.length>6);
 $('.gs-fighter-copy>.gs-eyebrow').textContent='FIGHTER FILE / '+String(roster.indexOf(f)+1).padStart(2,'0');$('.gs-lead').textContent=f.id==='Akeem'?'Find your rhythm.':f.subtitle;
 $('#gs-player-label').textContent='P1 / '+f.id.toUpperCase();$('.gs-nav-context .gs-small').textContent=L.match.training?'TRAINING':'ARCADE';$('#gs-footer-right').textContent=f.id.toUpperCase()+' / PLAYER 1';
 $('[data-view="moves"] .gs-eyebrow').textContent=f.id.toUpperCase()+' / MOVE GUIDE';$('.gs-move-list').setAttribute('aria-label',f.id+' moves');$('#gs-rig').setAttribute('aria-label',f.id+' move demonstration');
}
function effects(){root.dataset.effects=S.get('menuEffects');root.dataset.reduced=String(S.get('reducedMotion')==='true'||matchMedia('(prefers-reduced-motion: reduce)').matches);}
function show(view){if(!opened)return;screen=view;shell.dataset.screen=view;$$('[data-view]').forEach(e=>e.hidden=e.dataset.view!==view);$$('.gs-nav-item[data-screen]').forEach(e=>{if(e.dataset.screen===view)e.setAttribute('aria-current','page');else e.removeAttribute('aria-current');});
 $('#gs-screen-title').textContent=view==='title'?'CHOOSE YOUR MODE':view==='moves'?'MOVE GUIDE':view==='options'?'OPTIONS':'PLAYER MENU';
 $('#gs-state').textContent=context==='match'?'MATCH PAUSED':context==='select'?'FIGHTER SELECT':'READY TO FIGHT';
 if(view==='options'){readSettings();}if(view==='moves'){buildMoves();playMove(currentMove);}else previewToken++;
 root.scrollTop=0;requestAnimationFrame(focusFirst);
}
function open(view,origin){if(window.GSFPostFight?.active)return;if(opened){if(view)show(view);return;}
 opened=true;context=origin||(L.match.active?'match':'title');backTarget=context==='match'?'fighter':'title';returnTitle=L.titleOpen;
 savedFocus=document.activeElement;wasPaused=!!window.GSFPaused;window.GSFPaused=true;L.clearInput();S.releasePad();padNeutral=false;padPrevious=[];
 root.hidden=false;shell.dataset.context=context;document.body.classList.add('player-menu-open');
 inerted=[...document.body.children].filter(e=>e!==root&&!['SCRIPT','STYLE','LINK'].includes(e.tagName)).map(e=>[e,e.inert]);for(const [e]of inerted)e.inert=true;
 theme();effects();show(view||(context==='match'?'fighter':'options'));sound();
}
function close(){if(!opened)return;opened=false;previewToken++;root.hidden=true;document.body.classList.remove('player-menu-open');for(const [e,prev]of inerted)e.inert=prev;inerted=[];L.clearInput();S.releasePad();window.GSFPaused=wasPaused;S.activity();savedFocus?.focus?.({preventScroll:true});sound();}
function select(mode=L.match.training?'training':'arcade'){
 close();L.endMatch();const q=new URLSearchParams({p1:L.PLAYER,p2:L.PARTNER,mode,haptics:S.get('haptics')==='true'?'1':'0'});location.assign('../Fighter-Select.html?'+q);
}
function title(){close();window.GSFPaused=false;L.openTitle();}
function back(){if(context==='select'){returnSelect();return;}if(screen==='moves'){show('fighter');return;}if(screen==='options'){
 if(context==='match'){show('fighter');return;}if(returnTitle){close();return;}show('title');return;
 }if(screen==='title'){title();return;}close();}
function returnSelect(){close();const q=new URLSearchParams();for(const key of ['p1','p2','mode','layout','locks'])if(params.has(key))q.set(key,params.get(key));q.set('haptics',S.get('haptics')==='true'?'1':'0');location.assign('../Fighter-Select.html?'+q);}
function readSettings(){draft={};$$('[data-setting]').forEach(e=>{const key=e.dataset.setting,v=S.get(key);draft[key]=v;if(e.type==='checkbox')e.checked=v==='true';else e.value=v;const o=e.closest('label').querySelector('output');if(o)o.textContent=v+'%';});const quality=$('[data-setting=quality]');for(const option of quality.options)option.disabled=GSFQuality.presets[option.value].size>GSFQuality.maxTextureSize;$('#gs-settings-status').textContent='Settings ready';renderMap();}
function renderMap(){const keys=S.keyboardMap(draft.keyboard),pads=S.padMap;$('#gs-control-map').replaceChildren();for(const[a,key]of keys){const pad=pads.find(([n])=>n===a)?.[1]||'—';const row=document.createElement('span');row.textContent=a;const b=document.createElement('b');b.textContent=key+' · '+pad;row.append(b);$('#gs-control-map').append(row);}}
function apply(){const oldQuality=S.get('quality');for(const[key,v]of Object.entries(draft))if(key!=='quality'&&S.get(key)!==v)S.set(key,v);effects();$('#gs-settings-status').textContent='Options applied';sound();if(draft.quality!==oldQuality)S.set('quality',draft.quality);}
root.addEventListener('input',e=>{const c=e.target;if(!c.dataset.setting)return;draft[c.dataset.setting]=c.type==='checkbox'?String(c.checked):c.value;const o=c.closest('label').querySelector('output');if(o)o.textContent=c.value+'%';$('#gs-settings-status').textContent='Changes ready to apply';if(c.dataset.setting==='keyboard')renderMap();});
root.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;
 if(b.dataset.screen){const view=b.dataset.screen;if(view==='arena')close();else if(view==='select')select();else if(view==='title')title();else show(view);sound();}
 if(b.dataset.mode)select(b.dataset.mode);
 if(b.dataset.option){$$('[data-option]').forEach(t=>t.setAttribute('aria-selected',String(t===b)));$$('.gs-settings').forEach(p=>p.hidden=p.id!=='gs-'+b.dataset.option);sound();}
 if(b.dataset.move){currentMove=b.dataset.move;playMove(currentMove);sound();}
});
$('#gs-footer-back').onclick=back;$('#gs-moves-back').onclick=()=>show('fighter');$('#gs-options-back').onclick=back;$('#gs-apply').onclick=apply;$('#gs-fullscreen').onclick=()=>S.fullscreen();$('#gs-sound-test').onclick=()=>{const volume=GSFAudio.volume;GSFAudio.setVolume(Number(draft.volume)/100);GSFAudio.ui();GSFAudio.setVolume(volume);};
// Use native select/range interaction. The focus trap covers every visible control.
addEventListener('keydown',e=>{if(!opened)return;menuInput('keyboard');if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();if(!e.repeat)back();return;}
 if(e.key==='Tab'){e.preventDefault();const list=focusables(),i=list.indexOf(document.activeElement);list[(i+(e.shiftKey?-1:1)+list.length)%list.length]?.focus();e.stopImmediatePropagation();return;}
 const el=document.activeElement,native=['SELECT','INPUT'].includes(el?.tagName);
 if(!native&&['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();moveFocus(e.key==='ArrowUp'||e.key==='ArrowLeft'?-1:1);}
 if(e.key==='Enter'&&!native){e.preventDefault();if(!e.repeat)el?.click?.();}
 e.stopImmediatePropagation();
},true);
function menuInput(type){if(root.dataset.input===type)return;root.dataset.input=type;const cues=$$('.gs-keyboard-cue');cues[0].querySelector('small').textContent=type==='gamepad'?'D-PAD':'ARROWS';cues[1].querySelector('kbd').textContent=type==='gamepad'?'A':'↵';cues[1].querySelector('small').textContent=type==='gamepad'?'CONTROLLER':'ENTER';$('.gs-back-keyboard').textContent=type==='gamepad'?'B':'esc';}
function moveFocus(dir){const list=focusables(),i=list.indexOf(document.activeElement);list[(i+dir+list.length)%list.length]?.focus();sound();}
function padTick(p,dt){menuInput('gamepad');const b=i=>!!p.buttons[i]?.pressed||(p.buttons[i]?.value||0)>.5,now=p.buttons.map((_,i)=>b(i));
 if(!padNeutral){if(!now.some(Boolean)&&!p.axes.some(a=>Math.abs(a)>.45))padNeutral=true;padPrevious=now;return;}
 if(b(9)&&!padPrevious[9]){if(context==='match')close();else back();padPrevious=now;return;}
 if(b(1)&&!padPrevious[1]){back();padPrevious=now;return;}
 const x=p.axes[0]||0,y=p.axes[1]||0,vertical=b(13)||y>.6?1:b(12)||y<-.6?-1:0,horizontal=b(15)||x>.6?1:b(14)||x<-.6?-1:0;padRepeat-=dt;
 if((vertical||horizontal)&&padRepeat<=0){padRepeat=.19;const e=document.activeElement;
 if(horizontal&&e?.tagName==='SELECT'){e.selectedIndex=Math.max(0,Math.min(e.options.length-1,e.selectedIndex+horizontal));e.dispatchEvent(new Event('input',{bubbles:true}));}
 else if(horizontal&&e?.type==='range'){if(horizontal>0)e.stepUp();else e.stepDown();e.dispatchEvent(new Event('input',{bubbles:true}));}
 else moveFocus(vertical||horizontal);
 }if(!vertical&&!horizontal)padRepeat=0;
 if(b(0)&&!padPrevious[0]){const e=document.activeElement;if(e?.tagName==='SELECT'){e.selectedIndex=(e.selectedIndex+1)%e.options.length;e.dispatchEvent(new Event('input',{bubbles:true}));}else e?.click?.();}
 padPrevious=now;
}
function inputFor(m){const keys=S.keyboardMap(),base=keys.find(([a])=>a===m[4])?.[1]||'';return m[0]==='sweep'?'↓ + '+base:m[0]==='jumpkick'||m[0]==='airpunch'?'Jump + '+base:m[0]==='run'?'→ → hold':base;}
function buildMoves(){const defaults=L.defaults[fighter().id]||L.defaults.Akeem;$('.gs-move-list').replaceChildren();for(const m of movement){if(m[0]!=='vwave'&&!defaults[m[0]])continue;const b=document.createElement('button');b.type='button';b.className='gs-move';b.dataset.move=m[0];b.setAttribute('aria-pressed',String(m[0]===currentMove));const span=document.createElement('span');span.textContent=m[1];const k=document.createElement('kbd');k.textContent=m[3];b.append(span,k);$('.gs-move-list').append(b);}}
// Keep the CPU fallback responsive: the fighter remains the real rig, while the
// projectile uses a small geometric silhouette instead of the dense blast mesh.
function compatibilityWave(scene){
 const root=new T.Group(),config={},shots=[];scene.add(root);
 const geo=new T.SphereGeometry(.22,12,8),tail=new T.ConeGeometry(.17,.8,10);tail.rotateZ(Math.PI/2);
 function reset(){for(const shot of shots){root.remove(shot.group);shot.material.dispose();}shots.length=0;}
 return {root,config,reset,launch({x,y,direction=1}){reset();const colors=config.resolveColors?.()||[0x0675f9,0x54faff],material=new T.MeshBasicMaterial({color:colors[1]}),group=new T.Group(),orb=new T.Mesh(geo,material),trail=new T.Mesh(tail,material);trail.position.x=-.45*direction;group.add(orb,trail);group.position.set(x,y,0);root.add(group);shots.push({group,material,age:0,direction});},update(dt){for(const shot of shots){shot.age+=dt;shot.group.position.x+=dt*4*shot.direction;}if(shots[0]?.age>1.3)reset();},get state(){return {shots:shots.map(s=>({age:s.age}))};}};
}
function disposeRig(p){p.rig.mixer.stopAllAction();p.rig.mixer.uncacheRoot(p.rig.root);p.group.remove(p.rig.root);p.rig.skeleton.dispose?.();p.material?.dispose();p.wave.reset();}
async function getPreview(id){const base=await L.ensureRig(id);await base.ready;if(preview?.id===id)return preview;
 if(!preview){const scene=new T.Scene(),camera=new T.PerspectiveCamera(34,1,.01,100);let renderer;
 try{renderer=new T.WebGLRenderer({alpha:true,antialias:true,powerPreference:'low-power'});renderer.isWebGLRenderer=true;renderer.outputEncoding=T.sRGBEncoding;renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setClearColor(0x000000,0);}catch(error){renderer=new FighterCanvasRenderer({alpha:true});renderer.previewFallbackReason=error.message;}
 const group=new T.Group();group.rotation.y=.72;scene.add(group);scene.add(new T.HemisphereLight(0xe2f6ff,0x34455a,1.2));const light=new T.DirectionalLight(0xfff4dc,2);light.position.set(-3,5,5);scene.add(light);const rim=new T.DirectionalLight(0x70e7eb,1.3);rim.position.set(4,3,-3);scene.add(rim);
 const wave=renderer.isFighterCanvasRenderer?compatibilityWave(scene):createVWaveSystem(T,scene);preview={scene,camera,renderer,group,light,rim,wave};$('#gs-rig').replaceChildren(renderer.domElement);
 }else disposeRig(preview);
 const p=preview;p.id=id;p.material=base.mesh.material.clone();p.rig=createFighterRig('Menu_'+id,base.data,{mesh:{geometry:base.mesh.geometry,material:p.material},ready:base.ready});p.group.add(p.rig.root);p.rig.setBlend(.12);p.rig.setSmart(true);
 const d=L.defaults[id];p.rig.play(d.idle[0],{loop:true,root:'pinned',entry:'cycle',instant:true});p.rig.update(.01,d.idle[1]);p.group.updateMatrixWorld(true);p.rig.skeleton.update();
 const bounds=new T.Box3(),v=new T.Vector3(),position=p.rig.mesh.geometry.attributes.position;
 for(let i=0;i<position.count;i+=8){v.fromBufferAttribute(position,i);p.rig.mesh.boneTransform(i,v);bounds.expandByPoint(v);}
 p.height=Math.max(1,bounds.max.y-bounds.min.y);p.center=(bounds.max.y+bounds.min.y)/2;p.rim.color.set(fighter().id==='Akeem'?'#70e7eb':fighter().energy.color);p.wave.config.resolveColors=()=>fighter().energy.colors;
 return p;
}
async function playMove(id){const token=++previewToken,m=movement.find(m=>m[0]===id)||movement[0];currentMove=m[0];$$('[data-move]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.move===currentMove)));
 $('#gs-move-category').textContent=m[1].toUpperCase();$('#gs-move-name').textContent=m[1];$('#gs-move-detail').textContent=m[2];$('#gs-pad-key').textContent=m[3];$('#gs-key').textContent=inputFor(m);$('#gs-motion-state').textContent='LOADING';
 try{const p=await getPreview(fighter().id);if(token!==previewToken||!opened||screen!=='moves')return;
 const d=L.defaults[p.id],source=id==='vwave'?(p.id==='Nika'?'hp':'mp'):id,cfg=d[source]||d.idle,rule={...window.FighterMoveRules[source],...d.rules?.[source]},loop=['walk','run','idle'].includes(id);
 $('#gs-move-name').textContent=id==='vwave'?'V-Wave':cfg[0].replace(/_[0-9]+$/,'').replace(/_/g,' ').replace(/([a-z])([A-Z])/g,'$1 $2');
 p.wave.reset();p.active=id;p.speed=cfg[1];p.age=0;p.released=false;p.done=false;p.hold=['block','crouch'].includes(id);
 p.rig.play(d.idle[0],{loop:true,root:'pinned',entry:'cycle',instant:true});p.rig.update(.01,d.idle[1]);
 p.rig.play(cfg[0],{loop,speed:p.speed,root:rule.root||'anchored',entry:rule.window?'windup':loop?'cycle':'start',window:rule.window,end:rule.end,active:rule.active,hipY:rule.hipY});
 p.release=rule.active||.5;$('.gs-demo-speed').textContent='GAME SPEED · '+p.speed+'×';$('#gs-motion-state').textContent='PLAYING';
 }catch(error){$('#gs-motion-state').textContent='PREVIEW UNAVAILABLE';$('#gs-move-detail').textContent=m[2]+' Preview could not load; select the move to retry.';console.error('Move preview:',error);}
}
$('#gs-replay').onclick=()=>playMove(currentMove);
function frame(now){const dt=Math.min((now-lastFrame)/1000,.05);lastFrame=now;
 if(opened&&screen==='moves'&&preview?.rig&&!document.hidden){const p=preview,box=$('#gs-rig').getBoundingClientRect();if(box.width&&box.height){
 if(p.width!==Math.round(box.width)||p.screenHeight!==Math.round(box.height)){p.width=Math.round(box.width);p.screenHeight=Math.round(box.height);p.renderer.setSize(p.width,p.screenHeight,false);p.camera.aspect=p.width/p.screenHeight;p.camera.updateProjectionMatrix();}
 const distance=p.height*(p.active==='jump'||p.active==='up'?2.4:2.05)/Math.min(1,p.camera.aspect);p.camera.position.set(0,p.center+.15,distance);p.camera.lookAt(0,p.center+.08,0);
 p.rig.update(dt,p.speed||1);p.age+=dt;
 if(p.active==='vwave'&&!p.released&&p.rig.time>=p.release){p.wave.launch({owner:0,x:.5,y:p.center+.2,direction:1});p.released=true;}
 p.wave.update(dt,[],()=>{});
 if(!p.rig.playing&&!p.done){p.done=true;p.finishedAt=p.age;$('#gs-motion-state').textContent=p.hold?'HOLD':'COMPLETE';}
 if(p.done&&!p.hold&&p.age-p.finishedAt>.8){const d=L.defaults[p.id].idle;p.rig.play(d[0],{loop:true,root:'pinned',entry:'cycle',speed:d[1]});p.speed=d[1];p.finishedAt=Infinity;}
 p.rim.visible=window.GSFX.rim;
 // Leave an input-processing interval after a CPU frame, even on slow devices.
 if(!p.renderer.isFighterCanvasRenderer||now-(p.lastRenderEnd||0)>=180){p.renderer.render(p.scene,p.camera);p.lastRenderEnd=performance.now();}
 }}requestAnimationFrame(frame);}
requestAnimationFrame(frame);
$$('.gs-logo').forEach(im=>im.src='menu-logo.png');
window.GSFPlayerMenu={open,close,back,showModes:()=>open('title','title'),padTick,get isOpen(){return opened;},get screen(){return screen;},get preview(){return preview;},get moves(){return movement.map(m=>m[0]);}};
L.selection.open=()=>select(L.match.training?'training':'arcade');
if(params.get('menu')==='options')open('options',params.get('return')==='select'?'select':'title');
})();
