/* Armor-mounted hardware follows the animated rib cage. Directions are reconstructed
   from the actual shoulders and spine so they remain stable across borrowed clips. */
window.createCyborgSystems = function(scene,actor,rig,makeGlow) {
  const T=THREE,clamp=T.MathUtils.clamp,vec=()=>new T.Vector3(),mix=(a,b,k)=>a+(b-a)*k;
  const bones=Object.fromEntries(rig.data.bones.map((b,i)=>[b.name.split(':').pop(),rig.bones[i]]));
  const forward=vec(),right=vec(),up=vec(),p=vec(),desired=vec(),current=vec(),basis=new T.Matrix4();
  const parentQ=new T.Quaternion(),deltaQ=new T.Quaternion(),identity=new T.Quaternion();
  const frame=new T.Group();scene.add(frame);
  const lit=(color,opacity=1)=>new T.MeshBasicMaterial({color,transparent:opacity<1,opacity,depthWrite:opacity>=1,blending:opacity<1?T.AdditiveBlending:T.NormalBlending});
  const body=new T.MeshStandardMaterial({color:0x26333d,metalness:.8,roughness:.36}),rim=new T.MeshStandardMaterial({color:0x8daab3,metalness:.68,roughness:.32});
  function mesh(parent,geometry,material,x=0,y=0,z=0){const item=new T.Mesh(geometry,material);item.position.set(x,y,z);parent.add(item);return item;}
  const muzzle=new T.Group();muzzle.position.set(0,.015,.179);frame.add(muzzle);
  const emitter=mesh(muzzle,new T.CylinderGeometry(.074,.089,.035,8),body);emitter.rotation.x=Math.PI/2;
  mesh(muzzle,new T.TorusGeometry(.062,.008,5,16),rim,0,0,.022);
  const iris=mesh(muzzle,new T.CircleGeometry(.055,12),lit(0x56d7fb),0,0,.026);
  const corona=makeGlow(0x77eaff);muzzle.add(corona);corona.position.z=.035;
  const light=new T.PointLight(0x83e8ff,0,2.5);muzzle.add(light);rig.mesh.userData.chestLight=light;light.position.z=.13;
  const flames=[];
  for(const side of [-1,1]){
    const vent=new T.Group();vent.position.set(side*.114,-.055,-.14);vent.rotation.x=.52;frame.add(vent);
    mesh(vent,new T.CylinderGeometry(.052,.073,.109,8),body);
    mesh(vent,new T.CylinderGeometry(.071,.065,.023,8),rim,0,-.052);
    const plume=new T.Group();plume.position.y=-.07;vent.add(plume);flames.push(plume);
    for(const [r,h,color,opacity] of [[.078,.66,0x1567ff,.42],[.052,.47,0x1cdbff,.84],[.029,.26,0xe6ffff,1]]){
      const cone=mesh(plume,new T.ConeGeometry(r,h,9),lit(color,opacity),0,-h/2);cone.rotation.z=Math.PI;
    }
    const bloom=makeGlow(0x36bcff);bloom.scale.setScalar(.30);plume.add(bloom);bloom.position.y=-.11;
  }
  const boltGeo=new T.CylinderGeometry(.023,.023,.39,8),outerGeo=new T.CylinderGeometry(.051,.025,.48,8);
  boltGeo.rotateX(Math.PI/2);outerGeo.rotateX(Math.PI/2);
  const white=lit(0xe4ffff),blue=lit(0x29cfff,.63),bolts=[];
  for(let i=0;i<12;i++){
    const group=new T.Group();scene.add(group);group.visible=false;
    mesh(group,outerGeo,blue,0,0,-.20);mesh(group,boltGeo,white,0,0,-.16);
    const glow=makeGlow(0x29bfff);glow.scale.setScalar(.25);group.add(glow);
    bolts.push({group,dir:vec(),age:0});
  }
  const flight={on:false,y:0,vy:0,vx:0,vz:0,landing:false,liftOff:false};
  let lagX=0,lagZ=0,lagVY=0,weight=0,heat=0,cooldown=0,fired=0,descendAt=0,fireTap=false;
  function reset(){
    Object.assign(flight,{on:false,y:0,vy:0,vx:0,vz:0,landing:false,liftOff:false});lagX=lagZ=lagVY=weight=heat=cooldown=fired=0;fireTap=false;
    for(const b of bolts)b.group.visible=false;for(const f of flames)f.visible=false;
  }
  function ascend(height){
    flight.landing=false;
    if(!flight.on){flight.on=true;flight.y=Math.max(.02,height);flight.vy=2.0;flight.liftOff=flight.y<.65;}
  }
  function lower(seconds){if(flight.on){descendAt=seconds;flight.landing=false;flight.liftOff=false;}}
  function releaseLower(seconds){if(flight.on&&seconds-descendAt<.22)flight.landing=true;}
  function move(dt,x,z,boost,rise,lowering){
    if(!flight.on)return;
    const speed=boost?8.4:5.6,steer=1-Math.exp(-6.5*dt);
    flight.vx=mix(flight.vx,x*speed,steer);flight.vz=mix(flight.vz,z*speed,steer);
    const lifting=rise||flight.liftOff;
    const vertical=(lifting?1:0)-(lowering||flight.landing?1:0);
    flight.vy=mix(flight.vy,vertical*(vertical<0?3.9:4.5),1-Math.exp(-10*dt));
    flight.y=clamp(flight.y+flight.vy*dt,0,9);
    if(flight.y>=.68)flight.liftOff=false;
    if(flight.y>=9)flight.vy=Math.min(flight.vy,0);
    if(flight.y<=.012&&vertical<0){flight.on=false;flight.y=flight.vy=flight.vx=flight.vz=0;flight.landing=false;}
  }
  // Aim a bone in world space without relying on the rig's individual local axes.
  function aim(bone,child,x,y,z,strength){
    if(strength<.001)return;
    bone.parent.getWorldQuaternion(parentQ).invert();
    desired.set(x,y,z).normalize().applyQuaternion(actor.quaternion).applyQuaternion(parentQ);
    current.copy(child.position).normalize().applyQuaternion(bone.quaternion);
    deltaQ.setFromUnitVectors(current,desired);deltaQ.slerp(identity,1-strength);bone.quaternion.premultiply(deltaQ);
  }
  function pose(dt,angle,action,time){
    weight=mix(weight,flight.on?1:0,1-Math.exp(-11*dt));
    lagX=mix(lagX,flight.vx,1-Math.exp(-3.2*dt));lagZ=mix(lagZ,flight.vz,1-Math.exp(-3.2*dt));lagVY=mix(lagVY,flight.vy,1-Math.exp(-3.2*dt));
    if(weight>.002){
      const cx=Math.cos(angle),sz=Math.sin(angle),trailing=(lagX*sz+lagZ*cx)/7,side=(lagX*cx-lagZ*sz)/7,speed=Math.min(1,Math.hypot(flight.vx,flight.vz)/6);
      const kicking=['lk','mk','hk','sweep','jumpkick'].includes(action),punching=['lp','mp','hp','lance','airpunch'].includes(action);
      const banking=clamp(-side*.36,-.30,.30),tuck=clamp(-lagVY/4,0,1);
      const torsoWeight=weight*((punching||kicking) ? .32 : .92);
      aim(bones.Hips,bones.Spine,banking,1,.08+.56*speed,torsoWeight);
      aim(bones.Spine,bones.Spine1,banking,1,.12+.76*speed,torsoWeight);
      aim(bones.Neck,bones.Head,0,1,-.02,weight*.8);
      for(const [name,sign] of [['Left',1],['Right',-1]]){
        const leg=weight*(kicking ? .09 : 1),arm=weight*(punching ? .10 : 1);
        aim(bones[name+'UpLeg'],bones[name+'Leg'],sign*.15-side*.57,-1,-.14-trailing*.72+sign*.08+tuck*.24,leg*.94);
        aim(bones[name+'Leg'],bones[name+'Foot'],sign*.03-side*.28,-.8,-.32-trailing*.72-sign*.08-tuck*.38,leg);
        aim(bones[name+'Foot'],bones[name+'ToeBase'],sign*.07,-.62,.63,leg*.87);
        aim(bones[name+'Arm'],bones[name+'ForeArm'],sign*(.55-.12*speed),-.7,.16+.68*speed,arm*.91);
        aim(bones[name+'ForeArm'],bones[name+'Hand'],sign*.2,-.4,.65+.42*speed,arm*.88);
      }
    }
    actor.updateMatrixWorld(true);rig.skeleton.update();
    bones.RightArm.getWorldPosition(p);bones.LeftArm.getWorldPosition(right).sub(p).normalize();
    bones.Spine1.getWorldPosition(p);bones.Neck.getWorldPosition(up).sub(p).normalize();
    forward.crossVectors(right,up).normalize();right.crossVectors(up,forward).normalize();
    frame.quaternion.setFromRotationMatrix(basis.makeBasis(right,up,forward));bones.Spine2.getWorldPosition(frame.position);
    frame.updateMatrixWorld(true);
    for(let i=0;i<flames.length;i++){
      const f=flames[i];f.visible=weight>.06;
      const flicker=1+.11*Math.sin(time*49+i*1.8)+.07*Math.sin(time*87-i);
      f.scale.set(1,flicker*(.58+Math.max(0,flight.vy)*.11+Math.hypot(flight.vx,flight.vz)*.066)*weight,1);
    }
  }
  const axis=new T.Vector3(0,0,1),to=vec();
  function fire(angle,targets){
    const bolt=bolts.find(b=>!b.group.visible);if(!bolt)return false;
    const g=bolt.group;muzzle.getWorldPosition(g.position);bolt.dir.set(Math.sin(angle),0,Math.cos(angle));
    // Within Cyborg's forward cone, aim down or up to a nearby practice core.
    let best=-Infinity,aimTarget=null;
    for(const t of targets){
      t.core.getWorldPosition(to).sub(g.position);const length=to.length(),h=Math.hypot(to.x,to.z);
      if(h<.1||length>14)continue;
      const facing=(to.x*bolt.dir.x+to.z*bolt.dir.z)/h;
      if(facing<.906||Math.abs(to.y)>h*1.8)continue;
      const score=facing-length*.013;if(score>best){best=score;aimTarget=t;}
    }
    if(aimTarget){aimTarget.core.getWorldPosition(to);bolt.dir.copy(to).sub(g.position).normalize();}
    g.position.addScaledVector(bolt.dir,.035);g.quaternion.setFromUnitVectors(axis,bolt.dir);
    g.visible=true;bolt.age=0;heat=1;fired++;return true;
  }
  function weapon(dt,trigger,allowed,angle,targets,onHit,onFire){
    cooldown=Math.max(0,cooldown-dt);heat=Math.max(0,heat-dt*7.2);
    if(allowed&&(trigger||fireTap)&&cooldown===0&&fire(angle,targets)){cooldown=.18;onFire();}
    fireTap=false;
    iris.material.color.setHex(heat>.25?0xedffff:0x44b6d4);
    corona.scale.setScalar(.15+heat*.67);corona.material.opacity=.23+heat*.75;light.intensity=heat*2.7;
    for(const b of bolts){
      const g=b.group;if(!g.visible)continue;b.age+=dt;const distance=dt*19;
      for(const t of targets){
        t.core.getWorldPosition(to).sub(g.position);
        const along=clamp(to.dot(b.dir),0,distance);to.addScaledVector(b.dir,-along);
        if(to.lengthSq()<.52**2){g.visible=false;onHit(t);break;}
      }
      g.position.addScaledVector(b.dir,distance);
      if(b.age>1.08||g.position.y<.05||Math.hypot(g.position.x/17,g.position.z/14)>1.02)g.visible=false;
    }
  }
  reset();
  return {flight,ascend,lower,releaseLower,move,pose,weapon,reset,get shots(){return fired;},tapFire(){fireTap=true;},cancelFire(){fireTap=false;}};
};
