/* GS-style drag / pinch input, with unrestricted yaw for free flight. */
window.createArenaOrbit = function(canvas, camera, enabled) {
  const T=THREE, clamp=T.MathUtils.clamp, pointers=new Map(), focus=new T.Vector3();
  let yaw=0,pitch=.17,radius=4.65,stickX=0,stickY=0,dragging=false;
  function rotate(dx,dy){yaw-=dx;pitch=clamp(pitch+dy,-.35,1.22);}
  function reset(){yaw=0;pitch=.17;radius=4.65;clear();}
  function clear(){pointers.clear();stickX=stickY=0;dragging=false;canvas.classList.remove('orbiting');}
  function span(){const [a,b]=pointers.values();return Math.hypot(a.x-b.x,a.y-b.y);}
  canvas.addEventListener('pointerdown',e=>{
    if(!enabled()||pointers.size>=2||(e.pointerType==='mouse'&&e.button!==0))return;
    e.preventDefault();canvas.focus({preventScroll:true});canvas.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});dragging=true;canvas.classList.add('orbiting');
  });
  canvas.addEventListener('pointermove',e=>{
    const prev=pointers.get(e.pointerId);if(!prev||!enabled())return;
    const dx=e.clientX-prev.x,dy=e.clientY-prev.y,oldSpan=pointers.size===2?span():0;
    prev.x=e.clientX;prev.y=e.clientY;
    if(oldSpan>1)radius=clamp(radius*oldSpan/Math.max(1,span()),2.6,17.5);
    else if(pointers.size===1)rotate(dx*.008,dy*.006);
  });
  function release(e){pointers.delete(e.pointerId);if(!pointers.size){dragging=false;canvas.classList.remove('orbiting');}}
  for(const name of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(name,release);
  canvas.addEventListener('wheel',e=>{if(enabled()){e.preventDefault();radius=clamp(radius*Math.exp(clamp(e.deltaY,-160,160)*.0016),2.6,17.5);}},{passive:false});
  function update(x,y,z,dt,snap=false){
    if(!dragging)rotate(-stickX*dt*2.15,-stickY*dt*1.45);
    const follow=snap?1:1-Math.exp(-10*dt);focus.x+=(x-focus.x)*follow;focus.y+=(y-focus.y)*follow;focus.z+=(z-focus.z)*follow;
    const sx=Math.sin(yaw),sz=Math.cos(yaw),rx=17.05,rz=14.0;
    // Intersect the camera ray with the inner parapet before placing the eye.
    const a=(sx/rx)**2+(sz/rz)**2,b=focus.x*sx/rx**2+focus.z*sz/rz**2,c=(focus.x/rx)**2+(focus.z/rz)**2-1;
    const maxHorizontal=(-b+Math.sqrt(Math.max(0,b*b-a*c)))/a;
    const h=Math.min(radius*Math.cos(pitch),Math.max(.72,maxHorizontal-.1));
    camera.position.set(focus.x+sx*h,Math.max(.35,focus.y+radius*Math.sin(pitch)),focus.z+sz*h);
    camera.lookAt(focus);
  }
  return {update,reset,clear,rotate,zoom(){radius=radius<7?9:radius<13?16:4.65;return radius<7?"Close":radius<13?"Wide":"Arena"},get yaw(){return yaw;},stick(x,y){stickX=Math.abs(x)>.16?x:0;stickY=Math.abs(y)>.16?y:0;}};
};
