/* Roman training bowl. Shared geometry batches keep the arcades inexpensive on phones. */
window.buildArena = function(scene, compatibility) {
  const T = THREE, loader = new T.TextureLoader();
  function map(file, repeat) {
    const t = loader.load('assets/'+file+'.webp');
    t.wrapS=t.wrapT=T.RepeatWrapping;t.repeat.set(repeat,repeat);t.encoding=T.sRGBEncoding;t.anisotropy=4;return t;
  }
  scene.add(new T.HemisphereLight(0xffe8ce,0x8e8176,1.5));
  const sun=new T.DirectionalLight(0xffdda8,2.0);
  sun.position.set(7,12,-5);scene.add(sun);
  const edge=new T.DirectionalLight(0xb6e4fa,1.15);edge.position.set(-6,5,8);scene.add(edge);
  const ground=new T.Group();scene.add(ground);
  if(!compatibility) {
    scene.fog=new T.FogExp2(0xd3b695,.018);
    const sky=new T.Mesh(new T.SphereGeometry(90,28,16),new T.ShaderMaterial({side:T.BackSide,depthWrite:false,
      vertexShader:'varying vec3 p;void main(){p=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader:'varying vec3 p;void main(){vec3 n=normalize(p);float t=smoothstep(0.,.8,n.y);vec3 col=mix(vec3(.89,.72,.53),vec3(.35,.54,.64),t);float s=max(dot(n,normalize(vec3(.49,.37,-.79))),0.);col+=vec3(.36,.23,.10)*pow(s,12.)+vec3(.45,.31,.17)*pow(s,185.);gl_FragColor=vec4(col,1.);}' }));
    scene.add(sky);
    const marble=map('floor',6),stone=map('masonry',1);
    const floorMat=new T.MeshStandardMaterial({map:marble,roughness:.95,color:0xe6d0a9});
    const bodyMat=new T.MeshStandardMaterial({map:stone,color:0xcfbb9a,roughness:1});
    const trimMat=new T.MeshStandardMaterial({color:0xc3aa84,roughness:.92});
    const dark=new T.MeshStandardMaterial({color:0x6c5b4d,roughness:1});
    const metal=new T.MeshStandardMaterial({color:0xaa8050,metalness:.4,roughness:.7});
    const scarlet=new T.MeshStandardMaterial({color:0x873e2d,roughness:.93,side:T.DoubleSide});
    const floor=new T.Mesh(new T.CircleGeometry(18,96),floorMat);floor.rotation.x=-Math.PI/2;floor.scale.y=.83;ground.add(floor);
    function ring(inner,outer,y,mat) {
      const item=new T.Mesh(new T.RingGeometry(inner,outer,96),mat);
      item.rotation.x=-Math.PI/2;item.scale.y=.83;item.position.y=y;ground.add(item);
    }
    for (const r of [5.0,5.15,12.4,12.55,14.5])ring(r,r+.065,.015,metal);
    // A compass of inlaid bronze at the center of the training floor.
    const needle=new T.Shape();needle.moveTo(0,0);needle.lineTo(-.16,.57);needle.lineTo(0,2.6);needle.lineTo(.16,.57);needle.closePath();
    const roseGeo=new T.ShapeGeometry(needle);
    for(let i=0;i<8;i++){const rose=new T.Mesh(roseGeo,metal);rose.rotation.x=-Math.PI/2;rose.rotateZ(i*Math.PI/4);rose.position.y=.019;ground.add(rose);}
    const pieces=new Map(), dummy=new T.Object3D(), box=new T.BoxGeometry(1,1,1);
    function batch(geometry,material,r,a,y,w,h,d,roll=0) {
      let group=pieces.get(geometry);if(!group){group=new Map();pieces.set(geometry,group);}
      let entries=group.get(material);if(!entries){entries=[];group.set(material,entries);}
      dummy.position.set(r*Math.sin(a),y,.83*r*Math.cos(a));dummy.rotation.set(0,Math.atan2(Math.sin(a)*.83,Math.cos(a)),0);dummy.rotateZ(roll);
      dummy.scale.set(w,h,d);dummy.updateMatrix();entries.push(dummy.matrix.clone());
    }
    const archShape=new T.Shape(), samples=14;
    archShape.moveTo(-1.35,0);archShape.lineTo(-1.35,2.53);archShape.lineTo(1.35,2.53);archShape.lineTo(1.35,0);archShape.lineTo(1,0);archShape.lineTo(1,1.22);
    for(let j=0;j<=samples;j++){const ang=Math.PI*j/samples;archShape.lineTo(Math.cos(ang),1.22+Math.sin(ang));}
    archShape.lineTo(-1,0);archShape.closePath();
    const arch=new T.ExtrudeGeometry(archShape,{depth:.7,bevelEnabled:false,curveSegments:10});
    const wedgeShape=new T.Shape(),beta=Math.PI/10;
    wedgeShape.moveTo(0,1);wedgeShape.lineTo(0,1.17);wedgeShape.lineTo(Math.sin(beta)*1.17,Math.cos(beta)*1.17);wedgeShape.lineTo(Math.sin(beta),Math.cos(beta));wedgeShape.closePath();
    const wedge=new T.ExtrudeGeometry(wedgeShape,{depth:.12,bevelEnabled:false});
    const banner=new T.Shape();banner.moveTo(-.55,0);banner.lineTo(.55,0);banner.lineTo(.55,-1.75);banner.lineTo(0,-2.18);banner.lineTo(-.55,-1.75);banner.closePath();
    const flag=new T.ShapeGeometry(banner),column=new T.CylinderGeometry(.5,.57,1,8);
    const N=48;
    for(let i=0;i<N;i++){
      const a=2*Math.PI*i/N, localWidth=Math.hypot(Math.cos(a),.83*Math.sin(a));
      const width=r=>2*r*Math.sin(Math.PI/N)*localWidth;
      batch(box,bodyMat,17.7,a,1.22,width(17.7)*1.02,2.45,1.1);
      for(const y of [.18,1.94,2.45])batch(box,trimMat,17.45,a,y,width(17.45)*1.025,.17,1.2);
      for(let j=0;j<7;j++){const r=18.1+j*.52;batch(box,j%2?trimMat:bodyMat,r,a,2.47+j*.26,width(r)*1.025,.52,.73);}
      for(let level=0;level<2;level++){
        const r=21.8+level*.47,base=4.2+level*2.94,w=width(r)/2.7;
        batch(arch,bodyMat,r,a,base,w*1.012,1.06,1);
        // The individual curved voussoirs outline each opening in sunlit limestone.
        for(let j=0;j<10;j++){
          const m=new T.Object3D();m.position.set(r*Math.sin(a),base+1.22*1.06,r*.83*Math.cos(a));
          m.rotation.y=Math.atan2(Math.sin(a)*.83,Math.cos(a));m.translateZ(-.115);m.scale.set(w,1.06,1);
          m.updateMatrix();const rot=new T.Matrix4().makeRotationZ(Math.PI/2-j*beta);
          if(!pieces.has(wedge))pieces.set(wedge,new Map([[trimMat,[]]]));
          pieces.get(wedge).get(trimMat).push(m.matrix.clone().multiply(rot));
        }
        const seam=a+Math.PI/N;
        batch(column,trimMat,r-.1,seam,base+1.24,.39,2.48,.39);
        for(const y of [base+.14,base+2.42])batch(box,trimMat,r-.16,seam,y,.5,.21,.59);
        batch(box,dark,r,a,base+2.75,width(r)*1.025,.18,1.12);
        batch(box,trimMat,r,a,base+2.9,width(r)*1.025,.17,1.48);
      }
      if(i%4===0){batch(flag,scarlet,21.3,a,7.1,1,1,1);batch(box,metal,21.22,a,7.15,1.4,.09,.09);batch(box,metal,21.17,a,6.27,.11,.85,.045);}
    }
    for(const [geo,byMaterial] of pieces)for(const [mat,entries] of byMaterial){
      const mesh=new T.InstancedMesh(geo,mat,entries.length);entries.forEach((m,i)=>mesh.setMatrixAt(i,m));ground.add(mesh);
    }
  }
  // Transparent, graded contact shadows stay inexpensive on mobile GPUs.
  const cv=document.createElement('canvas');cv.width=cv.height=128;const ctx=cv.getContext('2d'),grad=ctx.createRadialGradient(64,64,1,64,64,63);
  grad.addColorStop(0,'rgba(12,13,10,.72)');grad.addColorStop(.45,'rgba(22,17,11,.4)');grad.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=grad;ctx.fillRect(0,0,128,128);
  const shadowTexture=new T.CanvasTexture(cv);
  function shadow(w,d){const s=new T.Mesh(new T.PlaneGeometry(w,d),new T.MeshBasicMaterial({map:shadowTexture,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2}));s.userData.contactShadow=true;s.rotation.x=-Math.PI/2;s.position.y=.035;scene.add(s);return s;}
  const bronze=new T.MeshStandardMaterial({color:0x84705a,metalness:.67,roughness:.39}),brass=new T.MeshStandardMaterial({color:0xdfad62,metalness:.55,roughness:.42});
  function target(x,z){
    const base=new T.Group();scene.add(base);base.position.set(x,0,z);
    function mount(geo,mat,y,group=base){const mesh=new T.Mesh(geo,mat);mesh.position.y=y;group.add(mesh);return mesh;}
    mount(new T.CylinderGeometry(.66,.82,.14,12),bronze,.09);
    mount(new T.CylinderGeometry(.52,.65,.12,12),brass,.20);
    const core=new T.Group();base.add(core);core.position.y=1.12;
    const light=new T.MeshStandardMaterial({color:0xa9feff,emissive:0x159eae,emissiveIntensity:1.4,roughness:.3,metalness:.35});
    const crystal=mount(new T.OctahedronGeometry(.37),light,0,core);crystal.scale.y=1.45;
    const halo=mount(new T.TorusGeometry(.54,.045,6,32),brass,0,core);
    const halo2=mount(new T.TorusGeometry(.64,.018,6,32),bronze,0,core);halo2.rotation.y=1.26;
    const shade=shadow(1.8,1.5);shade.position.x=x;shade.position.z=z;
    return {base,core,light,halo,age:0,flash:0};
  }
  const targets=[target(0,-.15),target(-6,-4),target(5.2,-3),target(4.8,4.1)];
  return {targets,shadow:shadow(1.75,1.15)};
};
