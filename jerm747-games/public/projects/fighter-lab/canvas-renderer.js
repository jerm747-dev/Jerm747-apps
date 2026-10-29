/* CPU compatibility renderer for the same THREE scene and articulated geometry.
 * Used only when the device cannot create a WebGL context. No model substitution.
 */
window.FighterCanvasRenderer=class {
 constructor(){this.domElement=document.createElement('canvas');this.ctx=this.domElement.getContext('2d');this.shadowMap={};this.ratio=1;this.last=0;}
 setClearColor(){} setPixelRatio(r){this.ratio=Math.min(1,r);}
 setSize(w,h){this.w=w;this.h=h;this.domElement.width=Math.round(w*this.ratio);this.domElement.height=Math.round(h*this.ratio);}
 render(scene,camera){
  const now=performance.now();if(now-this.last<50)return;this.last=now;
  const T=THREE,w=this.domElement.width,h=this.domElement.height,c=this.ctx;
  c.clearRect(0,0,w,h);scene.updateMatrixWorld(true);camera.updateMatrixWorld(true);camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
  const faces=[],lines=[],a=new T.Vector3(),normal=new T.Vector3(),e1=new T.Vector3(),e2=new T.Vector3(),eye=new T.Vector3();camera.getWorldPosition(eye);
  const light=new T.Vector3(2.2,3.6,2.4).normalize(),rim=new T.Vector3(-2.5,1.8,-2.2).normalize();
  scene.traverseVisible(obj=>{
   if(!obj.geometry||(!obj.isMesh&&!obj.isLineSegments&&!obj.isPoints))return;
   const g=obj.geometry,p=g.attributes.position;if(!p)return;
   const mat=Array.isArray(obj.material)?obj.material[0]:obj.material;if(!mat||mat.visible===false)return;
   const screen=[],world=[];
   for(let i=0;i<p.count;i++){a.fromBufferAttribute(p,i).applyMatrix4(obj.matrixWorld);world.push(a.x,a.y,a.z);a.project(camera);screen.push((a.x*.5+.5)*w,(-a.y*.5+.5)*h,a.z);}
   if(obj.isMesh){
    const indices=g.index?.array,n=indices?indices.length:p.count;
    for(let i=0;i<n;i+=3){const ai=indices?indices[i]:i,bi=indices?indices[i+1]:i+1,ci=indices?indices[i+2]:i+2,A=ai*3,B=bi*3,C=ci*3;
     if(screen[A+2]<-1||screen[B+2]<-1||screen[C+2]<-1||screen[A+2]>1||screen[B+2]>1||screen[C+2]>1)continue;
     e1.set(world[B]-world[A],world[B+1]-world[A+1],world[B+2]-world[A+2]);e2.set(world[C]-world[A],world[C+1]-world[A+1],world[C+2]-world[A+2]);normal.crossVectors(e1,e2).normalize();
     const facing=normal.x*(eye.x-world[A])+normal.y*(eye.y-world[A+1])+normal.z*(eye.z-world[A+2]);
     if(facing<=0&&mat.side!==T.DoubleSide)continue;if(facing<0)normal.negate();
     const basic=mat.isMeshBasicMaterial,illum=basic?1:.45+.56*Math.max(0,normal.dot(light))+.14*Math.max(0,normal.dot(rim));
     const color=mat.color.clone().multiplyScalar(illum);
     faces.push({x1:screen[A],y1:screen[A+1],x2:screen[B],y2:screen[B+1],x3:screen[C],y3:screen[C+1],order:obj.renderOrder,z:(screen[A+2]+screen[B+2]+screen[C+2])/3,color:color.getStyle(),wire:mat.wireframe,opacity:mat.opacity});
    }
   }else if(obj.isLineSegments){const ix=g.index?.array,n=ix?ix.length:p.count;for(let i=0;i<n;i+=2){const A=(ix?ix[i]:i)*3,B=(ix?ix[i+1]:i+1)*3;if(screen[A+2]<-1||screen[A+2]>1)continue;lines.push({a:screen.slice(A,A+2),b:screen.slice(B,B+2),color:mat.color.getStyle(),opacity:mat.opacity,overlay:mat.depthTest===false});}}
  });
  faces.sort((a,b)=>a.order-b.order||b.z-a.z);for(const f of faces){c.globalAlpha=f.opacity;c.beginPath();c.moveTo(f.x1,f.y1);c.lineTo(f.x2,f.y2);c.lineTo(f.x3,f.y3);c.closePath();if(f.wire){c.strokeStyle=f.color;c.lineWidth=.7;c.stroke();}else{c.fillStyle=f.color;c.fill();}}
  for(const l of lines){c.globalAlpha=l.overlay?1:(l.opacity??.4)*.65;c.strokeStyle=l.color;c.lineWidth=l.overlay?1.5:.5;c.beginPath();c.moveTo(...l.a);c.lineTo(...l.b);c.stroke();}c.globalAlpha=1;
 }
};
