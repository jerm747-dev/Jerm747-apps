/* Original FBX bind skeleton and skin weights. Clip playback goes through MotionLogic:
 * pose-matched entry points, per-move root policies and inertialized (momentum-preserving) transitions.
 * smart=false restores the v0.9 behaviour (frame-0 starts, snapshot crossfade, root travel) for A/B checks.
 */
(function(){
const T=THREE,ML=MotionLogic;
function unpack(text,Type){const b=atob(text),a=new Uint8Array(b.length);for(let i=0;i<b.length;i++)a[i]=b.charCodeAt(i);return new Type(a.buffer);}
window.createFighterRig=function(label,data,shared){
 const root=new T.Group();root.name=label;const g=shared?shared.mesh.geometry:new T.BufferGeometry();if(!shared){const raw=unpack(data.vertices,Float32Array),count=raw.length/8;
 for(const [name,size,start] of [['position',3,0],['normal',3,3],['uv',2,6]]){const a=new Float32Array(count*size);for(let i=0;i<count;i++)a.set(raw.subarray(i*8+start,i*8+start+size),i*size);g.setAttribute(name,new T.BufferAttribute(a,size));}
 g.setIndex(new T.BufferAttribute(unpack(data.indices,Uint32Array),1));g.setAttribute('skinIndex',new T.Uint16BufferAttribute(unpack(data.skinIndices,Uint16Array),4));g.setAttribute('skinWeight',new T.Float32BufferAttribute(unpack(data.skinWeights,Float32Array),4));
 }
 const mat=shared?shared.mesh.material:new T.MeshStandardMaterial({color:0xffffff,roughness:.85,metalness:.25,skinning:true,side:T.DoubleSide});
 const textures={},loader=new T.TextureLoader();const ready=shared?shared.ready:Promise.all(Object.entries(data.textures).map(([key,url])=>new Promise((resolve,reject)=>{textures[key]=loader.load(url,resolve,undefined,reject);}))).then(()=>{textures.color.encoding=T.sRGBEncoding;mat.map=textures.color;mat.normalMap=textures.normal;mat.normalScale=new T.Vector2(.5,.5);mat.roughnessMap=textures.metalRough;mat.metalnessMap=textures.metalRough;mat.needsUpdate=true;});
 const mesh=new T.SkinnedMesh(g,mat);mesh.name=label+'_Mesh';mesh.frustumCulled=false;mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);
 const bones=data.bones.map((b,i)=>{const o=new T.Bone();o.name=label+'_'+b.name.replace(':','_');o.position.fromArray(b.position);o.quaternion.fromArray(b.quaternion);o.scale.fromArray(b.scale);return o;});
 data.bones.forEach((b,i)=>(b.parent<0?root:bones[b.parent]).add(bones[i]));root.updateMatrixWorld(true);
 const skeleton=new T.Skeleton(bones,data.bones.map(b=>new T.Matrix4().fromArray(b.world).invert()));mesh.bind(skeleton,new T.Matrix4());if(!shared)mesh.normalizeSkinWeights();
 const clips=data.clips.map(c=>new T.AnimationClip(c.name,c.duration,c.tracks.map(t=>new (t.path==='rotation'?T.QuaternionKeyframeTrack:T.VectorKeyframeTrack)(bones[t.bone].name+'.'+({translation:'position',rotation:'quaternion',scale:'scale'}[t.path]),t.times,t.values))));
 const mixer=new T.AnimationMixer(root),rig=ML.analyzeRig(data),n=rig.n,H=rig.hips,hips=bones[H];

 // Pose buffers: raw = clip after root policy; out = what the skeleton shows (raw + inertial offset).
 const F=()=>new Float32Array(n*3),Q4=()=>new Float32Array(n*4);
 const rawP=F(),rawQ=Q4(),outP=F(),outQ=Q4(),prevP=F(),prevQ=Q4(),velP=F(),velR=F(),nP=F(),nQ=Q4(),nP2=F(),nQ2=Q4(),nVP=F(),nVR=F();
 const feat=new Float32Array(rig.D),featPrev=new Float32Array(rig.D),featVel=new Float32Array(rig.D),inert=new ML.Inertializer(rig.factors,rig.core,Array.from(rig.parents,p=>p<0)),rv=[0,0,0];
 let action=null,current=null,info=null,playing=true,onFinish=()=>{},smart=true,settle=.14,speed=1,loop=false;
 let hipY=null,lift=0,clipEnd=null,activeT=null,policy='pinned',hipsEntryZ=0,netZ=0,swayZ=0,lastHipZ=0,legacy=null,hasPose=false,lastTransition=null;
 const travel=new T.Vector3(),q=new T.Quaternion(),q2=new T.Quaternion();

 // v0.14: the clip pose is sampled straight from the clip data. The three.js mixer only keeps time, loops and
 // 'finished' events: it skips writing a bone whose value has not changed since its last write, so reading the pose
 // back from the bones picked up last frame's blended pose and fed it back in (the torso twist / stretch bug).
 function readRaw(){if(info&&action)info.sample(action.time,rawP,rawQ);else for(let i=0;i<n;i++){bones[i].position.toArray(rawP,i*3);bones[i].quaternion.toArray(rawQ,i*4);}}
 const smooth=x=>x<=0?0:x>=1?1:x*x*(3-2*x);
 // Root policies. pinned: hips stay over the anchor (loops). travel: forward root motion moves the
 // fighter in the arena. anchored: root motion is shown as visual sway only and eases back to the
 // anchor during the move's recovery, so repeated or interrupted moves never drift.
 function rootPolicy(P,t,isRaw){const k=H*3,z=P[k+2];P[k]=0;
  if(policy==='travel'){if(isRaw){travel.z=z-lastHipZ;lastHipZ=z;}P[k+2]=0;}
  else if(policy==='anchored'){const a=activeT??(info?info.activeAt:0),e=clipEnd??info.duration,w=loop?0:smooth((t-a)/Math.max(.001,e-a));P[k+2]=z-hipsEntryZ-netZ*w;if(isRaw)swayZ=P[k+2];}
  else P[k+2]=0;
  if(hipY)P[k+1]=hipY.base+(P[k+1]-hipY.base)*hipY.scale;} // scale a clip's jump height to match the others
 function writeOut(){outP.set(rawP);outQ.set(rawQ);
  if(smart)inert.apply(outP,outQ);
  else if(legacy){const a=smooth(Math.min(1,legacy.time/legacy.duration));for(let i=0;i<n;i++){q.fromArray(legacy.Q,i*4);q2.fromArray(rawQ,i*4);q.slerp(q2,a).toArray(outQ,i*4);for(let d=0;d<3;d++)outP[i*3+d]=legacy.P[i*3+d]+(rawP[i*3+d]-legacy.P[i*3+d])*a;}if(a>=1)legacy=null;}
  for(let i=0;i<n;i++){bones[i].position.fromArray(outP,i*3);bones[i].quaternion.fromArray(outQ,i*4);}
  bones[H].position.y+=lift;} // jump lift is layered on top, outside the blend history
 // Velocity of what is on screen, so a transition keeps momentum.
 function track(dt){if(dt>0&&hasPose){for(let i=0;i<n;i++){q2.fromArray(prevQ,i*4).invert();q.fromArray(outQ,i*4).multiply(q2);ML.quatToVec(q.x,q.y,q.z,q.w,rv,0);for(let d=0;d<3;d++){const k=i*3+d;velR[k]=Math.max(-25,Math.min(25,rv[d]/dt));velP[k]=Math.max(-8,Math.min(8,(outP[k]-prevP[k])/dt));}}}
  else{velR.fill(0);velP.fill(0);}
  prevP.set(outP);prevQ.set(outQ);featPrev.set(feat);rig.features(outP,outQ,feat);
  for(let d=0;d<rig.D;d++)featVel[d]=dt>0&&hasPose?(feat[d]-featPrev[d])/dt:0;hasPose=true;}
 function sync(){root.position.set(0,0,0);root.updateMatrixWorld(true);skeleton.update();}
 function rest(){data.bones.forEach((b,i)=>{bones[i].position.fromArray(b.position);bones[i].quaternion.fromArray(b.quaternion);bones[i].scale.fromArray(b.scale);});}
 function snapshotZero(){inert.reset();legacy=null;velR.fill(0);velP.fill(0);hasPose=false;}
 function entryWindow(info,mode){const a=info.leadIn,b=Math.max(a,info.activeAt);
  if(mode==='cycle')return [0,info.duration,0];
  if(mode==='windup')return [a,a+(b-a)*.5,.6];   // never skip more than half the windup
  if(mode==='lead')return [a,a,0];
  return [0,0,0];}

 const api={label,data,root,mesh,bones,skeleton,clips,mixer,ready,rig,
  get current(){return current;},get playing(){return playing;},get time(){return action?action.time:0;},get duration(){return current?current.duration:0;},
  get clipEnd(){return clipEnd;},get blending(){return inert.active||!!legacy;},get rootDelta(){return travel;},get sway(){return swayZ;},get clipInfo(){return info;},get policy(){return policy;},
  get lastTransition(){return lastTransition;},get inertia(){return inert;},get smart(){return smart;},
  analyze:name=>rig.clip(name),
  // How closely the current on-screen pose matches the best frame of another clip (lower = closer).
  matchCost(name){const c=rig.clip(name);if(!c)return Infinity;return rig.findEntry(c,feat,featVel,1,0,c.duration,0).cost;},
  // Cost of starting clip `name` right now with the given entry rule (used to pick good link frames).
  entryCost(name,mode,win){const c=rig.clip(name);if(!c||!hasPose)return 0;const [a,b,bias]=win?[win[0],win[1],.2]:entryWindow(c,mode);return rig.findEntry(c,feat,featVel,speed,a,Math.max(a,b),bias).cost;},
  resetPosition(){snapshotZero();if(current){mixer.update(0);readRaw();rootPolicy(rawP,action.time,false);writeOut();track(0);}sync();},
  setBlend(seconds){settle=Math.max(0,Math.min(.4,seconds));},
  setSmart(v){smart=!!v;snapshotZero();},
  setInPlace(){},
  // Extra hip height (m) for jump air time; set every frame by the game.
  setLift(v){lift=v;},get lift(){return lift;},
  /* play(name, {loop, speed, root:'pinned'|'anchored'|'travel', entry:'cycle'|'windup'|'lead'|'start', start, end, instant})
     Legacy signature play(name, loop, instant) still works. */
  play(name,opts={},instantArg=false){if(typeof opts==='boolean')opts={loop:opts,instant:instantArg};
   const clip=clips.find(c=>c.name===name);if(!clip)throw Error('Missing clip '+label+': '+name);
   const c=rig.clip(name),had=!!current&&hasPose,from=current?current.name:null;
   // Capture the displayed pose, including foot IK applied after the previous rig update.
   // Otherwise a kick switch blends from the pre-IK legs and visibly pops back.
   if(had){for(let i=0;i<n;i++){bones[i].position.toArray(outP,i*3);bones[i].quaternion.toArray(outQ,i*4);}outP[H*3+1]-=lift;rig.features(outP,outQ,feat);}
   loop=!!opts.loop;speed=opts.speed??speed;
   info=c;policy=(smart||opts.start!=null)?(opts.root||(loop?'pinned':'anchored')):(loop?'pinned':'travel');
   // Explicit start/end trims apply even when Smart transitions is disabled.
   let entry=opts.start??0,cost=null;
   clipEnd=opts.end??null;activeT=opts.active??null;hipY=opts.hipY??null;
   if(opts.start==null&&smart&&(opts.window||opts.entry&&opts.entry!=='start')){const [a,b,bias]=opts.window?[opts.window[0],opts.window[1],.2]:entryWindow(c,opts.entry);
    if(had&&b>a){const r=rig.findEntry(c,feat,featVel,speed,a,b,bias);entry=r.time;cost=r.cost;}else entry=a;}
   if(!smart){legacy=had&&!opts.instant&&settle>0?{P:outP.slice(),Q:outQ.slice(),time:0,duration:settle}:null;}
   mixer.stopAllAction();rest();root.position.set(0,0,0);current=clip;action=mixer.clipAction(clip);action.reset();
   action.setLoop(loop?T.LoopRepeat:T.LoopOnce,loop?Infinity:1);action.clampWhenFinished=true;action.play();action.time=entry;playing=true;
   mixer.update(0);readRaw();
   hipsEntryZ=rawP[H*3+2];lastHipZ=hipsEntryZ;netZ=policy==='anchored'&&!loop?c.hipsZ(clipEnd??c.duration)-hipsEntryZ:0;swayZ=0;travel.set(0,0,0);
   rootPolicy(rawP,entry,true);travel.set(0,0,0);
   if(smart&&had&&!opts.instant&&settle>0){
    // Destination velocity, sampled from the clip just ahead of the entry frame, in real time.
    const h=1/60,back=entry+h>c.duration;c.sample(entry,nP,nQ);c.sample(back?entry-h:entry+h,nP2,nQ2);
    rootPolicy(nP,entry,false);rootPolicy(nP2,back?entry-h:entry+h,false);
    const s=(back?-1:1)*speed/h;
    for(let i=0;i<n;i++){q2.fromArray(nQ,i*4).invert();q.fromArray(nQ2,i*4).multiply(q2);ML.quatToVec(q.x,q.y,q.z,q.w,rv,0);for(let d=0;d<3;d++){const k=i*3+d;nVR[k]=rv[d]*s;nVP[k]=(nP2[k]-nP[k])*s;}}
    inert.start(outP,outQ,velP,velR,rawP,rawQ,nVP,nVR);
   }else if(smart)inert.reset();
   writeOut();if(!had){track(0);}sync();
   lastTransition={from,to:name,entry,cost,skipped:entry,leadIn:c.leadIn,activeAt:c.activeAt,loop,policy};},
  bind(){mixer.stopAllAction();action=null;current=null;info=null;playing=false;snapshotZero();rest();root.position.set(0,0,0);sync();},
  seek(t){if(!action)return;snapshotZero();action.paused=false;action.enabled=true;action.time=T.MathUtils.clamp(t,0,Math.max(0,current.duration-1e-6));mixer.update(0);readRaw();rootPolicy(rawP,action.time,false);writeOut();track(0);playing=false;sync();},
  setPlaying(value){playing=value;if(action&&value){if(action.time>=current.duration-1e-5){action.reset();action.play();}action.paused=false;}},
  setLoop(value){loop=!!value;if(action){action.setLoop(value?T.LoopRepeat:T.LoopOnce,value?Infinity:1);action.clampWhenFinished=true;if(playing)action.paused=false;}},
  update(dt,spd=1){speed=spd;travel.set(0,0,0);
   if(playing&&action){mixer.update(dt*spd);let ended=false;if(clipEnd!=null&&action.time>=clipEnd){action.time=clipEnd;mixer.update(0);ended=true;}
    readRaw();rootPolicy(rawP,action.time,true);
    if(smart)inert.update(dt,settle*.5);else if(legacy)legacy.time+=dt;
    writeOut();track(dt);if(ended){playing=false;onFinish();}}
   sync();},
  onFinished(fn){onFinish=fn;}
 };
 mixer.addEventListener('finished',()=>{playing=false;onFinish();});return api;
};
})();
