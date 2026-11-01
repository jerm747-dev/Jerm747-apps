/* Orthographic framing with continuous stone below the fighting lane. */
window.frameArenaView=function(T,camera,{aspect,zoom,lift=0,yaw=0,pitch=.08,centerX=0}){
 // Keep the existing orbit direction. Moving an orthographic camera along this
 // direction changes clipping depth, not the scene's apparent scale or angle.
 const dx=Math.sin(yaw),dy=Math.sin(pitch),dz=Math.cos(yaw)*Math.cos(pitch);
 const length=Math.hypot(dx,dy,dz),nx=dx/length,ny=dy/length,nz=dz/length;
 const upY=Math.sqrt(1-ny*ny),floorY=-.025;
 // A grounded fighter's feet sit at 2/3 of the scene height. Extra headroom at
 // close range keeps standing fighters in frame; jumps retain a gentle lift.
 const half=Math.max(1.4+lift*.7,Math.max(2,8.5/aspect)/zoom);
 const targetY=half/(3*upY)+lift*.35;
 // The lowest near-plane ray must start ABOVE the floor. Otherwise its ground
 // intersection is behind the camera and leaves a solid background strip.
 const baseline=14*length;
 const distance=Math.max(baseline,(half*upY-(targetY-floorY)+1)/ny);
 camera.left=-half*aspect;camera.right=half*aspect;
 camera.top=half;camera.bottom=-half;
 camera.near=.1;camera.far=distance+Math.max(120,2*half/ny);
 camera.position.set(centerX+nx*distance,targetY+ny*distance,nz*distance);
 camera.lookAt(centerX,targetY,0);camera.updateProjectionMatrix();
 return {half,targetY,distance,depthOffset:distance-baseline,
  groundExtent:Math.max(200,4*half/ny),direction:{x:nx,y:ny,z:nz}};
};
