'use strict';
/* The terrain is the sample world. The glass, its edge treatment, the molecular
   layer, and the control face are independent surfaces above it. */
const byId = id => document.getElementById(id);
const ns = 'http://www.w3.org/2000/svg';
const hudQuery=new URLSearchParams(location.search);
const embeddedVisor=hudQuery.get('embed')==='1';
document.documentElement.classList.toggle('embedded-visor',embeddedVisor);
const rig = byId('rig');
const stage = byId('stage');
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
function makeSvg(tag, attrs, parent) {
  const node = document.createElementNS(ns, tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  parent.append(node);
  return node;
}
function path(parent, d, attrs = {}) { return makeSvg('path', {d,...attrs}, parent); }
let height = 360;
let displayWidth = 1000;
function contour(inset = 0) {
  const h = height, l = 18 + inset, r = 982 - inset;
  const top = 12 + inset, bottom = h - 19 - inset;
  const bow = Math.min(40,h*.095);
  return 'M '+(l+46)+' '+top+' Q 500 '+(top+bow*1.74)+' '+(r-46)+' '+top+
    ' C '+(r-15)+' '+(top-2)+' '+(r+4)+' '+(top+9)+' '+r+' '+(top+39)+
    ' L '+(r-18)+' '+(bottom-43)+' Q '+(r-22)+' '+(bottom-14)+' '+(r-57)+' '+(bottom-8)+
    ' Q 500 '+(bottom+bow*.95)+' '+(l+57)+' '+(bottom-8)+
    ' Q '+(l+22)+' '+(bottom-14)+' '+(l+18)+' '+(bottom-43)+
    ' L '+l+' '+(top+39)+' C '+(l-4)+' '+(top+9)+' '+(l+15)+' '+(top-2)+' '+(l+46)+' '+top+' Z';
}
function drawMounts(){
  const group=byId('mounts');group.replaceChildren();
  const h=height;
  for(const right of [false,true]){
    const side=makeSvg('g',{transform:right?'translate(1000 0) scale(-1 1)':''},group);
    const y=h*.36; const end=h*.64;
    path(side,'M 4 '+(y-9)+' Q 6 '+(y-14)+' 14 '+(y-13)+' L 25 '+(y-9)+' L 35 '+(end-9)+' L 30 '+(end+2)+' L 18 '+(end+7)+' L 9 '+(end-1)+' Z',{fill:'#02090c',stroke:'#0a1217','stroke-width':3});
    path(side,'M 5 '+(y-14)+' Q 8 '+(y-18)+' 14 '+(y-17)+' L 25 '+(y-13)+' L 35 '+(end-12)+' L 29 '+(end-2)+' L 17 '+(end+3)+' L 9 '+(end-5)+' Z',{fill:'url(#metal)',stroke:'#68818b','stroke-width':.85});
    path(side,'M 14 '+(y-13)+' L 23 '+(y-10)+' L 31 '+(end-13)+' L 24 '+(end-5)+' L 17 '+(end-8)+' Z',{fill:'url(#metalInner)',stroke:'#0c2029','stroke-width':1.6});
    path(side,'M 8 '+(y-13)+' L 14 '+(y-15)+' L 23 '+(y-12),{fill:'none',stroke:'#c6dce2','stroke-width':.9});
    for(let i=0;i<5;i++){const py=y+(end-y)*(.27+i*.085),px=13+(py-y)/(end-y)*8;path(side,'M '+px+' '+py+' l 11 -3',{stroke:'#020a0d','stroke-width':2.8});path(side,'M '+px+' '+(py+1.5)+' l 11 -3',{stroke:'#6a8993','stroke-width':.8});}
    for(const [cx,cy] of [[13,y-6],[22,end-7]]){
      makeSvg('circle',{cx,cy,r:2.2,fill:'#061018',stroke:'#687c84','stroke-width':.65},side);
      path(side,'M '+(cx-.9)+' '+(cy+.5)+' l 1.8 -1',{stroke:'#96aab2','stroke-width':.65});
    }
  }
}
function drawEtching(){
  const g=byId('glass-marks');g.replaceChildren();const h=height;
  // Fine optical index cuts against the top of the inner bevel.
  for(const side of [-1,1]){
    let d='';
    for(let i=0;i<13;i++){
      const x=500+side*(43+i*8),y=24+Math.min(40,h*.095)*.83-Math.pow((x-500)/500,2)*Math.min(40,h*.095)*.83;
      d+='M'+x+' '+y+'v'+(i%4===0?5:2)+' ';
    }
    path(g,d,{fill:'none',stroke:'#a7e8ed','stroke-width':.8,opacity:.55});
  }
  const centerY=28+Math.min(40,h*.095)*.87;
  path(g,'M 495 '+centerY+' l 5 4 5 -4',{fill:'none',stroke:'#a4f4fa','stroke-width':1.25,opacity:.7});
  const shine=byId('reflections');shine.replaceChildren();
  path(shine,'M 28 0H240L80 '+h+'H-130Z',{fill:'url(#sheen)'});
  path(shine,'M 764 0h114L688 '+h+'H550Z',{fill:'url(#sheen)',opacity:.68});
}
const families=[
  {x:.125,y:.34,n:6,r:20,phase:.4,dx:1.05,sub:1,ink:'#8ce3eb'},
  {x:.337,y:.23,n:8,r:15,phase:2,dx:.8,sub:0,ink:'#86bdf9'},
  {x:.69,y:.32,n:9,r:26,phase:4.6,dx:-.8,sub:1,ink:'#9cdeff'},
  {x:.876,y:.60,n:6,r:20,phase:1.8,dx:-.6,sub:1,ink:'#80e5dd'},
  {x:.39,y:.70,n:9,r:12,phase:3,dx:.7,sub:0,ink:'#9bcdee'},
  {x:.10,y:.77,n:8,r:15,phase:0,dx:.9,sub:0,ink:'#77bcd4'}
];
const particleGroups=families.map(f=>{
  const g=makeSvg('g',{fill:'none',stroke:f.ink,'stroke-linejoin':'round'},byId('particles'));
  const halo=path(g,'',{opacity:.12,'stroke-width':3.3});
  const bonds=path(g,'',{'stroke-width':1.05}); const detail=path(g,'',{'stroke-width':.65,opacity:.59});
  const dots=Array.from({length:f.n+(f.sub?6:2)},(_,i)=>makeSvg('circle',{r:i%3===0?1.95:1.3,fill:f.ink,'stroke-width':.4},g));
  return {g,halo,bonds,detail,dots};
});
function particlesAt(time,pitch,roll){
  const compact=displayWidth<430;
  for(let j=0;j<families.length;j++){
    const f=families[j],{g,halo,bonds,detail,dots}=particleGroups[j];
    if(compact && (j===4||j===5)){g.setAttribute('display','none');continue;} g.removeAttribute('display');
    const t=time*.22+f.phase, k=Math.min(1.58,Math.max(.87,760/displayWidth));
    const radius=f.r*k,angle=t*.065+f.phase, depth=(j%3+1)*.21;
    const x=((f.x*1000+time*f.dx*2.15+120)%1240+1240)%1240-120;
    const y=f.y*height+Math.sin(t*.5)*height*.032;
    const opacity=j===4||j===5?.41:j===1?.60:.85;
    g.setAttribute('transform','translate('+(x-roll*depth*1.5)+' '+(y+pitch*depth)+')');
    g.setAttribute('opacity',opacity);
    const p=[];
    for(let i=0;i<f.n;i++){
      const a=angle+i*Math.PI*2/f.n, rr=radius*(1+.055*Math.sin(t+i*1.6));
      p.push([Math.cos(a)*rr,Math.sin(a)*rr*(.76+.06*Math.sin(t*.5))]);
    }
    const coord=([x,y])=>x.toFixed(2)+' '+y.toFixed(2);
    let d='M'+p.map(coord).join('L')+'Z';
    const extend=(point,heading,length)=>[point[0]+radius*length*Math.cos(heading),point[1]+radius*length*Math.sin(heading)];
    const root=p[0],arm=extend(root,angle+.24*Math.sin(t*.8),.71);
    const tip=extend(arm,angle+.79+.18*Math.sin(t*.7),.64);
    d+='M'+coord(root)+'L'+coord(arm)+'L'+coord(tip);p.push(arm,tip);
    if(f.sub){
      const edge=p[Math.floor(f.n/2)], direction=Math.atan2(edge[1],edge[0]);
      const elbow=extend(edge,direction+.17*Math.sin(t),.67);
      const leaf=extend(elbow,direction+.81,.74),branch=extend(elbow,direction-.69,.77);
      const end=extend(branch,direction-.28+.19*Math.sin(t),.72);
      d+='M'+coord(edge)+'L'+coord(elbow)+'L'+coord(leaf)+'M'+coord(elbow)+'L'+coord(branch)+'L'+coord(end);
      p.push(elbow,leaf,branch,end);
    }
    bonds.setAttribute('d',d);halo.setAttribute('d',d);
    detail.setAttribute('d','M'+coord(p[1].map(v=>v*.81))+'L'+coord(p[2].map(v=>v*.81))+'L'+coord(p[3].map(v=>v*.81)));
    p.forEach(([x,y],i)=>{dots[i].setAttribute('cx',x);dots[i].setAttribute('cy',y);});
  }
}
const scenePalettes = {
  blue: { sky: ['#193747','#111e28','#090f15'], ground: [16,29,42], lines: [84,188,209], grid: [103,151,217] },
  sunset: { sky: ['#fea76e','#a55359','#422f4a'], ground: [88,41,49], lines: [250,170,119], grid: [229,137,132] },
  daylight: { sky: ['#d4e7a2','#8fb7a3','#5d8d86'], ground: [48,81,72], lines: [172,236,171], grid: [125,203,175] }
};
const sampleCanvas=document.createElement('canvas');
sampleCanvas.width=32;sampleCanvas.height=18;
const sampleContext=sampleCanvas.getContext('2d',{willReadFrequently:true});
function sampleBackdrop(source){
  // Read the underlying scene alone. Including the HUD here would feed its own
  // blue back into subsequent samples. A high percentile protects bright patches.
  sampleContext.drawImage(source,0,0,32,18);
  const pixels=sampleContext.getImageData(0,0,32,18).data;
  let red=0,green=0,blue=0;const levels=[];
  for(let i=0;i<pixels.length;i+=4){
    red+=pixels[i];green+=pixels[i+1];blue+=pixels[i+2];
    levels.push((.2126*pixels[i]+.7152*pixels[i+1]+.0722*pixels[i+2])/255);
  }
  const count=levels.length;levels.sort((a,b)=>a-b);
  const high=levels[Math.floor(count*.92)],spread=high-levels[Math.floor(count*.12)];
  const channels=[red,green,blue].map(v=>v/count);
  const gain=Math.min(2.2,192/Math.max(1,...channels));
  const rgb=channels.map(v=>Math.round(v*gain));
  stage.style.setProperty('--ambient-color','rgb('+rgb.join(',')+')');
  stage.style.setProperty('--scene-ink',rgb.map(v=>Math.round(v*.14)).join(' '));
  stage.style.setProperty('--label-shade',Math.min(.89,.40+high*.48+spread*.13).toFixed(2));
  stage.style.setProperty('--lens-shade',(.04+high*.34).toFixed(2));
}
let hostFrame=null;
function refreshTint(){
  try{sampleBackdrop(hostFrame||byId('terrain'));}catch{
    // Reading a cross-origin frame can taint the tiny sampler. Reset it so
    // later readable frames recover, and use a safe neutral tint for now.
    sampleCanvas.width=32;
    stage.style.setProperty('--ambient-color','#347688');stage.style.setProperty('--scene-ink','5 20 30');
    stage.style.setProperty('--label-shade','.87');stage.style.setProperty('--lens-shade','.32');
  }
}
stage.addEventListener('hud:scene-frame',event=>{
  hostFrame=event.detail?.source||null;refreshTint();
});
function terrain(){
  if(embeddedVisor)return;
  const canvas=byId('terrain'), w=stage.clientWidth,h=stage.clientHeight;
  if(!w||!h)return;
  const dpr=Math.min(2,devicePixelRatio||1);canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);
  const c=canvas.getContext('2d');c.scale(dpr,dpr);
  const palette=scenePalettes[byId('backdrop').value]||scenePalettes.blue;
  // Draw solid mountains back-to-front so distant wire lines disappear behind nearer ridges.
  const step=.23, focal= Math.max(w*.62,h*1.35), fy=Math.min(h*1.78,focal);
  const ridges=[[-4.6,9.5,2.75,2.65,2.2],[-2.7,12.1,1.9,1.65,1.5],
    [-8.9,13.8,2.25,2.85,1.6],[4.2,9.7,1.65,1.65,1.8],[6.9,12,2.4,2.25,2.4],[2.1,13.1,1.2,2,1.8]];
  function elev(x,z){
    let sum=0;
    for(const [cx,cz,amp,sx,sz] of ridges){
      const dx=(x-cx)/sx,dz=(z-cz)/sz;
      sum+=amp*Math.exp(-Math.sqrt(dx*dx+dz*dz)*1.72);
    }
    const crag=.13*Math.sin(x*2.6+z*.84)+.075*Math.cos(z*3.85+x*1.9)+.045*Math.sin(x*7.4-z*2.3);
    return sum*(.92+crag)+.033*Math.sin(x*1.1+z*2.1)+.018*Math.sin(x*2.8-z*2.3);
  }
  const minx=-Math.ceil(20/step),maxx=-minx;
  function row(z){
    const pts=[];
    for(let i=minx;i<=maxx;i++){const x=i*step;
      const elevation=elev(x,z);pts.push([w*.5+x/z*focal,h*.575+(.86-elevation)/z*fy]);
    }
    return pts;
  }
  let far=row(20);
  for(let z=20-step;z>=1.1;z-=step){
    const near=row(z),depth=(20-z)/19,alpha=.2+.55*Math.sin(Math.min(1,depth)*Math.PI);
    c.beginPath();c.moveTo(far[0][0],far[0][1]);for(const p of far)c.lineTo(...p);
    for(let i=near.length-1;i>=0;i--)c.lineTo(...near[i]);c.closePath();
    c.fillStyle='rgb('+palette.ground.map(value=>Math.round(value*(1-depth*.34))).join(',')+')';c.fill();
    c.beginPath();
    for(let i=0;i<near.length;i++){if(i===0)c.moveTo(...near[i]);else c.lineTo(...near[i]);}
    c.lineWidth=.85;c.strokeStyle='rgba('+palette.lines.join(',')+','+(alpha*.81)+')';c.stroke();
    c.beginPath();
    for(let i=0;i<near.length;i++){if(near[i][0]<-30||near[i][0]>w+30)continue;c.moveTo(...far[i]);c.lineTo(...near[i]);}
    c.lineWidth=.65;c.strokeStyle='rgba('+palette.grid.join(',')+','+(alpha*.56)+')';c.stroke();
    far=near;
  }
  c.globalCompositeOperation='destination-in';
  const vignette=c.createRadialGradient(w*.5,h*.52,0,w*.5,h*.52,Math.max(w,h)*.57);
  vignette.addColorStop(0,'rgba(0,0,0,.96)');vignette.addColorStop(.63,'rgba(0,0,0,.93)');vignette.addColorStop(1,'transparent');c.fillStyle=vignette;c.fillRect(0,0,w,h);
  const fade=c.createLinearGradient(0,h*.45,0,h);fade.addColorStop(0,'#000');fade.addColorStop(.62,'#000');fade.addColorStop(1,'transparent');c.fillStyle=fade;c.fillRect(0,0,w,h);
  c.globalCompositeOperation='destination-over';
  const sky=c.createRadialGradient(w*.48,h*.49,0,w*.48,h*.49,Math.max(w*.58,h*.74));
  sky.addColorStop(0,palette.sky[0]);sky.addColorStop(.60,palette.sky[1]);sky.addColorStop(1,palette.sky[2]);
  c.fillStyle=sky;c.fillRect(0,0,w,h);c.globalCompositeOperation='source-over';
  refreshTint();
}
byId('backdrop').addEventListener('change',terrain);
function layoutVisor(){
  const w=rig.clientWidth;
  if(!w){terrain();return;}
  displayWidth=w;height=rig.clientHeight/w*1000;
  byId('visor').setAttribute('viewBox','0 0 1000 '+height);
  const rims={'clip-shape':2,'rim-shape':0,'outer-edge':0,'rim-line':2.6,'outer-highlight':-2.6,'fringe-shape':8,'edge-bloom':8,'edge-line':8,'edge-shadow':8};
  for(const [id,inset] of Object.entries(rims))byId(id).setAttribute('d',contour(inset));
  drawEtching();drawMounts();particlesAt(0,0,0);terrain();
}
const visorResize=new ResizeObserver(layoutVisor);
visorResize.observe(rig);
visorResize.observe(stage);
layoutVisor();
