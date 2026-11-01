/* GS Fighters · Motion Logic v1
 * The layer between preset animation clips and the skeleton. Rig-agnostic: works for any
 * Mixamo-named fighter, so all fighters share it.
 *
 * 1. CLIP ANALYSIS: every clip is sampled at 30 Hz once. For each frame we store a "pose
 *    signature": hip height, then feet, hands and head positions relative to the hips, plus
 *    their velocities. We also find each clip's lead-in (dead frames before motion starts),
 *    its active frame (moment of furthest forward reach of a hand or foot), and its net root travel.
 * 2. POSE MATCHING (entry point search): when a new move starts, compare the fighter's current
 *    signature against the target clip's frames and start the clip at the closest frame instead
 *    of frame 0. Loops (idle/walk/run) search the whole cycle, giving phase-matched feet.
 *    Strikes search only the first half of the windup.
 * 3. INERTIALIZATION: at the switch, record the difference between where each bone IS
 *    (and how fast it is moving) and where the new clip wants it. That difference decays to zero
 *    through a critically damped spring, the PD-controller form of a control loop, so
 *    pose and momentum stay continuous. Hips settle first, then legs/spine, then head, arms and hands.
 */
(function(){'use strict';
const T=THREE,FPS=30,EPS=1e-6,TAU=Math.PI*2;
// Signature: [hipsY, then x/y/z for each point]. Weights reflect "groin first, then feet, hands, head".
const POINTS=[['LeftFoot',1.6],['RightFoot',1.6],['LeftHand',1],['RightHand',1],['Head',.8]];
const HIPS_W=3,VEL_W=.06,D=1+POINTS.length*3;
const W=new Float32Array(D);W[0]=HIPS_W;POINTS.forEach(([,w],i)=>W.fill(w,1+i*3,4+i*3));
// Settle-order factors: multiplied by the master settle half-life. Small = arrives first.
function settleFactor(name){
 if(/Hips/.test(name))return .5;
 if(/UpLeg|LeftLeg|RightLeg/.test(name))return .7;
 if(/Foot|Toe/.test(name))return .75;
 if(/Spine/.test(name))return .75;
 if(/Neck|Head|headfront/.test(name))return .95;
 if(/Shoulder/.test(name))return .95;
 if(/ForeArm/.test(name))return 1.15;
 if(/Arm/.test(name))return 1.05;
 return 1.25; // hands, fingers, accessories
}
const tmpQ=new T.Quaternion(),tmpQ2=new T.Quaternion(),tmpV=new T.Vector3();
// Rotation vector (axis * angle) helpers. Shortest arc enforced.
function quatToVec(x,y,z,w,out,o){if(w<0){x=-x;y=-y;z=-z;w=-w;}const s=Math.sqrt(x*x+y*y+z*z);if(s<EPS){out[o]=2*x;out[o+1]=2*y;out[o+2]=2*z;return;}const a=2*Math.atan2(s,w)/s;out[o]=x*a;out[o+1]=y*a;out[o+2]=z*a;}
function vecToQuat(x,y,z,q){const a=Math.sqrt(x*x+y*y+z*z);if(a<EPS)return q.set(x*.5,y*.5,z*.5,1).normalize();const s=Math.sin(a/2)/a;return q.set(x*s,y*s,z*s,Math.cos(a/2));}
// Critically damped spring toward zero (Holden, "Spring-It-On"). Halflife in seconds.
function decay(x,v,i,hl,dt){const y=(4*Math.LN2)/(hl+EPS)/2,j1=v[i]+x[i]*y,e=Math.exp(-y*dt);x[i]=e*(x[i]+j1*dt);v[i]=e*(v[i]-j1*y*dt);}
function search(times,t){let lo=0,hi=times.length-1;if(t<=times[0])return 0;if(t>=times[hi])return hi-1<0?0:hi-1;while(hi-lo>1){const m=(lo+hi)>>1;if(times[m]<=t)lo=m;else hi=m;}return lo;}

function analyzeRig(data){
 const n=data.bones.length,parents=Int32Array.from(data.bones.map(b=>b.parent));
 const restP=new Float32Array(n*3),restQ=new Float32Array(n*4);data.bones.forEach((b,i)=>{restP.set(b.position,i*3);restQ.set(b.quaternion,i*4);});
 const find=s=>data.bones.findIndex(b=>b.name.replace(/^.*:/,'')===s);
 const hips=find('Hips'),points=POINTS.map(([s])=>find(s)),reachers=['LeftHand','RightHand','LeftFoot','RightFoot'].map(find);
 const factors=Float32Array.from(data.bones.map(b=>settleFactor(b.name))),core=data.bones.map(b=>/Hips|Spine/.test(b.name));
 const wq=new Float32Array(n*4),wp=new Float32Array(n*3);
 // Forward kinematics in rig space (rotation + translation; bone scale is ~1 on these rigs).
 function fk(P,Q){for(let i=0;i<n;i++){const p=parents[i];if(p<0){wq.set(Q.subarray(i*4,i*4+4),i*4);wp.set(P.subarray(i*3,i*3+3),i*3);continue;}
  tmpQ.fromArray(wq,p*4);tmpV.fromArray(P,i*3).applyQuaternion(tmpQ);wp[i*3]=wp[p*3]+tmpV.x;wp[i*3+1]=wp[p*3+1]+tmpV.y;wp[i*3+2]=wp[p*3+2]+tmpV.z;tmpQ2.fromArray(Q,i*4);tmpQ.multiply(tmpQ2);tmpQ.toArray(wq,i*4);}return wp;}
 function features(P,Q,out,o=0){const w=fk(P,Q),hx=w[hips*3],hy=w[hips*3+1],hz=w[hips*3+2];out[o]=hy;points.forEach((b,k)=>{out[o+1+k*3]=w[b*3]-hx;out[o+2+k*3]=w[b*3+1];out[o+3+k*3]=w[b*3+2]-hz;});return out;}
 const clips=new Map(),sources=new Map(data.clips.map(c=>[c.name,c]));
 function prepareTracks(c){const tr=new Array(n).fill(null).map(()=>({t:null,r:null}));for(const k of c.tracks){if(k.path==='translation')tr[k.bone].t={times:Float32Array.from(k.times),values:Float32Array.from(k.values)};else if(k.path==='rotation')tr[k.bone].r={times:Float32Array.from(k.times),values:Float32Array.from(k.values)};}return tr;}
 function sampleInto(tracks,t,P,Q){P.set(restP);Q.set(restQ);for(let i=0;i<n;i++){const a=tracks[i].t,b=tracks[i].r;
  if(a){const k=search(a.times,t),k1=Math.min(k+1,a.times.length-1),span=a.times[k1]-a.times[k],u=span>0?Math.min(1,Math.max(0,(t-a.times[k])/span)):0;for(let d=0;d<3;d++)P[i*3+d]=a.values[k*3+d]+(a.values[k1*3+d]-a.values[k*3+d])*u;}
  if(b){const k=search(b.times,t),k1=Math.min(k+1,b.times.length-1),span=b.times[k1]-b.times[k],u=span>0?Math.min(1,Math.max(0,(t-b.times[k])/span)):0;T.Quaternion.slerpFlat(Q,i*4,b.values,k*4,b.values,k1*4,u);}}}
 function clip(name){if(clips.has(name))return clips.get(name);const c=sources.get(name);if(!c)return null;
  const tracks=prepareTracks(c),dur=c.duration,count=Math.max(2,Math.ceil(dur*FPS)+1),times=new Float32Array(count),feat=new Float32Array(count*D),vel=new Float32Array(count*D),root=new Float32Array(count*3),reach=new Float32Array(count);
  const P=new Float32Array(n*3),Q=new Float32Array(n*4);
  for(let f=0;f<count;f++){const t=Math.min(dur,f/FPS);times[f]=t;sampleInto(tracks,t,P,Q);features(P,Q,feat,f*D);const w=wp;root.set([w[hips*3],w[hips*3+1],w[hips*3+2]],f*3);let r=-Infinity;for(const b of reachers)r=Math.max(r,w[b*3+2]-w[hips*3+2]);reach[f]=r;}
  for(let f=0;f<count;f++){const a=Math.max(0,f-1),b=Math.min(count-1,f+1),dt=times[b]-times[a]||1;for(let d=0;d<D;d++)vel[f*D+d]=(feat[b*D+d]-feat[a*D+d])/dt;}
  // Lead-in: frames before any limb or the hips moves 2.5 cm from the opening pose.
  let lead=0;for(let f=1;f<count;f++){let m=Math.abs(feat[f*D]-feat[0])*2;for(let d=1;d<D;d++)m=Math.max(m,Math.abs(feat[f*D+d]-feat[d]));if(m>.025){lead=Math.max(0,f-1);break;}}
  const leadIn=Math.min(times[lead],dur*.3);
  // Active frame: furthest forward reach of a hand or foot ahead of the hips, after the lead-in.
  let best=lead,bestR=-Infinity;for(let f=lead;f<count;f++)if(reach[f]>bestR){bestR=reach[f];best=f;}
  // Ground speed: how fast the planted (lower) foot slides back under the body. For walk/run clips this is the
  // speed the clip "wants" to travel at; playing it at worldSpeed/groundSpeed removes foot skating.
  const gs=[];for(let f=0;f<count;f++){const ly=feat[f*D+2],ry=feat[f*D+5],k=ly<ry?3:6;gs.push(Math.abs(vel[f*D+k]));}gs.sort((x,y)=>x-y);
  // Airborne window: longest run of frames where both feet are clearly off the floor (takeoff → landing).
  let base=Infinity;for(let f=0;f<count;f++)base=Math.min(base,feat[f*D+2],feat[f*D+5]);
  let air=null,run=null;for(let f=0;f<count;f++){const up=Math.min(feat[f*D+2],feat[f*D+5])>base+.08;if(up){if(!run)run=[times[f],times[f]];run[1]=times[f];}if((!up||f===count-1)&&run){if(!air||run[1]-run[0]>air[1]-air[0])air=run;run=null;}}
  const info={name,duration:dur,air,groundSpeed:gs[Math.floor(gs.length*.5)],count,times,feat,vel,root,reach,leadIn,activeAt:times[best],reachMax:bestR,
   net:{x:root[(count-1)*3]-root[0],z:root[(count-1)*3+2]-root[2]},
   sample:(t,P2,Q2)=>sampleInto(tracks,Math.max(0,Math.min(dur,t)),P2,Q2),
   hipsZ:t=>{const a=tracks[hips].t;if(!a)return restP[hips*3+2];const k=search(a.times,t),k1=Math.min(k+1,a.times.length-1),span=a.times[k1]-a.times[k],u=span>0?Math.min(1,Math.max(0,(t-a.times[k])/span)):0;return a.values[k*3+2]+(a.values[k1*3+2]-a.values[k*3+2])*u;}};
  clips.set(name,info);return info;}
 // Best frame of clip `info` for the current signature, inside [t0,t1]. timeBias prefers earlier frames.
 function findEntry(info,cur,curVel,speed,t0,t1,timeBias=0){let best=null;const span=Math.max(info.duration,.001);
  for(let f=0;f<info.count;f++){const t=info.times[f];if(t<t0-EPS||t>t1+EPS)continue;let c=0;
   for(let d=0;d<D;d++){const e=info.feat[f*D+d]-cur[d],v=info.vel[f*D+d]*speed-curVel[d];c+=W[d]*(e*e+VEL_W*v*v);}
   c+=timeBias*(t-t0)/span;if(!best||c<best.cost)best={time:t,cost:c};}
  return best||{time:t0,cost:Infinity};}
 return {n,hips,parents,restP,restQ,factors,core,features,clip,findEntry,D};
}

class Inertializer{
 constructor(factors,core,rootMask){const n=factors.length;this.n=n;this.f=factors;this.core=core||factors.map(f=>f<=.5);this.root=rootMask||factors.map((f,i)=>i===0);this.snaps=0;this.or=new Float32Array(n*3);this.vr=new Float32Array(n*3);this.op=new Float32Array(n*3);this.vp=new Float32Array(n*3);this.active=false;this.scale=1;}
 reset(){this.or.fill(0);this.vr.fill(0);this.op.fill(0);this.vp.fill(0);this.active=false;}
 // prev*: what the skeleton shows now (pose + velocity). next*: what the new clip wants.
 start(prevP,prevQ,prevVP,prevVR,nextP,nextQ,nextVP,nextVR){const r=[0,0,0];
  // v0.14 stability rules (fixes the torso twist/stretch when moves are restarted rapidly):
  // a blend restarted on top of a running blend keeps only 35% of its momentum; carried spin is capped at 8 rad/s
  // and dropped near a half-turn, where the shortest way round can flip; only the hips get position offsets,
  // so bones always keep their animated lengths.
  const carry=this.active?.35:1;
  for(let i=0;i<this.n;i++){
   tmpQ2.fromArray(nextQ,i*4).invert();tmpQ.fromArray(prevQ,i*4).multiply(tmpQ2);quatToVec(tmpQ.x,tmpQ.y,tmpQ.z,tmpQ.w,r,0);
   const ang=Math.hypot(r[0],r[1],r[2]);let w=0;
   for(let d=0;d<3;d++){const k=i*3+d;this.or[k]=r[d];this.vr[k]=(prevVR[k]-nextVR[k])*carry;w+=this.vr[k]*this.vr[k];}
   w=Math.sqrt(w);const ws=ang>2.6?0:w>8?8/w:1;for(let d=0;d<3;d++)this.vr[i*3+d]*=ws;
   for(let d=0;d<3;d++){const k=i*3+d;if(this.root[i]){this.op[k]=prevP[k]-nextP[k];this.vp[k]=Math.max(-2,Math.min(2,(prevVP[k]-nextVP[k])*carry));}else{this.op[k]=0;this.vp[k]=0;}}}
  // Big re-orientations of the core take longer: a 90-degree hip turn should not snap in 0.1 s.
  let core=0;for(let i=0;i<this.n;i++)if(this.core[i])core=Math.max(core,Math.hypot(this.or[i*3],this.or[i*3+1],this.or[i*3+2]));
  this.scale=Math.min(2.5,Math.max(1,1+(core-.35)/.7));this.active=true;return core;}
 update(dt,halflife){if(!this.active)return;if(halflife<=0){this.reset();return;}let m=0;for(let i=0;i<this.n;i++){const hl=halflife*this.f[i]*this.scale;for(let d=0;d<3;d++){const k=i*3+d;decay(this.or,this.vr,k,hl,dt);decay(this.op,this.vp,k,hl,dt);m=Math.max(m,Math.abs(this.or[k]),Math.abs(this.op[k])*4);}}
  // Safety net: an offset this large is never a good-looking blend; snap to the clean animated pose.
  if(m>3.05){this.snaps++;this.reset();return;}if(m<1e-4)this.reset();}
 apply(P,Q){if(!this.active)return;for(let i=0;i<this.n;i++){const k=i*3;vecToQuat(this.or[k],this.or[k+1],this.or[k+2],tmpQ);tmpQ2.fromArray(Q,i*4);tmpQ.multiply(tmpQ2).normalize();tmpQ.toArray(Q,i*4);P[k]+=this.op[k];P[k+1]+=this.op[k+1];P[k+2]+=this.op[k+2];}}
}
window.MotionLogic={analyzeRig,Inertializer,quatToVec,FPS};
})();
