(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const vehicles = {kart:'Chili Pup',gt:'Velvet Fang',hyper:'Cinder Wyvern',f1:'Midnight Talon',ss55:'S.S. 55',brb:'B.R.B. 4×4',pto:'P.T.O.',vipgt:'V.I.P. GT',wipsm:'W.I.P. SM',ooo:'O.O.O. 1800',iou:'I.O.U. V4',ptar:'P.T.A. R'};
  let result;
  try {
    const envelope = JSON.parse(new URLSearchParams(location.hash.slice(1)).get('r'));
    if (GPFinish.valid(envelope?.row) && Object.hasOwn(vehicles,envelope.row.vehicle) && envelope.balance && Number.isSafeInteger(envelope.balance.cr) && Number.isSafeInteger(envelope.balance.gp)) result = envelope;
  } catch {}
  const preview = !result;
  result ||= {row:{id:'preview',gp:375,cr:37,laps:3,bonus:true,elapsed:194.82,fastest:62.48,vehicle:'f1',circuit:'Coatl Canyon Raceway',transmission:'automatic'},balance:{cr:187,gp:1875},saved:false};
  const {row}=result;
  window.GPFinishVehicle = row.vehicle;
  document.querySelector('.stage').dataset.body = ['ptar','iou','wipsm','ooo'].includes(row.vehicle) ? 'bike' : 'car';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  function clock(seconds) {
    const ticks=Math.round(seconds*100);
    if (!Number.isFinite(ticks) || ticks<0) return '—';
    return Math.floor(ticks/6000)+':'+String(Math.floor(ticks/100)%60).padStart(2,'0')+'.'+String(ticks%100).padStart(2,'0');
  }
  $('previewTag').hidden=!preview;
  $('vehicle').textContent=vehicles[row.vehicle];
  $('fallbackCar').src=(['f1','kart'].includes(row.vehicle) ? 'finish/parked-' : 'cars/thumbs/')+row.vehicle+'.webp';
  $('trackName').textContent=row.circuit;
  $('raceTime').textContent=clock(row.elapsed); $('bestTime').textContent=clock(row.fastest);
  $('gpRule').textContent=row.bonus?'Personal best · 1.25×':'3 laps × 100 GP';
  $('storageNote').hidden=preview||result.saved;
  if(!preview&&!result.saved) $('balanceTitle').textContent='Race credits';
  function updateTotal(){
    if(!preview&&result.saved){try{const saved=localStorage.getItem(GPFinish.prefix+row.id);if(saved)result.balance=GPFinish.total();}catch{}}
    $('careerGP').textContent=(!preview&&!result.saved?'This race · ':'Career · ')+result.balance.gp.toLocaleString()+' GP';
  }
  const outs=[$('gpValue'),$('creditValue'),$('balanceValue')];
  const beats=outs.map((_,i)=>$('beat'+i));
  let token=0;
  function write(i,value){
    const v=(i<2?'+':'')+value.toLocaleString();outs[i].textContent=v;outs[i].classList.toggle('long',v.length>7);
  }
  function sequence(){
    updateTotal();
    const generation=++token,epoch=performance.now(),values=[row.gp,row.cr,result.balance.cr],from=[0,0,Math.max(0,result.balance.cr-row.cr)];
    const delays=[330,1600,2650],durations=[980,680,900];
    beats.forEach((b,i)=>{b.classList.toggle('waiting',!reduced);write(i,from[i])});
    $('confetti').replaceChildren();
    if(!reduced) for(let i=0;i<27;i++){
      const foil=document.createElement('i');foil.className='foil';foil.style.left=((i*37+3)%100)+'%';
      foil.style.setProperty('--tint',['#faca46','#eeefeb','#c4984e'][i%3]);
      foil.style.setProperty('--delay',((i*13%90)/100)+'s');foil.style.setProperty('--seconds',(2.2+(i%7)*.24)+'s');
      foil.style.setProperty('--drift',(i%2?1:-1)*(15+(i*19%85))+'px');$('confetti').append(foil);
    }
    function tick(now){
      if(generation!==token)return;
      const time=now-epoch;
      for(let i=0;i<3;i++){
        const f=reduced?1:Math.max(0,Math.min(1,(time-delays[i])/durations[i]));
        if(f>0)beats[i].classList.remove('waiting');
        write(i,Math.round(from[i]+(values[i]-from[i])*(1-Math.pow(1-f,3))));
      }
      if(!reduced && time<delays[2]+durations[2])requestAnimationFrame(tick);
      else $('summary').textContent='Race cleared. '+row.gp+' GP points, '+row.cr+' boost credits. Credit balance '+values[2]+'.';
    }
    requestAnimationFrame(tick);
  }
  let pending=0;
  addEventListener('storage',e=>{if(!preview&&e.key?.startsWith(GPFinish.prefix)){
    clearTimeout(pending);pending=setTimeout(()=>{updateTotal();write(2,result.balance.cr);},3700);
  }});
  const repo=row.variant==='repo';
  function navigate(path){
    const url=new URL(path,location.href);url.searchParams.set('mode','arcade');url.searchParams.set('transmission',row.transmission==='manual'?'manual':'automatic');
    if(path==='race.html')url.searchParams.set('car',row.vehicle);
    location.assign(url.href);
  }
  if(preview) $('again').textContent='Replay tally';
  $('again').onclick=()=>preview?sequence():navigate('race.html');
  $('next').onclick=()=>navigate(repo?'index.html#mode':'index.html#setup');
  if(repo){$('next').textContent='Main menu';$('extra').hidden=false;}
  $('ride').onclick=()=>navigate('showroom.html');$('track').onclick=()=>navigate('tracks.html');
  const actions=Array.from(document.querySelectorAll('nav button,#extra button')).filter(b=>b.getClientRects().length);
  const move=n=>{const current=actions.indexOf(document.activeElement);actions[(Math.max(0,current)+n+actions.length)%actions.length].focus();};
  addEventListener('keydown',e=>{if(e.repeat)return;if(['ArrowLeft','ArrowUp','ArrowRight','ArrowDown'].includes(e.key)){
    e.preventDefault();move(['ArrowRight','ArrowDown'].includes(e.key)?1:-1);
  }else if(e.key==='Escape')$('next').click();});
  let old=null,device=null;
  function pad(){
    let g;try{g=Array.from(navigator.getGamepads?.()||[]).find(p=>p?.connected);}catch{}
    if(g&&!document.hidden){
      const p=i=>!!g.buttons[i]?.pressed;
      const current=[p(0)||p(9),p(1),p(12)||p(14)||g.axes[0]<-.6||g.axes[1]<-.6,p(13)||p(15)||g.axes[0]>.6||g.axes[1]>.6];
      if(old&&device===g.index){if(current[2]&&!old[2])move(-1);if(current[3]&&!old[3])move(1);if(current[1]&&!old[1])$('next').click();else if(current[0]&&!old[0])(actions.includes(document.activeElement)?document.activeElement:$('again')).click();}
      old=current;device=g.index;
    }else{old=null;device=null;}
    requestAnimationFrame(pad);
  }
  sequence();requestAnimationFrame(pad);
})();
