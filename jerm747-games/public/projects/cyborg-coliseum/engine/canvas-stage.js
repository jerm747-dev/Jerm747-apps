/* A camera ray hits either the stone floor or the inner elliptical wall. Both
   use world-space coordinates so a finger orbit or flight cannot slide the scenery. */
window.CyborgCanvasStage=class {
  constructor(){
    this.ground=document.createElement('canvas');this.context=this.ground.getContext('2d',{alpha:false});this.key='';
    const load=(name,w,h,assign)=>{
      const im=new Image();im.onload=()=>{const c=document.createElement('canvas');c.width=w;c.height=h;const ctx=c.getContext('2d');ctx.drawImage(im,0,0,w,h);assign(ctx.getImageData(0,0,w,h).data);this.key='';};
      im.src='assets/'+name+'.webp';
    };
    load('floor',256,256,data=>this.floor=data);load('coliseum',1024,512,data=>this.wall=data);
  }
  paint(c,camera,w,h){
    const m=camera.matrixWorld.elements,eye=camera.position;
    const key=[w,h,...[0,2,5,8,9,10,12,13,14].map(i=>m[i].toFixed(3))].join(',');
    if(this.key!==key){
      this.key=key;const gw=Math.min(w,600),gh=Math.max(1,Math.round(h*gw/w)),cv=this.ground;
      if(cv.width!==gw||cv.height!==gh||!this.img){cv.width=gw;cv.height=gh;this.img=this.context.createImageData(gw,gh);}
      const out=this.img.data,f=gh/(2*Math.tan(camera.fov*Math.PI/360)),A=1/17.65**2,B=1/14.65**2;
      const floor=this.floor,wall=this.wall,C=eye.x**2*A+eye.z**2*B-1,stepX=m[0]/f,stepZ=m[2]/f;
      for(let y=0;y<gh;y++){
        const v=(gh*.5-y-.5)/f,dy=-m[9]+m[5]*v,t=dy<-.0001?-eye.y/dy:-1;
        let dx=-m[8]+m[4]*v+(.5-gw*.5)*stepX,dz=-m[10]+m[6]*v+(.5-gw*.5)*stepZ;
        for(let x=0,k=4*y*gw;x<gw;x++,k+=4,dx+=stepX,dz+=stepZ){
          const gx=eye.x+t*dx,gz=eye.z+t*dz;
          let r=169,g=145,b=119;
          if(t>0&&gx*gx*A+gz*gz*B<1){
            if(floor){
              const i=4*((Math.floor(gx*62)&255)+256*(Math.floor(gz*62)&255));
              const distance=gx*gx+gz*gz/.83**2,inlay=(distance>24.65&&distance<25.5)||(distance>151.7&&distance<153.4);
              const shade=.93+.07*Math.min(1,8/t);
              r=inlay?166:floor[i]*shade;g=inlay?125:floor[i+1]*shade*.96;b=inlay?74:floor[i+2]*shade*.88;
            }
          }else{
            const a=dx*dx*A+dz*dz*B,halfB=dx*eye.x*A+dz*eye.z*B;
            const d=(-halfB+Math.sqrt(Math.max(0,halfB*halfB-a*C)))/Math.max(.000001,a);
            const height=eye.y+d*dy;
            if(height<12&&wall&&d>0){
              const phase=Math.atan2((eye.x+d*dx)/17.65,-(eye.z+d*dz)/14.65)*2/Math.PI+.5;
              const u=1-Math.abs(((phase%2+2)%2)-1),fy=Math.max(0,Math.min(511,Math.floor(512*(.764-height*.059))));
              const i=4*(Math.min(1023,Math.floor(u*1024))+fy*1024);
              r=wall[i];g=wall[i+1];b=wall[i+2];
            }else{const s=Math.min(1,Math.max(0,dy)*1.2);r=224-92*s;g=200-44*s;b=165+16*s;}
          }
          out[k]=r;out[k+1]=g;out[k+2]=b;out[k+3]=255;
        }
      }
      this.context.putImageData(this.img,0,0);
    }
    c.drawImage(this.ground,0,0,w,h);
  }
  shadow(c,obj,camera,w,h){
    const p=obj.getWorldPosition(new THREE.Vector3()),v=p.clone().project(camera);if(v.z< -1||v.z>1)return;
    const m=camera.matrixWorld.elements,side=new THREE.Vector3(m[0],0,m[2]).normalize(),front=new THREE.Vector3(m[8],0,m[10]).normalize();
    const edge=p.clone().addScaledVector(side,obj.geometry.parameters.width*obj.scale.x*.5).project(camera);
    const end=p.clone().addScaledVector(front,obj.geometry.parameters.height*obj.scale.y*.5).project(camera);
    const rx=Math.max(.1,Math.abs(edge.x-v.x)*w*.5),ry=Math.max(1,Math.abs(end.y-v.y)*h*.5);
    c.save();c.translate((v.x+1)*w*.5,(1-v.y)*h*.5);c.scale(rx,ry);
    const grad=c.createRadialGradient(0,0,0,0,0,1);grad.addColorStop(0,'rgba(20,16,12,.63)');grad.addColorStop(.48,'rgba(30,24,16,.38)');grad.addColorStop(1,'rgba(30,24,16,0)');
    c.fillStyle=grad;c.fillRect(-1,-1,2,2);c.restore();
  }
};
