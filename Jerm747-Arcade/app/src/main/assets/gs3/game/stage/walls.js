/* Wall workshop built from the user's untextured Meshy FBX geometry. */
window.createStageWalls=function(T,scene){
 const data=window.GSF_WALL_MESH,group=new T.Group();group.name='Wall workshop';scene.add(group);
 function unpack(text,Type){const bytes=Uint8Array.from(atob(text),c=>c.charCodeAt(0));return new Type(bytes.buffer);}
 const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.BufferAttribute(unpack(data.positions,Float32Array),3));geometry.setIndex(new T.BufferAttribute(unpack(data.indices,Uint32Array),1));geometry.computeVertexNormals();
 const stoneSurface=getArenaStone(T,scene);
 const settings={layout:'scenic',height:1.5,distance:6,opacity:1,autoFade:true};
 let panels=[];const center=new T.Vector3(),view=new T.Vector3(),rel=new T.Vector3();
 function rebuild(){
  for(const m of panels){group.remove(m);m.material.dispose();const i=stoneSurface.materials.indexOf(m.material);if(i>=0)stoneSurface.materials.splice(i,1);}panels=[];
  function panel(x,z,angle){
   const material=stoneSurface.make();material.transparent=true;material.opacity=settings.opacity;material.side=T.DoubleSide;material.depthWrite=settings.opacity>.98;

   const m=new T.Mesh(geometry,material);m.position.set(x,0,z);m.rotation.y=angle;m.scale.setScalar(settings.height);m.receiveShadow=true;m.userData.fade=1;group.add(m);panels.push(m);
  }
  const h=settings.height,w=data.width*h,d=settings.distance;
  if(settings.layout==='scenic'){
   panel(-9,-d,.35);panel(9,-d,-.35);
  }else if(settings.layout==='rear'){
   // Three separate runs with two walk-through gaps; side runs angle inward.
   for(const k of [-1,1])for(const j of [0,1])panel(k*(w*1.35+j*w*.92),-d+(j?1:0),-k*.22);
   panel(0,-d-.35,0);
  }else if(settings.layout==='straight'){
   for(let i=-2;i<=2;i++)panel(i*w*.98,-d,0);
  }else if(settings.layout==='circle'){
   const n=Math.min(48,Math.max(12,Math.round(2*Math.PI*d/w)));
   for(let i=0;i<n;i++){const a=i/n*Math.PI*2;
    // Leave a gateway at the back, aligned with the existing stone path.
    if(Math.abs(a-Math.PI)<.16)continue;
    panel(Math.sin(a)*d,Math.cos(a)*d,a);
   }
  }
 }
 function set(key,value){
  if(key==='layout'){if(!['scenic','rear','straight','circle','off'].includes(value))return;settings.layout=value;rebuild();}
  else if(key==='autoFade')settings.autoFade=!!value;
  else if(['height','distance','opacity'].includes(key)&&Number.isFinite(value)){
   const lim={height:[1,3.5],distance:[5,11],opacity:[.1,1]}[key];settings[key]=T.MathUtils.clamp(value,...lim);if(key!=='opacity')rebuild();
  }
 }
 function update(dt,camera,focus,fighterHalfSpan=0){
  center.copy(focus);view.copy(camera.position).sub(center);view.y=0;view.normalize();
  for(const m of panels){
   rel.copy(m.position).sub(center);rel.y=0;
   const front=rel.dot(view),lateral=Math.abs(rel.x*view.z-rel.z*view.x);
   // Fade near-side walls across the view corridor, including oblique side views.
   const obstructs=front>.4&&lateral<Math.max(4.2,fighterHalfSpan+data.width*settings.height*.75);
   const target=settings.autoFade&&obstructs?.06:1;
   m.userData.fade+=(target-m.userData.fade)*(1-Math.exp(-Math.min(dt,.1)*9));
   m.material.opacity=settings.opacity*m.userData.fade;
   m.material.depthWrite=m.material.opacity>.98;
  }
 }
 rebuild();
 return {settings,set,update,group,get panels(){return panels;},sourceTriangles:data.source_triangles,displayTriangles:data.triangles};
};
