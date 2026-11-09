(() => {
'use strict';
const $=s=>document.querySelector(s);
const expressions=[
 [42,23,545,575,'Nige looks calmly toward the party.'],
 [660,22,551,576,'His eyebrows lift and his eyes widen.'],
 [43,640,546,585,'His eyes go huge and his jaw drops.'],
 [665,644,553,581,'His eyes soften into a relieved smile.']
];
const lines=[
 ['NIGE HOOD','Hold up…','Is that music?'],['NIGE HOOD','Huh?','Wait, I know those faces.'],
 ['NIGE HOOD','Oh, shoot!',''],['THE WHOLE ROOFTOP','Surprise!','Welcome back to the team, Nige! This one’s for Returnity.'],
 ['NIGE HOOD','Y’all got me.','All this for my return album? Man, it’s good to be back.']
];
const stills=[
 ['party-offer-v11.webp','The MC extends the gold mic to Nige. Their hands have not touched. The DJ holds one headphone to her ear.','01 / THE INVITATION','“Care to start us off, Nige?”','The MC holds out the mic. The whole roof goes quiet.','Take the stage →'],
 ['party-show-v11.webp','Nige performs with the gold mic while the MC and the rooftop crowd cheer.','02 / LIVE ON THE ROOF','“This one’s for the team.”','The first verse of Returnity rings out over the block.','Open my collection →']
];
function mount(engine,record,race,story,afterParty){
 const modal=$('#ending'),reaction=$('#reaction'),go=$('#join-party'),next=$('#scene-next');
 const face=new Image();face.src='assets/party-reactions-v11.webp';
 const art=stills.map(([file])=>{const im=new Image();im.src='assets/'+file;return im});
 const mic=new Image();mic.src='assets/gold-mic-v11.webp';
 let faceIndex=-1,lastResult=null;
 const showModal=()=>{if(!modal.open)modal.showModal()};
 function drawFace(){
  if(faceIndex<0||!face.complete||!face.naturalWidth)return;
  const [x,y,w,h,label]=expressions[faceIndex],c=$('#reaction-face'),ctx=c.getContext('2d');
  ctx.clearRect(0,0,c.width,c.height);const k=c.height*.99/h;
  ctx.drawImage(face,x,y,w,h,(c.width-w*k)/2,c.height-h*k,w*k,h*k);c.setAttribute('aria-label',label);
 }
 face.onload=drawFace;
 function beat(i){
  $('#pause').disabled=true;$('#instructions').disabled=true;$('.deck').inert=true;
  $('#viewport').classList.add('ending-active');
  if(i<=4){
   reaction.hidden=false;reaction.dataset.beat=i;
   faceIndex=[0,1,2,2,3][i];drawFace();
   const [by,line,sub]=lines[i];$('#reaction-by').textContent=by;$('#reaction-line').textContent=line;$('#reaction-sub').textContent=sub;
   go.hidden=i!==4;if(i===4)go.focus({preventScroll:true});return;
  }
  reaction.hidden=true;const [,alt,kicker,title,copy,cta]=stills[i-5];
  showStill(art[i-5].src,alt,kicker,title,copy,cta);
 }
 function showStill(src,alt,kicker,title,copy,cta){
  const img=$('#scene-image');img.src=src;img.alt=alt;
  $('#scene-kicker').textContent=kicker;$('#end-title').textContent=title;$('#scene-line').textContent=copy;
  next.textContent=cta;$('#story-still').hidden=false;$('#run-results').hidden=true;modal.dataset.view='cinema';modal.setAttribute('aria-labelledby','end-title');
  showModal();next.focus({preventScroll:true});
 }
 function breakfast(beat){
  $('#pause').disabled=true;$('#instructions').disabled=true;$('.deck').inert=true;
  $('#end-venue').textContent='THE ROOFTOP CAFÉ';$('#end-folio').textContent='AFTER HOURS  /  05';
  const reply=beat===1;
  showStill('assets/party-breakfast-v12.webp','The café host offers bagels while Nige warms his hands around a cup of coffee beneath the rooftop canopy.',
   reply?'NIGE HOOD   /   AFTER PARTY COMPLETE':'CAFÉ HOST   /   FIRST LIGHT',
   reply?'“Yeah. Finally I return.”':'“You back already?”',
   reply?'The night ends over coffee.':'The host sets a fresh bagel on the counter.',
   reply?'Back to collection →':'Answer →');
 }
 function itemArt(index){
  if(index===-1){const im=document.createElement('img');im.src=mic.src;im.alt='';return im;}
  const c=document.createElement('canvas');c.width=c.height=120;StreetArt.merchIcon(c.getContext('2d'),index,60,60,108);return c;
 }
 function complete(){
  if(lastResult)return;const s=engine.state,ms=s.finale.totalMs;
  lastResult=s.afterParty?{best:record.best}:record.finish(s.timed,ms);
  $('#result-kicker').textContent=s.afterParty?'AFTER PARTY   /   COMPLETE':'ENCORE   /   CHAPTER COMPLETE';
  $('#gold-title').replaceChildren(document.createTextNode(s.afterParty?'After hours':'The Gold Mic'),Object.assign(document.createElement('span'),{textContent:'.'}));
  $('#run-results .result-intro p').textContent=s.afterParty?'The sun’s coming up. Here’s what you brought home.':'A little something to take home from Returnity.';

  const items=StreetGame.merch.slice(0,StreetGame.merchTotal(s.afterParty)).map((m,index)=>({name:m.name,got:s.collection.includes(m.id),index}));
  items.splice(3,0,{name:'Gold Mic trophy',got:s.goldMic,index:-1});
  const ring=$('#orbit'),list=$('#finds-list');ring.replaceChildren();list.replaceChildren();ring.classList.toggle('after-hours-finds',s.afterParty);
  items.forEach(({name,got,index},i)=>{
   const node=document.createElement('div');node.className='sleeve-item slot-'+i+(got?'':' missed');
   const item=document.createElement('span');if(got)item.append(itemArt(index));else item.textContent='?';node.append(item);ring.append(node);
   const li=document.createElement('li'),label=document.createElement('span'),status=document.createElement('strong');
   label.textContent=got?name:'Undiscovered item';status.textContent=got?(index===-1?'Awarded':'Found'):'Not found';li.classList.toggle('missed',!got);
   li.append(label,status);list.append(li);
  });
  const li=document.createElement('li'),label=document.createElement('span'),count=document.createElement('strong');
  label.textContent='Merchant coins';count.textContent='◉ '+s.tokens;li.append(label,count);list.append(li);
  $('#time-slip').hidden=!s.timed;
  if(s.timed){
   $('#this-time').textContent=EncoreRecord.format(ms);$('#prior-time').textContent=EncoreRecord.format(lastResult.previous);
   $('#result-verdict').textContent=lastResult.previous===null?'FIRST PERSONAL BEST':lastResult.improved?'NEW PERSONAL BEST':ms===lastResult.previous?'MATCHED YOUR BEST':'TIME TRIAL COMPLETE';
  }
  $('#replay-copy').textContent=(s.timed?'Best: '+EncoreRecord.format(lastResult.best)+'. ':'Race from the café to the party in Time Trial. ')+(lastResult.persistent?'Fastest time stays on this device.':'Storage is unavailable. Your best lasts for this session.');
  if(s.afterParty){
   $('#replay-copy').textContent=record.best===null?'Run it back from the café or try the clock.':'Device best: '+EncoreRecord.format(record.best)+'.';
  }
  $('#race-again').textContent=s.timed?'Race again →':'Try a timed run →';
  $('#story-still').hidden=true;$('#run-results').hidden=false;modal.dataset.view='results';
  modal.setAttribute('aria-labelledby','gold-title');showModal();modal.scrollTop=0;$('#after-party').focus({preventScroll:true});
 }
 function reset(){
  $('#end-venue').textContent='THE LISTENING PARTY';$('#end-folio').textContent='SIDE E  ·  05 / 05';
  $('#night-load-note').hidden=true;$('#after-party').disabled=false;
  if(modal.open)modal.close();reaction.hidden=true;faceIndex=-1;lastResult=null;$('#viewport').classList.remove('ending-active');$('.deck').inert=false;$('#instructions').disabled=false;
 }
 go.onclick=next.onclick=()=>engine.nextScene();
 modal.addEventListener('cancel',e=>e.preventDefault());
 $('#after-party').onclick=afterParty;$('#race-again').onclick=race;$('#story-again').onclick=story;
 return {beat,breakfast,complete,reset};
}
globalThis.EncoreFinale={mount};
})();
