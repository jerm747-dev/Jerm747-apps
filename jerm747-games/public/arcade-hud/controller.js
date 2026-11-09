'use strict';
// Poll only while the controller view is visible. This tester reads raw input
// in place so opening it never navigates away from the HUD.
const padPicker=byId('pad-select');
const padStatus=byId('pad-status');
const padReadings=byId('pad-readings');
const standardButtons=['A / Cross','B / Circle','X / Square','Y / Triangle','L1','R1','L2','R2','Select','Start','L3','R3','Up','Down','Left','Right','Home'];
let knownPads='';
function writeIfChanged(node,text){if(node.textContent!==text)node.textContent=text;}
function showPadInput(){
  let pads=[];
  let waiting='Connect a controller and press any button.';
  try{
    if(embeddedVisor&&parent.Arcade)pads=Array.from(parent.Arcade.pads()).filter(pad=>pad?.connected);
    else if(navigator.getGamepads)pads=Array.from(navigator.getGamepads()).filter(pad=>pad?.connected);
    else waiting='This browser does not provide gamepad input.';
  }catch{waiting='Gamepad access is unavailable in this browser view.';}
  const signature=JSON.stringify(pads.map(pad=>[pad.index,pad.id]));
  if(signature!==knownPads){
    const last=padPicker.value;
    padPicker.replaceChildren(...pads.map(pad=>new Option('P'+(pad.index+1)+' · '+pad.id,String(pad.index))));
    if(pads.some(pad=>String(pad.index)===last))padPicker.value=last;
    knownPads=signature;
  }
  padPicker.hidden=pads.length<2;
  const pad=pads.find(item=>String(item.index)===padPicker.value)||pads[0];
  padReadings.hidden=!pad;
  const rumble=byId('pad-rumble');rumble.hidden=!pad;rumble.disabled=!pad?.vibrationActuator?.playEffect;

  writeIfChanged(padStatus,pad?pad.id:waiting);
  if(!pad)return;
  const names=pad.mapping==='standard'?standardButtons:[];
  const buttons=pad.buttons.flatMap((b,i)=>b.pressed||b.value>.05?[names[i]||'B'+i]:[]);
  writeIfChanged(byId('pad-buttons'),buttons.length?buttons.join(' · '):'Buttons released');
  const pressure=byId('pad-pressure');
  if(pressure.children.length!==pad.buttons.length){
    pressure.replaceChildren(...pad.buttons.map((_,i)=>{const b=document.createElement('span');b.textContent=names[i]?.split(' / ')[0]||'B'+i;return b;}));
  }
  pad.buttons.forEach((b,i)=>{const cell=pressure.children[i];cell.classList.toggle('on',b.pressed||b.value>.05);cell.style.setProperty('--pressure',Math.round(b.value*100)+'%');});

  const sticks=byId('pad-readings').querySelectorAll('.stick');
  for(const [n,side] of ['left-stick','right-stick'].entries()){
    const x=pad.axes[n*2],y=pad.axes[n*2+1],available=Number.isFinite(x)&&Number.isFinite(y);
    sticks[n].style.visibility=available?'visible':'hidden';
    sticks[n].firstElementChild.style.transform='translate('+(available?x*7:0)+'px,'+(available?y*7:0)+'px)';
    const label=pad.mapping==='standard'?['L','R'][n]:'Axes '+(n*2)+'–'+(n*2+1);
    writeIfChanged(byId(side),available?label+' '+x.toFixed(2)+' / '+y.toFixed(2):'');
  }
}

byId('pad-rumble').addEventListener('click',async()=>{
 const result=byId('rumble-status');
 try{
  const list=Array.from((embeddedVisor&&parent.Arcade?parent.Arcade.pads():navigator.getGamepads?.())||[]).filter(Boolean);
  const pad=list.find(p=>String(p.index)===padPicker.value)||list[0];
  if(!pad?.vibrationActuator?.playEffect)return;
  await pad.vibrationActuator.playEffect('dual-rumble',{duration:250,strongMagnitude:.65,weakMagnitude:.35});
  result.textContent='Rumble test sent.';
 }catch{result.textContent='Rumble is unavailable on this controller.';}
});
