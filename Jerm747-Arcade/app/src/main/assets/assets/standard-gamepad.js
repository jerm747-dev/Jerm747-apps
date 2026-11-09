function createStandardGamepadReader(){let index=null,id='',previous=[],armed=false;
const down=(pad,n)=>!!pad.buttons?.[n]&&(pad.buttons[n].pressed||pad.buttons[n].value>.55),axis=(pad,n)=>Number.isFinite(pad.axes?.[n])?pad.axes[n]:0;
return {reset(){armed=false;previous=[];},read(pads){const list=Array.from(pads||[]).filter(p=>p&&p.connected!==false&&p.mapping==='standard');const pad=list.find(p=>p.index===index&&p.id===id)||list[0];if(!pad){const disconnected=index!==null;index=null;id='';armed=false;previous=[];return {pad:null,disconnected,unmapped:Array.from(pads||[]).some(p=>p&&p.connected!==false),state:{}};}
 if(pad.index!==index||pad.id!==id){index=pad.index;id=pad.id;armed=false;previous=[];}
 const buttons=Array.from({length:17},(_,n)=>down(pad,n)),x=axis(pad,0),y=axis(pad,1);if(!armed){if(buttons.every(v=>!v)&&Math.abs(x)<.25&&Math.abs(y)<.25)armed=true;previous=buttons;return {pad,waiting:!armed,state:{}};}
 const edge=n=>buttons[n]&&!previous[n],high=buttons[5],low=buttons[6],height=low?'Low':high?'High':'Mid';
 const state={left:buttons[14]||x<-.25,right:buttons[15]||x>.25,moveAxis:buttons[14]||buttons[15]?null:Math.abs(x)>.25?Math.sign(x)*Math.min(1,(Math.abs(x)-.25)/.75):0,block:buttons[4],duck:buttons[13]||y>.35,gather:buttons[7],jump:edge(0),attack:edge(2)?'p'+height:edge(1)?'k'+height:edge(3)?'wave':null,assist:edge(10)?'jado':edge(11)?'eli':null};
 const menu={left:buttons[14]||x<-.5,right:buttons[15]||x>.5,up:buttons[12]||y<-.5,down:buttons[13]||y>.5};const result={pad,state,menu,start:edge(9),music:edge(8),confirm:edge(0),back:edge(1)};previous=buttons;return result;
}};}
if(typeof module!=='undefined')module.exports={createStandardGamepadReader};
