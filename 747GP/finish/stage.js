/* Foreground in Three.js, with the venue and its LED programme composited behind it. */
(async () => {
  'use strict';
  const panel=document.querySelector('.stage'),canvas=document.querySelector('#podium');
  if(!window.THREE || !window.GPFinishDriver)return;
  const T=window.THREE,vehicle=window.GPFinishVehicle;
  try {
    const renderer=new T.WebGLRenderer({canvas,alpha:true,antialias:true,powerPreference:'low-power'});
    renderer.setClearColor(0,0);renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.65));
    renderer.outputEncoding=T.sRGBEncoding;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.03;
    const scene=new T.Scene(),camera=new T.OrthographicCamera(-3,3,2,-2,.01,35);
    camera.position.set(0,1.88,9);camera.lookAt(0,1.12,0);
    const hemi=new T.HemisphereLight(0xf1f4fa,0xb79d75,.91);scene.add(hemi);
    function light(color,power,x,y,z){const l=new T.DirectionalLight(color,power);l.position.set(x,y,z);scene.add(l)}
    light(0xfff3da,1.48,-3,5,5);light(0xd2e4ff,.82,4,3,2);light(0xffc16b,1.22,2,4,-4);
    const env=document.createElement('canvas');env.width=512;env.height=256;const c=env.getContext('2d');
    const g=c.createLinearGradient(0,0,0,256);g.addColorStop(0,'#28333f');g.addColorStop(.4,'#6d7988');g.addColorStop(.51,'#e8dfc5');g.addColorStop(.55,'#515966');g.addColorStop(1,'#191e21');c.fillStyle=g;c.fillRect(0,0,512,256);c.fillStyle='#fff4d8';c.fillRect(50,46,80,16);c.fillRect(280,50,94,19);
    const e=new T.CanvasTexture(env);e.mapping=T.EquirectangularReflectionMapping;e.encoding=T.sRGBEncoding;
    const pm=new T.PMREMGenerator(renderer),envTarget=pm.fromEquirectangular(e);scene.environment=envTarget.texture;pm.dispose();e.dispose();
    async function model(encoded) {
      const data=Uint8Array.from(atob(encoded),ch=>ch.charCodeAt(0)),dv=new DataView(data.buffer),length=dv.getUint32(12,true);
      const spec=JSON.parse(new TextDecoder().decode(data.subarray(20,20+length))),bin=28+length;
      const primitive=spec.meshes[0].primitives[0],geo=new T.BufferGeometry();
      function values(id,size){
        const a=spec.accessors[id],v=spec.bufferViews[a.bufferView],type=({5126:Float32Array,5125:Uint32Array,5123:Uint16Array})[a.componentType];
        return new T.BufferAttribute(new type(data.buffer,bin+(v.byteOffset||0)+(a.byteOffset||0),a.count*size),size);
      }
      geo.setAttribute('position',values(primitive.attributes.POSITION,3));geo.setAttribute('normal',values(primitive.attributes.NORMAL,3));geo.setAttribute('uv',values(primitive.attributes.TEXCOORD_0,2));geo.setIndex(values(primitive.indices,1));
      const m=spec.materials[primitive.material||0],p=m.pbrMetallicRoughness||{};
      const textures=await Promise.all(spec.images.map(async image=>{
        const v=spec.bufferViews[image.bufferView];const blob=new Blob([data.subarray(bin+(v.byteOffset||0),bin+(v.byteOffset||0)+v.byteLength)],{type:image.mimeType});const link=URL.createObjectURL(blob);
        try{const img=new Image();img.src=link;await img.decode();const t=new T.Texture(img);t.flipY=false;t.needsUpdate=true;return t;}finally{URL.revokeObjectURL(link);}
      }));
      const map=t=>t?textures[spec.textures[t.index].source]:null;
      const base=map(p.baseColorTexture);if(base)base.encoding=T.sRGBEncoding;
      const rough=map(p.metallicRoughnessTexture),mat=new T.MeshStandardMaterial({map:base,normalMap:map(m.normalTexture),metalnessMap:rough,roughnessMap:rough,roughness:p.roughnessFactor??1,metalness:p.metallicFactor??1,envMapIntensity:.82});
      mat.normalScale.set(.5,-.5);
      const node=spec.nodes.find(n=>n.mesh===0);if(node?.matrix)geo.applyMatrix4(new T.Matrix4().fromArray(node.matrix));
      geo.computeBoundingBox();return new T.Mesh(geo,mat);
    }
    async function getCar(){
      if(!window.__CARS?.[vehicle])await new Promise((ok,fail)=>{const s=document.createElement('script');s.src='cars/'+vehicle+'.js';s.onload=ok;s.onerror=fail;document.head.append(s)});
      return model(window.__CARS[vehicle]);
    }
    const [pilot,car]=await Promise.all([model(window.GPFinishDriver),getCar()]);
    delete window.GPFinishDriver;delete window.__CARS[vehicle];
    function ground(mesh,dimension,size){
      const b=mesh.geometry.boundingBox,extent=b.getSize(new T.Vector3()),center=b.getCenter(new T.Vector3());
      const scale=size/extent[dimension],floor=b.min.y;
      mesh.traverse(part=>{
        part.geometry.translate(-center.x,-floor,-center.z);
        part.geometry.scale(scale,scale,scale);
      });
      mesh.geometry.computeBoundingBox();
    }
    window.GPFinishParkCar(T,car,vehicle);
    ground(pilot,'y',1.87);ground(car,'z',1);
    pilot.rotation.y=.13;
    car.traverse(part=>part.geometry.rotateY(-.98));
    car.geometry.computeBoundingBox();
    const bounds=car.geometry.boundingBox;
    const extent=bounds.getSize(new T.Vector3());
    const center=bounds.getCenter(new T.Vector3());
    const isBike=panel.dataset.body==='bike';
    scene.add(pilot,car);
    const attr=pilot.geometry.attributes.position,idle=attr.clone();
    for(let i=0;i<attr.count;i++){
      const y=attr.getY(i),w=Math.max(0,Math.min(1,(y-.85)/.55));
      idle.setXYZ(i,attr.getX(i)+.003*w,y+.009*w,attr.getZ(i)+.003*w);
    }
    pilot.geometry.morphAttributes.position=[idle];pilot.material.morphTargets=true;pilot.updateMorphTargets();
    const shadowTex=document.createElement('canvas');shadowTex.width=128;shadowTex.height=128;const sc=shadowTex.getContext('2d'),sg=sc.createRadialGradient(64,64,0,64,64,64);sg.addColorStop(0,'rgba(0,0,0,.88)');sg.addColorStop(.52,'rgba(0,0,0,.5)');sg.addColorStop(1,'rgba(0,0,0,0)');sc.fillStyle=sg;sc.fillRect(0,0,128,128);
    const sm=new T.MeshBasicMaterial({map:new T.CanvasTexture(shadowTex),transparent:true,depthWrite:false});
    function contact(){const s=new T.Mesh(new T.PlaneGeometry(1,1),sm);s.rotation.x=-Math.PI/2;scene.add(s);return s;}
    const shoeShadow=contact(),carShadow=contact();
    function size(){
      const w=panel.clientWidth,h=panel.clientHeight;if(!w||!h)return;
      const worldH=3.32,worldW=worldH*w/h;
      camera.left=-worldW/2;camera.right=worldW/2;camera.top=worldH/2;camera.bottom=-worldH/2;camera.updateProjectionMatrix();
      // Fit the actual three-quarter silhouette. Keep the nearest bodywork behind the driver.
      const scale=isBike ? Math.min(2.75,worldW*.48) : Math.min(worldW*.95/extent.x,1.82/extent.y,6.1);
      car.scale.setScalar(scale);
      if(isBike) car.position.set(worldW*.135,.015,-.75);
      else car.position.set(worldW*.01-center.x*scale,.015,-.12-bounds.max.z*scale);
      pilot.position.set(-worldW*.205,0,.32);
      shoeShadow.position.copy(pilot.position);shoeShadow.position.y=.003;shoeShadow.scale.set(.91,.73,1);
      carShadow.position.set(car.position.x+center.x*scale,.006,car.position.z+center.z*scale);
      carShadow.scale.set(extent.x*scale,extent.z*scale,1);
      renderer.setSize(w,h,false);renderer.render(scene,camera);
    }
    const reduced=matchMedia('(prefers-reduced-motion: reduce)');let last=0;
    size();panel.classList.add('ready');new ResizeObserver(size).observe(panel);
    function draw(now){if(!document.hidden&&!reduced.matches&&now-last>45){
      last=now;pilot.morphTargetInfluences[0]=.5-.5*Math.cos(now*.00155);renderer.render(scene,camera);
    }requestAnimationFrame(draw);}
    canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();panel.classList.remove('ready')});
    canvas.addEventListener('webglcontextrestored',()=>{size();panel.classList.add('ready')});
    requestAnimationFrame(draw);
  }catch(err){console.warn('Podium uses the illustrated fallback.',err);}
})();
