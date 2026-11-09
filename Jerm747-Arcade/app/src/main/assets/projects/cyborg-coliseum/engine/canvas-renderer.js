/* CPU compatibility renderer for the same THREE scene and articulated geometry.
 * Used only when the device cannot create a WebGL context. No model substitution.
 */
window.FighterCanvasRenderer=class {
 constructor(){this.domElement=document.createElement('canvas');this.ctx=this.domElement.getContext('2d');this.shadowMap={};this.ratio=1;this.last=0;this.textureCache=new WeakMap();this.isFighterCanvasRenderer=true;this.viewport=null;this.plate=new CyborgCanvasStage();}
 setClearColor(){} setPixelRatio(r){this.ratio=Math.min(1,r);}
 setSize(w,h){this.viewport=null;this.w=w;this.h=h;this.domElement.width=Math.round(w*this.ratio);this.domElement.height=Math.round(h*this.ratio);}
 setViewport(x,y,w,h){this.viewport={x:x*this.ratio,y:y*this.ratio,w:w*this.ratio,h:h*this.ratio};}
 setScissor(){} setScissorTest(){}
 clear(){this.ctx.clearRect(0,0,this.domElement.width,this.domElement.height);}
 render(scene,camera,force=false){
  const now=performance.now();if(!force&&now-this.last<32)return;this.last=now;
  const T=THREE,vp=this.viewport,w=vp?vp.w:this.domElement.width,h=vp?vp.h:this.domElement.height,c=this.ctx;
  c.save();if(vp){c.translate(vp.x,this.domElement.height-vp.y-vp.h);c.beginPath();c.rect(0,0,w,h);c.clip();}
  c.clearRect(0,0,w,h);scene.updateMatrixWorld(true);camera.updateMatrixWorld(true);camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
  this.plate.paint(c,camera,w,h);
  const faces=[],lines=[],a=new T.Vector3(),normal=new T.Vector3(),e1=new T.Vector3(),e2=new T.Vector3(),eye=new T.Vector3();camera.getWorldPosition(eye);
  const light=new T.Vector3(2.2,3.6,2.4).normalize(),rim=new T.Vector3(-2.5,1.8,-2.2).normalize();
  scene.traverseVisible(obj=>{
   if(obj.isSprite&&obj.material.opacity>.02){
     const center=obj.getWorldPosition(new T.Vector3()),ndc=center.clone().project(camera);
     if(ndc.z<-1||ndc.z>1)return;
     const scale=obj.getWorldScale(new T.Vector3()),edge=center.addScaledVector(a.setFromMatrixColumn(camera.matrixWorld,0),scale.x*.5).project(camera);
     faces.push({glow:true,x:(ndc.x*.5+.5)*w,y:(.5-ndc.y*.5)*h,r:Math.max(1,Math.abs(edge.x-ndc.x)*w*.5),order:0,z:ndc.z,color:obj.material.color.getStyle(),opacity:obj.material.opacity});
     return;
   }
   if(!obj.geometry||(!obj.isMesh&&!obj.isLineSegments&&!obj.isPoints))return;
   if(obj.userData.contactShadow){this.plate.shadow(c,obj,camera,w,h);return;}
   if(obj.userData.canvasEffectImage)return;
   const g=obj.geometry,p=g.attributes.position;if(!p)return;
   const mat=Array.isArray(obj.material)?obj.material[0]:obj.material;if(!mat||mat.visible===false)return;
   if(mat.map?.image&&!this.textureCache.has(mat)){try{const im=mat.map.image,cv=document.createElement('canvas');cv.width=im.width;cv.height=im.height;const cx=cv.getContext('2d');cx.drawImage(im,0,0);this.textureCache.set(mat,{data:cx.getImageData(0,0,im.width,im.height).data,w:im.width,h:im.height});}catch{}}
   const screen=[],world=[];
   const chestLight=obj.userData.chestLight,lightPoint=chestLight?.intensity>.01?chestLight.getWorldPosition(new T.Vector3()):null;
   for(let i=0;i<p.count;i++){a.fromBufferAttribute(p,i);if(obj.isSkinnedMesh)obj.boneTransform(i,a);a.applyMatrix4(obj.matrixWorld);world.push(a.x,a.y,a.z);a.project(camera);screen.push((a.x*.5+.5)*w,(-a.y*.5+.5)*h,a.z);}
   if(obj.isMesh){
    const indices=g.index?.array,n=indices?indices.length:p.count;
    for(let i=0;i<n;i+=3){const ai=indices?indices[i]:i,bi=indices?indices[i+1]:i+1,ci=indices?indices[i+2]:i+2,A=ai*3,B=bi*3,C=ci*3;
     if(screen[A+2]<-1||screen[B+2]<-1||screen[C+2]<-1||screen[A+2]>1||screen[B+2]>1||screen[C+2]>1)continue;
     e1.set(world[B]-world[A],world[B+1]-world[A+1],world[B+2]-world[A+2]);e2.set(world[C]-world[A],world[C+1]-world[A+1],world[C+2]-world[A+2]);normal.crossVectors(e1,e2).normalize();
     const facing=normal.x*(eye.x-world[A])+normal.y*(eye.y-world[A+1])+normal.z*(eye.z-world[A+2]);
     if(facing<=0&&(obj.isSkinnedMesh||mat.side!==T.DoubleSide))continue;if(facing<0)normal.negate();
     const basic=mat.isMeshBasicMaterial,illum=basic?1:.74+.58*Math.max(0,normal.dot(light))+.2*Math.max(0,normal.dot(rim));
     const color=mat.color.clone().multiplyScalar(illum);
     if(this.textureCache.has(mat)&&g.attributes.uv){const uv=g.attributes.uv,u=(uv.getX(ai)+uv.getX(bi)+uv.getX(ci))/3,v=(uv.getY(ai)+uv.getY(bi)+uv.getY(ci))/3,t=this.textureCache.get(mat),x=Math.min(t.w-1,Math.max(0,Math.floor(u*t.w))),y=Math.min(t.h-1,Math.max(0,Math.floor((mat.map.flipY?1-v:v)*t.h))),k=(y*t.w+x)*4;color.setRGB(t.data[k]/255*illum,t.data[k+1]/255*illum,t.data[k+2]/255*illum);}
     if(obj.isSkinnedMesh){const sheen=.24*Math.pow(Math.max(0,normal.dot(light)),5)+.18*Math.pow(1-Math.abs(normal.dot(a.set(eye.x-world[A],eye.y-world[A+1],eye.z-world[A+2]).normalize())),3);color.r+=sheen;color.g+=sheen*1.03;color.b+=sheen*1.05;}
     if(lightPoint){const d=a.set(world[A],world[A+1],world[A+2]).distanceToSquared(lightPoint);const k=chestLight.intensity*Math.max(0,1-d/.20)*.23;color.r+=k*.17;color.g+=k*.72;color.b+=k;}
     faces.push({x1:screen[A],y1:screen[A+1],x2:screen[B],y2:screen[B+1],x3:screen[C],y3:screen[C+1],order:obj.renderOrder,z:(screen[A+2]+screen[B+2]+screen[C+2])/3,color:color.getStyle(),wire:mat.wireframe,opacity:mat.opacity});
    }
   }else if(obj.isLineSegments){const ix=g.index?.array,n=ix?ix.length:p.count;for(let i=0;i<n;i+=2){const A=(ix?ix[i]:i)*3,B=(ix?ix[i+1]:i+1)*3;if(screen[A+2]<-1||screen[A+2]>1)continue;lines.push({a:screen.slice(A,A+2),b:screen.slice(B,B+2),color:mat.color.getStyle(),opacity:mat.opacity,overlay:mat.depthTest===false});}}
  });
  faces.sort((a,b)=>a.order-b.order||b.z-a.z);for(const f of faces){c.globalAlpha=f.opacity;if(f.glow){const g=c.createRadialGradient(f.x,f.y,0,f.x,f.y,f.r);g.addColorStop(0,f.color);g.addColorStop(1,'transparent');c.globalCompositeOperation='lighter';c.fillStyle=g;c.fillRect(f.x-f.r,f.y-f.r,2*f.r,2*f.r);c.globalCompositeOperation='source-over';continue;}c.beginPath();c.moveTo(f.x1,f.y1);c.lineTo(f.x2,f.y2);c.lineTo(f.x3,f.y3);c.closePath();if(f.wire){c.strokeStyle=f.color;c.lineWidth=.7;c.stroke();}else{c.fillStyle=f.color;c.fill();}}
  for(const l of lines){c.globalAlpha=l.overlay?1:(l.opacity??.4)*.65;c.strokeStyle=l.color;c.lineWidth=l.overlay?1.5:.5;c.beginPath();c.moveTo(...l.a);c.lineTo(...l.b);c.stroke();}c.globalAlpha=1;c.restore();
 }
};
