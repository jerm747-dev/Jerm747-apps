/* Diamond Crest → existing playable arena. No fighter or combat replacements. */
(function(){
'use strict';
const params=new URLSearchParams(location.search);
if(params.get('crest')!=='1')return;
const L=window.FighterLab,ids=[params.get('p1'),params.get('p2')];
const valid=ids.every(id=>(window.FighterRoster||[]).some(f=>f.id===id));
const back=()=>{const query=new URLSearchParams({p1:L?.PLAYER||ids[0]||'Akeem',p2:L?.PARTNER||ids[1]||'Nika',haptics:document.getElementById('haptics')?.checked?'1':'0',mode:L?.match.training?'training':'arcade'});window.GSFLoading.navigate('../Fighter-Select.html?'+query.toString());};
const style=document.createElement('style');style.textContent=`
.crest-countdown{position:fixed;inset:0;z-index:140;display:grid;place-items:center;pointer-events:none;overflow:hidden;background:#080c1324}
.crest-countdown strong{font:italic 950 clamp(72px,16vmin,140px)/1 system-ui;color:#fff4d6;text-shadow:0 0 12px #ff943d,0 0 44px #e84b1d;transform:skew(-8deg)}
.crest-countdown::before{content:"";position:absolute;inset:-100%;background:linear-gradient(135deg,transparent 44%,#e83f1212 46%,#ff832266 48%,#fff4c2aa 50%,#ef4b1640 52%,transparent 55%);animation:crest-count-sweep 650ms ease-out 3}
@keyframes crest-count-sweep{from{translate:-45% -45%;opacity:0}20%{opacity:.8}to{translate:45% 45%;opacity:0}}
.crest-entry-error{position:fixed;inset:0;z-index:180;background:#07111d;display:grid;place-content:center;gap:18px;text-align:center;color:#f0ede7;font:16px system-ui;padding:24px}
.crest-entry-error button{padding:12px 25px;background:#b3332c;color:white;border:1px solid #ffb678;border-radius:6px;font:700 15px system-ui}
@media(prefers-reduced-motion:reduce){.crest-countdown::before{display:none}.crest-countdown strong{text-shadow:none}}
`;document.head.append(style);
function fail(error){const panel=document.createElement('section');panel.className='crest-entry-error';panel.setAttribute('role','alert');const heading=document.createElement('strong');heading.textContent='The matchup could not load.';const note=document.createElement('span');note.textContent='Return to fighter select and try again.';const button=document.createElement('button');button.textContent='Fighter select';button.onclick=back;panel.append(heading,note,button);document.body.append(panel);window.GSFLoading.hide().then(()=>button.focus());console.error('Diamond Crest game entry:',error);}
if(!L||!valid){fail(new Error('Invalid fighter selection'));return;}
L.closeTitle(false);L.endMatch();window.GSFPaused=true;
L.selection.open=back;
window.GSFUI?.loading(true,ids);
Promise.all([Promise.all(ids.map(id=>L.ensureRig(id))).then(rigs=>Promise.all(rigs.map(rig=>rig.ready))),window.GSFQuality?.ready]).then(async()=>{
 L.configureMatchup(...ids);L.startMatch(params.get('mode')==='training');window.GSFPaused=true;
 await window.GSFLoading.assets();await window.GSFLoading.hide();window.GSFPaused=false;
 const preview=params.get('postfight');if(['win','lose','draw'].includes(preview)){
  Object.assign(L.match,{state:'over',stateAge:0,winner:preview==='draw'?null:preview==='win'?0:1,wins:preview==='win'?[2,1]:preview==='lose'?[1,2]:[1,1],time:38,round:3});
  window.GSFPostFight.begin({preview:true});return;
 }
 document.title='GS Fighter III · Diamond Crest Match';
 const countdown=document.createElement('div');countdown.className='crest-countdown';countdown.setAttribute('role','status');countdown.setAttribute('aria-live','polite');const digit=document.createElement('strong');digit.textContent='3';countdown.append(digit);document.body.append(countdown);
 setTimeout(()=>digit.textContent='2',650);setTimeout(()=>digit.textContent='1',1300);setTimeout(()=>countdown.remove(),1950);
}).catch(fail);
})();
