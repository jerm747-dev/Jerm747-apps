/* v0.34: contact-aware reaction families, deterministic variation and rapid-hit compression.
 * Times are source-clip seconds. Keep the impact and first recoil; blend out before theatrical recovery. */
(function(){'use strict';
 const specs={
  Face_Punch_Reaction:{start:.43,end:1.08,rapidEnd:.86,side:-1},
  Face_Punch_Reaction_1:{start:2.03,end:2.72,rapidEnd:2.49,side:-1},
  Hit_Reaction:{start:.43,end:1.13,rapidEnd:.89,side:-1},
  Hit_Reaction_1:{start:.06,end:.85,rapidEnd:.61,side:-1},
  Hit_Reaction_to_Waist:{start:.14,end:1.17,rapidEnd:.86,side:1},
  Slap_Reaction:{start:.73,end:1.37,rapidEnd:1.12,side:-1},
  BeHit_FlyUp:{start:0,end:1.17,speed:1.7,side:0}
 };
 const families={head:['Face_Punch_Reaction','Face_Punch_Reaction_1'],side:['Slap_Reaction','Face_Punch_Reaction'],body:['Hit_Reaction_1','Hit_Reaction'],waist:['Hit_Reaction_to_Waist','Hit_Reaction'],low:['Hit_Reaction_1','Hit_Reaction_to_Waist']};
 // Mirror across the fighter's sagittal plane, swapping corresponding limbs and keeping their own lengths.
 const swap=s=>s.includes('Left')?s.replace('Left','Right'):s.includes('Right')?s.replace('Right','Left'):s;
 for(const data of [window.NikaMeshData,window.AkeemMeshData]){
  const index=new Map(data.bones.map((b,i)=>[b.name,i]));
  for(const [name,spec] of Object.entries(specs)){
   const source=data.clips.find(c=>c.name===name);if(!source||!spec.side)continue;
   const tracks=source.tracks.flatMap(t=>{const bone=index.get(swap(data.bones[t.bone].name));if(bone==null)return [];
    if(t.path==='rotation')return [{...t,bone,values:t.values.map((v,i)=>i%4===1||i%4===2?-v:v)}];
    if(t.path==='translation'&&data.bones[t.bone].parent<0)return [{...t,bone,values:t.values.map((v,i)=>i%3===0?-v:v)}];
    return [];
   });
   data.clips.push({name:name+'__Mirror',duration:source.duration,tracks,internal:true});
  }
 }
 function profile(attacker,move,damage=5){
  const kick=['lk','mk','hk','jumpkick','sweep'].includes(move),height=['hp','hk','airpunch','jumpkick'].includes(move)?'head':['lk','lp','sweep'].includes(move)?'low':'mid';
  const lateral=(attacker==='Akeem'&&(move==='lp'||move==='hk'))||move==='sweep';
  // Akeem's low-punch slot is a hook to the head; his low-kick slot still uses a high-kick placeholder.
  // Honor the animation where the control label and actual strike differ.
  const actualHeight=attacker==='Akeem'&&['lp','lk'].includes(move)?'head':height;
  return {move,attacker,damage,height:actualHeight,lateral,rising:attacker==='Akeem'&&move==='hp',heavy:kick||damage>=8};
 }
 window.FighterReactionSpecs=specs;
 window.createReactionController=function(T){
  const config={speed:2.5,adaptive:true};let time=0,state=new WeakMap(),previous=new WeakMap(),last=null,epoch=0;
  const a=new T.Vector3(),b=new T.Vector3(),axis=new T.Vector3();
  function capture(rig){rig.root.updateWorldMatrix(true,true);const positions=new Map();for(const bone of rig.bones)if(/LeftHand|RightHand|LeftFoot|RightFoot/.test(bone.name))positions.set(bone.name,bone.getWorldPosition(new T.Vector3()));previous.set(rig,{positions,clip:rig.current?.name});}
  function impact(rig,attacker,move,victim,damage,ko=false,knockdown=false){
   const hit={...profile(attacker,move,damage),ko,knockdown};rig.root.updateWorldMatrix(true,true);victim.root.updateWorldMatrix(true,true);
   const kicking=['lk','mk','hk','jumpkick','sweep'].includes(move),forward=new T.Vector3(0,0,1).transformDirection(rig.root.matrixWorld);let best=null,reach=-Infinity;
   for(const bone of rig.bones)if((kicking?/LeftFoot|RightFoot/:/LeftHand|RightHand/).test(bone.name)){bone.getWorldPosition(a);const r=a.dot(forward);if(r>reach){reach=r;best=bone;}}
   const prev=previous.get(rig),p=best&&prev?.positions.get(best.name);axis.set(1,0,0).transformDirection(victim.root.matrixWorld);
   const delta=p&&prev.clip===rig.current?.name?best.getWorldPosition(a).sub(p).dot(axis):0;
   hit.side=Math.abs(delta)>.002?Math.sign(delta):(best?.name.includes('Left')?1:-1);hit.limb=best?.name;return hit;
  }
  function choose(rig,hit){
   const s=state.get(rig)||{time:-Infinity,counts:{},chain:0,epoch};if(s.epoch!==epoch){s.time=-Infinity;s.chain=0;s.epoch=epoch;}const rapid=config.adaptive&&time-s.time<.46;
   s.chain=rapid?s.chain+1:1;s.time=time;state.set(rig,s);
   const launch=hit.knockdown&&(hit.move==='vwave'||hit.rising);
   if(hit.knockdown&&!launch){last={kind:'fall',profile:hit,rapid:false,clip:null};return null;}
   const family=launch?'launch':hit.height==='head'?(hit.lateral?'side':'head'):hit.height==='low'?'low':hit.heavy?'waist':'body';
   const pool=launch?['BeHit_FlyUp']:families[family];const eligible=pool.filter(n=>rig.clips.some(c=>c.name===n));if(!eligible.length)return null;
   const count=s.counts[family]||0,name=eligible[count%eligible.length];s.counts[family]=count+1;
   const spec=specs[name],mirrored=spec.side&&hit.side&&Math.sign(hit.side)!==spec.side;
   const clip=name+(mirrored?'__Mirror':'');const speed=launch?spec.speed:Math.min(4,Math.max(2,config.speed)+(rapid?.7:0)+(hit.heavy?.1:0));
   const end=rapid&&!launch?spec.rapidEnd:spec.end;
   const plan={kind:launch?'fall':'hit',clip,source:name,family,start:spec.start,end,speed,blend:launch?.055:rapid?.035:.05,root:'anchored',rapid:!!rapid&&!launch,mirrored:!!mirrored,duration:(end-spec.start)/speed,profile:{...hit}};
   last=plan;return plan;
  }
  function apply(rig,p){rig.setLift(0);rig.setBlend(p.blend);rig.play(p.clip,{speed:p.speed,loop:false,root:p.root,start:p.start,end:p.end,active:p.start});}
  return {config,profile,capture,impact,choose,apply,specs,get last(){return last;},get time(){return time;},update(dt){time+=Math.max(0,dt);},reset(keepCycles=false){time=0;epoch++;if(!keepCycles)state=new WeakMap();previous=new WeakMap();last=null;}};
 };
})();
