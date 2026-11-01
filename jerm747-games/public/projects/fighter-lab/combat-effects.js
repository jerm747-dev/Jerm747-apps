/* GS Fighter III v0.33 — simulation-clock finish + Azure V-Wave and living glow. */
(function(){'use strict';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
window.createFinishClock=function(){
 const config={enabled:true,scale:.28,lead:'combo'};
 let left=0,total=0,phase='idle',scale=1,armed=false;
 return {config,
  anticipate(){if(!config.enabled||config.lead!=='combo'||armed||left>0)return false;armed=true;phase='lead';left=total=.7;return true;},
  impact(){if(!config.enabled||phase==='impact')return false;phase='impact';left=total=1.45;return true;},
  update(dt){
   if(!config.enabled){left=0;phase='idle';scale=1;return scale;}
   if(left>0){left=Math.max(0,left-dt);const age=total-left;
    const strength=phase==='lead'?Math.max(.48,config.scale):config.scale;
    const target=left<.35?strength+(1-strength)*(1-left/.35):strength;
    scale+=(target-scale)*(1-Math.exp(-dt*(age<.12?36:18)));
    if(!left)phase='idle';
   }else{scale+=(1-scale)*(1-Math.exp(-dt*20));if(scale>.999)scale=1;}
   return scale;
  },
  reset(){left=total=0;scale=1;phase='idle';armed=false;},
  get state(){return {phase,scale,left,armed};}
 };
};
window.createVWaveSystem=function(T,scene){
 const config={radius:.48,speed:7,palette:'cyan',damage:24,cooldown:2.4,glow:.7,pulse:true};
 const azure=window.createAzureBlastAsset?createAzureBlastAsset(T):{status:'error',error:'Mesh data unavailable'};
 const palettes={cyan:[0x0675f9,0x54faff,0xc151ff],solar:[0xff4c10,0xffdc76,0xff913e],rose:[0xaf167f,0xffb0ed,0xa787ff],jade:[0x009c78,0xb7ffe1,0x54ee9d]};
 const root=new T.Group();root.name='V-Wave effects';scene.add(root);
 const shots=[],bursts=[],cooldowns=[0,0],charges=new Map();let serial=0;
 const sphere=new T.SphereGeometry(1,24,16),moteGeo=new T.IcosahedronGeometry(1,0);
 const tail=new T.CylinderGeometry(.015,.82,3.7,16,12,true);tail.rotateZ(-Math.PI/2);tail.translate(-2.15,0,0);
 // The narrow end of the cone is behind the orb; the broad end sits inside it.
 tail.rotateY(Math.PI);tail.translate(-4.3,0,0);
 const tailPositions=tail.attributes.position;for(let i=0;i<tailPositions.count;i++){
  const x=tailPositions.getX(i),u=clamp((-x-.3)/3.7,0,1),old=.82*(1-u)+.015*u,profile=.82*Math.pow(1-u,2.35)+.015*u;
  tailPositions.setXYZ(i,x,tailPositions.getY(i)*profile/old,tailPositions.getZ(i)*profile/old);
 }tail.computeVertexNormals();
 const glowCanvas=document.createElement('canvas');glowCanvas.width=glowCanvas.height=64;
 const ctx=glowCanvas.getContext('2d'),gradient=ctx.createRadialGradient(32,32,0,32,32,32);
 gradient.addColorStop(0,'rgba(255,255,255,.55)');gradient.addColorStop(.3,'rgba(255,255,255,.25)');gradient.addColorStop(1,'rgba(255,255,255,0)');ctx.fillStyle=gradient;ctx.fillRect(0,0,64,64);
 const glowMap=new T.CanvasTexture(glowCanvas);
 const wispGeometries=[];for(let i=0;i<6;i++){
  const points=[];for(let j=0;j<=12;j++){const u=j/12,a=i*Math.PI/3+u*2.4,x=.8-u*2.7,r=Math.sqrt(Math.max(.08,1-x*x*.48))*(1-u*.45);points.push(new T.Vector3(x,Math.cos(a)*r,Math.sin(a)*r));}
  wispGeometries.push(new T.TubeGeometry(new T.CatmullRomCurve3(points),28,.012+(i%2)*.009,6,false));
 }
 function makeGlow(color,opacity=.5){return new T.Sprite(new T.SpriteMaterial({map:glowMap,color,transparent:true,opacity,depthWrite:false,blending:T.AdditiveBlending}));}
 function clearCharge(owner){const group=charges.get(owner);if(group){disposeGroup(group);charges.delete(owner);}}
 function charge({owner=0,x,y=1.05,progress=0}){
  let group=charges.get(owner);if(!group){group=new T.Group();group.name='V-Wave charge';const glow=makeGlow((palettes[config.palette]||palettes.cyan)[1],.5);group.add(glow);root.add(group);charges.set(owner,group);}
  group.children[0].material.color.setHex((palettes[config.palette]||palettes.cyan)[1]);group.position.set(x,y,.05);group.children[0].scale.setScalar(.15+.55*clamp(progress,0,1));group.children[0].material.opacity=(.3+.35*clamp(progress,0,1))*config.glow;
 }

 function flameMaterial(colors,isTail=false){
  const material=new T.MeshBasicMaterial({color:colors[1],side:T.DoubleSide,transparent:isTail,depthWrite:!isTail});
  const uniforms={uWaveTime:{value:0},uWaveDeep:{value:new T.Color(colors[0])},uWaveHot:{value:new T.Color(colors[1])},uWaveRim:{value:new T.Color(colors[2])},uWaveTail:{value:isTail?1:0}};
  material.onBeforeCompile=s=>{
   Object.assign(s.uniforms,uniforms);
   s.vertexShader='varying vec3 vWavePos; varying vec3 vWaveNormal;\n'+s.vertexShader;
   s.vertexShader=s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvWavePos=position;vWaveNormal=normal;');
   s.fragmentShader='varying vec3 vWavePos; varying vec3 vWaveNormal; uniform float uWaveTime; uniform float uWaveTail; uniform vec3 uWaveDeep; uniform vec3 uWaveHot; uniform vec3 uWaveRim;\n'+s.fragmentShader;
   s.fragmentShader=`
 float waveHash(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
 float waveNoise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
 return mix(mix(mix(waveHash(i),waveHash(i+vec3(1,0,0)),f.x),mix(waveHash(i+vec3(0,1,0)),waveHash(i+vec3(1,1,0)),f.x),f.y),mix(mix(waveHash(i+vec3(0,0,1)),waveHash(i+vec3(1,0,1)),f.x),mix(waveHash(i+vec3(0,1,1)),waveHash(i+vec3(1,1,1)),f.x),f.y),f.z);}
 float waveFbm(vec3 p){float v=0.0,a=.5;for(int i=0;i<4;i++){v+=a*waveNoise(p);p=p*2.03+vec3(7.1,3.2,1.7);a*=.5;}return v;}
 `+s.fragmentShader;
 s.fragmentShader=s.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
    vec3 p=vWavePos; float angle=atan(p.z,p.y); float t=uWaveTime;
    vec3 flow=vec3(p.x*2.3-t*2.6,angle*1.8+p.x*2.0,length(p.yz)*4.0);
    float noise=waveFbm(flow*1.6);float detail=waveFbm(flow*5.2+noise*4.0);
    float swirl=sin(angle*9.0+p.x*7.0-t*7.0+noise*11.0);
    float ribbon=pow(max(0.0,swirl),5.0)*smoothstep(.2,.72,detail);
    float light=max(0.0,dot(normalize(vWaveNormal),normalize(vec3(.5,.7,1.0))));
    vec3 energy=mix(uWaveDeep*.16,uWaveDeep*.85,clamp(noise*.85+light*.2,0.0,1.0));
    energy=mix(energy,uWaveHot,smoothstep(.08,.48,ribbon));
    energy=mix(energy,vec3(1.0,.99,1.0),smoothstep(.32,.65,ribbon));
    float core=pow(max(0.0,dot(normalize(p),normalize(vec3(.55,.2,1.0)))),12.0)*(1.0-uWaveTail);
    energy=mix(energy,vec3(1.0),core*.96);
    float edge=pow(1.0-abs(normalize(vWaveNormal).z),3.0);
    energy=mix(energy,uWaveRim,edge*.55*(1.0-uWaveTail));
    if(uWaveTail>.5)diffuseColor.a=smoothstep(.13,.4,noise+ribbon*.35)*.92;
    diffuseColor.rgb=energy;
   `);
  };
  material.customProgramCacheKey=()=> 'gs-vwave-flame-31';material.userData.waveUniforms=uniforms;return material;
 }
 function disposeGroup(group){group.traverse(o=>{if(o.material){if(Array.isArray(o.material))o.material.forEach(m=>m.dispose());else o.material.dispose();}if(o.userData.ownGeometry)o.geometry.dispose();});root.remove(group);}
 function burst(x,y,color,power=1){
  if(bursts.length>=6)disposeGroup(bursts.shift().group);
  const group=new T.Group();group.position.set(x,y,0);root.add(group);
  const sparks=[];for(let i=0;i<24;i++){const m=new T.Mesh(moteGeo,new T.MeshBasicMaterial({color:i%3?color:0xffffff,transparent:true,depthWrite:false}));m.scale.setScalar(.025+(i%3)*.015);group.add(m);sparks.push({mesh:m,velocity:new T.Vector3(Math.cos(i*2.4)*(1.2+i*.07),Math.sin(i*2.4)*(1.2+i*.07),Math.sin(i*1.7)*.65)});}
  const vertices=[];for(let i=0;i<7;i++){const a=i*Math.PI*2/7;for(let j=0;j<3;j++){let r=.12+j*.16,r2=r+.16;vertices.push(Math.cos(a)*r,Math.sin(a)*r,0,Math.cos(a+.22*(j%2?1:-1))*r2,Math.sin(a+.22*(j%2?1:-1))*r2,0);}}
  const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(vertices,3));
  const arcs=new T.LineSegments(geo,new T.LineBasicMaterial({color:0xcffbff,transparent:true,depthWrite:false}));arcs.userData.ownGeometry=true;group.add(arcs);
  const flash=makeGlow(color,.8*config.glow);flash.scale.setScalar(1.1);group.add(flash);
  const ring=new T.Mesh(new T.RingGeometry(.88,1,48),new T.MeshBasicMaterial({color,transparent:true,opacity:.65,depthWrite:false,side:T.DoubleSide,blending:T.AdditiveBlending}));ring.userData.ownGeometry=true;ring.position.z=.07;ring.scale.setScalar(.2);group.add(ring);
  bursts.push({group,sparks,arcs,flash,ring,power,age:0});
 }
 function launch({owner=0,x,y=1.05,direction=1}){
  if(azure.status==='loading'||cooldowns[owner]>0||shots.length>=2)return false;
  clearCharge(owner);
  cooldowns[owner]=config.cooldown;
  const colors=palettes[config.palette]||palettes.cyan,group=new T.Group(),body=new T.Group();
  group.position.set(x,y,0);group.rotation.y=direction<0?Math.PI:0;group.scale.setScalar(config.radius);group.add(body);root.add(group);
  const azureMesh=azure.createMesh?.()||null;let coreMat=null,tailMat=null;
  if(azureMesh)body.add(azureMesh);
  else{coreMat=flameMaterial(colors);tailMat=flameMaterial(colors,true);body.add(new T.Mesh(sphere,coreMat),new T.Mesh(tail,tailMat));}
  const shellMaterial=flameMaterial(colors);Object.assign(shellMaterial,{transparent:true,opacity:.18*config.glow,depthWrite:false,side:T.FrontSide,blending:T.AdditiveBlending});
  const shell=new T.Mesh(sphere,shellMaterial);shell.name='Animated flame shell';shell.scale.setScalar(1.12);group.add(shell);
  const glow=makeGlow(colors[1],.6*config.glow);glow.scale.set(3.9,3.9,1);group.add(glow);
  const wisps=wispGeometries.map((g,i)=>{const m=new T.Mesh(g,new T.MeshBasicMaterial({color:i%2?colors[1]:colors[2],transparent:true,opacity:.4*config.glow,depthWrite:false,blending:T.AdditiveBlending}));m.name='Flame wisp';group.add(m);return m;});

  const motes=[];for(let i=0;i<12;i++){const m=new T.Mesh(moteGeo,new T.MeshBasicMaterial({color:i%3?colors[1]:0xffffff}));m.scale.setScalar(.04+(i%3)*.018);body.add(m);motes.push(m);}
  shots.push({id:++serial,owner,group,body,shell,coreMat,tailMat,azureMesh,glow,wisps,motes,x,y,previousX:x,direction,radius:config.radius,speed:config.speed,damage:config.damage,powerful:true,color:colors[1],age:0});return true;
 }
 function update(dt,targets=[],onHit=()=>{}){
  for(let i=0;i<2;i++)cooldowns[i]=Math.max(0,cooldowns[i]-dt);
  for(let i=shots.length-1;i>=0;i--){const p=shots[i];p.age+=dt;p.previousX=p.x;p.x+=p.direction*p.speed*dt;p.group.position.x=p.x;
   if(p.coreMat)p.coreMat.userData.waveUniforms.uWaveTime.value=p.age;if(p.tailMat)p.tailMat.userData.waveUniforms.uWaveTime.value=p.age;
   const pulse=config.pulse ? .5+.5*Math.sin(p.age*Math.PI*4) : .5;
   p.body.rotation.x=Math.sin(p.age*2.1)*.13; // Small roll preserves the sculpted blast's broad side.
   if(p.azureMesh)p.azureMesh.material.emissiveIntensity=.76+config.glow*(.18+.28*pulse);
   p.shell.material.userData.waveUniforms.uWaveTime.value=p.age;
   p.shell.rotation.x=p.age*1.4;p.shell.scale.setScalar(1.12+.06*pulse);p.shell.material.opacity=config.glow*(.10+.12*pulse);
   p.glow.scale.setScalar(3.6+.45*pulse);p.glow.material.opacity=config.glow*(.4+.25*pulse);
   p.wisps.forEach((w,j)=>{w.rotation.x=p.age*(1.4+j*.07);w.scale.setScalar(1.08+.035*Math.sin(p.age*5+j));w.material.opacity=config.glow*(.25+.25*pulse);});
   p.motes.forEach((m,j)=>{const u=(p.age*.75+j/12)%1,a=j*2.4+p.age*2;m.position.set(-u*4.5,Math.cos(a)*(.9-u*.65),Math.sin(a)*(.9-u*.65));m.scale.setScalar((1-u)*(.04+(j%3)*.018));});
   const target=targets.find(t=>t.owner!==p.owner&&t.alive&&Math.abs((t.y??1.05)-p.y)<.6+p.radius&&Math.min(p.previousX,p.x)-p.radius<=t.x+.28&&Math.max(p.previousX,p.x)+p.radius>=t.x-.28);
   if(target){burst(target.x,p.y,p.color,1.5);onHit(p,target);disposeGroup(p.group);shots.splice(i,1);}
   else if(p.age>5||Math.abs(p.x)>22){disposeGroup(p.group);shots.splice(i,1);}
  }
  for(let i=bursts.length-1;i>=0;i--){const b=bursts[i];b.age+=dt;const fade=Math.max(0,1-b.age/.8);b.sparks.forEach(s=>{s.mesh.position.addScaledVector(s.velocity,dt);s.mesh.material.opacity=fade;});b.arcs.scale.setScalar(1+b.age*3);b.arcs.material.opacity=fade;b.arcs.visible=b.age<.28;b.flash.scale.setScalar(.5+b.age*3.5);b.flash.material.opacity=fade*fade*.8*config.glow;b.ring.scale.setScalar(.2+b.age*1.8*b.power);b.ring.material.opacity=fade*.6*config.glow;if(b.age>=.8){disposeGroup(b.group);bursts.splice(i,1);}}
 }
 return {config,root,azure,charge,clearCharge,launch,update,ready:(owner=0)=>azure.status!=='loading'&&cooldowns[owner]<=0&&shots.length<2,
  reset(){for(const owner of [...charges.keys()])clearCharge(owner);shots.forEach(p=>disposeGroup(p.group));bursts.forEach(b=>disposeGroup(b.group));shots.length=bursts.length=0;cooldowns.fill(0);},
  get state(){return {asset:azure.status,charges:charges.size,cooldowns:[...cooldowns],shots:shots.map(p=>({id:p.id,owner:p.owner,x:p.x,y:p.y,direction:p.direction,age:p.age,damage:p.damage,mesh:!!p.azureMesh})),bursts:bursts.length};}
 };
};
})();
