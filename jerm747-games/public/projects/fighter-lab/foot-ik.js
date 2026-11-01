/* GS Fighters · Foot planting (two-bone IK) v1
 * Runs last every frame, after the animation and transition layers and after the fighter is placed in the arena.
 * 1. Contact detection: a foot is "planted" when its ankle or toe is near the floor and barely moving in the world.
 * 2. Lock: on contact, the foot's world position is stored. While planted, the foot target stays on that spot,
 *    even if the body is still settling, drifting or walking at a slightly different speed from the clip.
 * 3. Two-bone IK: thigh and shin are rotated so the ankle lands on the target, keeping the knee in the animation's
 *    bend plane; the foot keeps the animation's world rotation.
 * 4. Release: when the animation lifts the foot, the lock is let go and the foot eases back to the animation over
 *    about 0.1 s. Locks also release if the leg would over-stretch or the animation moves too far from the spot.
 * Rig-agnostic: needs only Mixamo-named UpLeg/Leg/Foot/ToeBase bones.
 */
(function(){'use strict';
const T=THREE,V=()=>new T.Vector3(),Qn=()=>new T.Quaternion();
const ENTER=.035,EXIT=.065,ENTER_SPEED=.6,EXIT_SPEED=1.2,MAX_SLIP=.3,BLEND_IN=.06,BLEND_OUT=.12;
const a=V(),b=V(),c=V(),t=V(),u=V(),w=V(),axis=V(),q=Qn(),q2=Qn(),pq=Qn(),footQ=Qn();
function worldRotate(bone,R){bone.getWorldQuaternion(q2);bone.parent.getWorldQuaternion(pq);bone.quaternion.copy(pq.invert().multiply(R).multiply(q2));bone.updateMatrixWorld(true);}
// Two-bone solver: A=thigh, B=shin, C=foot. Moves C onto target, returns how far it was short (0 = reached).
function solve(A,B,C,target,stretch=.999){
 A.getWorldPosition(a);B.getWorldPosition(b);C.getWorldPosition(c);C.getWorldQuaternion(footQ);
 const lab=a.distanceTo(b),lbc=b.distanceTo(c),reach=(lab+lbc)*stretch,want=a.distanceTo(target),d=Math.min(Math.max(want,Math.abs(lab-lbc)+1e-3),reach);
 // Step 1: bend the knee so hip→ankle distance equals d (law of cosines), in the leg's current bend plane.
 const cur=Math.acos(T.MathUtils.clamp(u.subVectors(a,b).normalize().dot(w.subVectors(c,b).normalize()),-1,1));
 const next=Math.acos(T.MathUtils.clamp((lab*lab+lbc*lbc-d*d)/(2*lab*lbc),-1,1));
 axis.crossVectors(u.subVectors(a,b),w.subVectors(c,b));
 if(axis.lengthSq()<1e-8)axis.set(1,0,0).applyQuaternion(B.getWorldQuaternion(q));else axis.normalize(); // straight leg: knee hinge axis
 worldRotate(B,q.setFromAxisAngle(axis,next-cur));
 // Step 2: swing the whole leg from the hip so the ankle points at the target.
 C.getWorldPosition(c);u.subVectors(c,a).normalize();w.subVectors(target,a).normalize();
 if(u.dot(w)<.99999999)worldRotate(A,q.setFromUnitVectors(u,w));
 // Step 3: keep the animation's foot orientation.
 C.parent.getWorldQuaternion(pq);C.quaternion.copy(pq.invert().multiply(footQ));C.updateMatrixWorld(true);
 return Math.max(0,want-reach);}

window.createFootPlanter=function(rig){
 const find=s=>rig.bones.find(o=>o.name.endsWith('_'+s)||o.name.endsWith(':'+s)||o.name.endsWith(s));
 const feet=['Left','Right'].map(side=>{const f={side,A:find('mixamorig_'+side+'UpLeg')||find(side+'UpLeg'),B:find('mixamorig_'+side+'Leg'),C:find('mixamorig_'+side+'Foot'),D:find('mixamorig_'+side+'ToeBase'),
  locked:false,weight:0,cool:0,lock:V(),out:V(),from:V(),anim:V(),toe:V(),last:V(),hasLast:false,speed:0,height:0};return f;});
 if(feet.some(f=>!f.A||!f.B||!f.C))return null;
 rig.root.updateMatrixWorld(true);
 // Rest heights from the bind pose (rig root sits on the floor).
 for(const f of feet){f.restAnkle=f.C.getWorldPosition(V()).y-rig.root.getWorldPosition(V()).y;f.restToe=f.D?f.D.getWorldPosition(V()).y-rig.root.getWorldPosition(V()).y:f.restAnkle;}
 const api={feet,enabled:true,
  reset(){for(const f of feet){f.locked=false;f.weight=0;f.hasLast=false;}},
  // dt: frame time; allow: false during moves where the feet should be free (knock-down, get-up).
  update(dt,allow=true){const floor=rig.root.getWorldPosition(V()).y;rig.root.updateMatrixWorld(true);let touched=false;
   for(const f of feet){f.C.getWorldPosition(f.anim);if(f.D)f.D.getWorldPosition(f.toe);else f.toe.copy(f.anim);
    f.height=Math.min(f.anim.y-floor-f.restAnkle,f.toe.y-floor-f.restToe);
    f.speed=f.hasLast&&dt>0?Math.hypot(f.anim.x-f.last.x,f.anim.z-f.last.z)/dt:0;f.last.copy(f.anim);f.hasLast=true;
    const on=this.enabled&&allow;
    if(!on){f.locked=false;}
    else if(!f.locked&&f.cool<=0&&f.height<ENTER&&f.speed<ENTER_SPEED){f.locked=true;f.lock.copy(f.weight>0?f.out:f.anim);} // re-plant where the foot is shown, never pop
    else if(f.locked&&(f.height>EXIT||f.speed>EXIT_SPEED||f.anim.distanceTo(f.lock)>MAX_SLIP)){f.why=f.height>EXIT?'lift':f.anim.distanceTo(f.lock)>MAX_SLIP?'slip':'speed';f.locked=false;f.cool=.15;f.from.copy(f.lock);}
    if(f.locked){f.weight=Math.min(1,f.weight+dt/BLEND_IN);f.from.copy(f.lock);}else f.weight=Math.max(0,f.weight-dt/BLEND_OUT);
    f.cool-=dt;if(f.weight<=0)continue;
    const s=f.weight*f.weight*(3-2*f.weight);t.copy(f.anim).lerp(f.from,s);
    const short=solve(f.A,f.B,f.C,t);f.C.getWorldPosition(f.out);if(short>.04&&f.locked){f.why='stretch';f.cool=.15;f.locked=false;f.from.copy(f.lock);} // over-stretch: let go
    touched=true;}
   if(touched)rig.skeleton.update();return touched;}};
 return api;};
})();
