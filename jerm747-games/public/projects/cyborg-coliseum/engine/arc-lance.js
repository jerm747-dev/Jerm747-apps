/* Arc Lance: approved sprite + solid laser, flowing forks and the shared living glow.
 * Geometries are owned by each visual; its image texture is shared across shots. */
(function(){'use strict';
 const T=THREE;
 let texture=null;
 window.createArcLanceVisual=function(makeGlow){
  const group=new T.Group();group.name='Cyborg Arc Lance';
  if(!texture){texture=new T.TextureLoader().load(window.ArcLanceImage);texture.encoding=T.sRGBEncoding;}
  const material=(color,opacity=1)=>new T.MeshBasicMaterial({color,transparent:true,opacity,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false,side:T.DoubleSide});
  function mesh(geometry,mat){const m=new T.Mesh(geometry,mat);m.userData.ownGeometry=true;group.add(m);return m;}
  // Art points to +X. Its bright nose sits at the projectile's collision centre.
  const art=mesh(new T.PlaneGeometry(5.1,1.7),material(0xffffff,.92));
  art.userData.canvasEffectImage=true;
  art.material.map=texture;art.position.set(-2.32,0,.035);
  const core=mesh(new T.CylinderGeometry(.019,.008,4.7,8),material(0xeaffff));
  core.rotation.z=Math.PI/2;core.position.x=-2.12;
  const corona=mesh(new T.CylinderGeometry(.055,.015,4.7,8),material(0x36ceff,.5));
  corona.rotation.z=Math.PI/2;corona.position.x=-2.12;
  const glows=[0,-1.2,-2.7].map((x,i)=>{const g=makeGlow(i===0?0xa7faff:0x078bff);g.position.x=x;group.add(g);return g;});
  const count=4*12*2+4*3*2,positions=new Float32Array(count*3);
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.BufferAttribute(positions,3));
  const arcs=new T.LineSegments(geometry,new T.LineBasicMaterial({color:0xbbfaff,transparent:true,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false}));
  arcs.userData.ownGeometry=true;arcs.frustumCulled=false;group.add(arcs);
  const sparkGeo=new T.IcosahedronGeometry(.035,0),sparks=[];
  // A single owner disposes this per-shot shared geometry exactly once.
  for(let i=0;i<8;i++){const s=new T.Mesh(sparkGeo,material(i%3?0x66eaff:0xc48aff));s.userData.ownGeometry=i===0;group.add(s);sparks.push(s);}
  let lastTick=-1;
  function update(age,glow,pulse){
   const power=.5+.5*pulse;
   art.material.opacity=.8+.18*power;
   corona.material.opacity=glow*(.25+.35*power);
   glows.forEach((g,i)=>{g.scale.set((i===0?2:2.8)+.22*pulse,(i===0?1.65:1.25)+.18*pulse,1);g.material.opacity=glow*(i===0?.52:.32)*(.75+.25*pulse);});
   arcs.material.opacity=.65+.3*power;
   const tick=Math.floor(age*24);
   if(tick!==lastTick){lastTick=tick;let k=0;
    const point=(lane,j)=>{const u=j/12,a=lane*Math.PI/2+u*4.5-age*6,r=(.08+.36*Math.sin(u*Math.PI))*(.62+.38*Math.sin(j*7.19+lane*3.7+tick*1.87));return [-4.5+4.7*u,Math.cos(a)*r,Math.sin(a)*r+.06];};
    for(let lane=0;lane<4;lane++){
     for(let j=0;j<12;j++){positions.set(point(lane,j),k);k+=3;positions.set(point(lane,j+1),k);k+=3;}
     for(let j=3;j<=9;j+=3){const p=point(lane,j);positions.set(p,k);k+=3;positions.set([p[0]-.26,p[1]+Math.cos(lane*1.57)*.22,p[2]+Math.sin(lane*1.57)*.22],k);k+=3;}
    }
    geometry.attributes.position.needsUpdate=true;
   }
   sparks.forEach((s,i)=>{const u=(age*1.8+i/8)%1,a=i*2.4+age*4;s.position.set(-u*4.5,Math.cos(a)*(.18+.2*u),Math.sin(a)*(.18+.2*u));s.scale.setScalar((1-u)*1.4);s.material.opacity=glow*(1-u);});
  }
  update(0,.7,.5);
  return {group,update};
 };
})();
