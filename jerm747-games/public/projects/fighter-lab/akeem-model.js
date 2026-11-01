/* Akeem: geometry fitted to the lab's existing articulated segment rig.
 * Local +Z is the front. Every detail is parented to its moving body segment.
 * No raster stand-in: vest, trim, curls, wraps and sash are actual geometry.
 */
window.AkeemModel={attach({THREE,part,joint,seg,box,ico,head,chest,spine,pelvis,armL,armR,legL,legR,B}){
 const V=THREE.Vector3;
 const round=(r)=>new THREE.SphereGeometry(r,12,8);
 // Keep the neck pivot, enlarge the entire face coherently rather than only its skull.
 head.scale.set(1.17,1.13,1.13);
 const skull=head.children.find(o=>o.name.endsWith('_skull'));
 skull.geometry=new THREE.SphereGeometry(B.skull,20,14);
 skull.scale.set(.92,1.15,.98);
 const jaw=head.children.find(o=>o.name.endsWith('_jaw'));
 jaw.geometry=new THREE.SphereGeometry(.073,16,10);jaw.position.set(0,.044,.016);jaw.scale.set(.90,.91,1.1);
 for(const side of [-1,1]){
  part(head,round(.026),'skin','chin_'+side,[side*.019,.014,.061],null,[1,.65,1.05]);
  part(head,round(.023),'skin','ear_form_'+side,[side*.101,.098,0],null,[.47,1,.65]);
  part(head,round(.013),'skinDark','ear_concha_'+side,[side*.108,.099,.011],null,[.35,1,.45]);
 }
 const nose=head.children.find(o=>o.name.endsWith('_nose'));
 nose.geometry=new THREE.SphereGeometry(.018,12,8);nose.rotation.set(0,0,0);nose.scale.set(.85,1.25,.9);nose.position.set(0,.078,.107);
 part(head,round(.013),'skin','nose_tip',[0,.071,.119],null,[1,.7,.8]);
 // Deterministic woven cotton: a generated material, no external texture dependency.
 const swatch=document.createElement('canvas');swatch.width=swatch.height=128;
 const ctx=swatch.getContext('2d');ctx.fillStyle='#e8dec7';ctx.fillRect(0,0,128,128);
 for(let i=0;i<128;i+=2){ctx.fillStyle=i%4?'#d5c9af':'#f6eedb';ctx.fillRect(i,0,1,128);ctx.fillStyle='#bfb299';ctx.globalAlpha=.32;ctx.fillRect(0,i,128,1);ctx.globalAlpha=1;}
 const weave=new THREE.CanvasTexture(swatch);weave.wrapS=weave.wrapT=THREE.RepeatWrapping;weave.repeat.set(3,2);
 const wrapMaterial=armL.wr.children.find(o=>o.isMesh).material;
 wrapMaterial.map=weave;wrapMaterial.bumpMap=weave;wrapMaterial.bumpScale=.0007;wrapMaterial.shininess=1;wrapMaterial.needsUpdate=true;
 const cloths=[];
 function registerFabric(mesh,weight){cloths.push({mesh,base:mesh.geometry.attributes.position.array.slice(),weight,angle:0,velocity:0,last:mesh.parent.rotation.x});}

 function panel(parent,points,depth,material,name,z){
  const shape=new THREE.Shape();points.forEach(([x,y],i)=>i?shape.lineTo(x,y):shape.moveTo(x,y));shape.closePath();
  return part(parent,new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:false,curveSegments:1}),material,name,[0,0,z]);
 }
 function piping(parent,points,radius,material,name){return part(parent,new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p=>new V(...p))),Math.max(6,points.length*3),radius,5,false),material,name);}
 // Sleeveless open-front jacket. A cylindrical shell wraps around the back and
 // sides; separate lapels leave the sternum and abdominal forms exposed.
 part(chest,new THREE.CylinderGeometry(.247,.173,.30,12,1,true,.78,Math.PI*2-1.56),'kit','vest_shell',[0,.13,-.009],null,[1,1,.73]);
 for(const side of [-1,1]){
  const tag=side>0?'L':'R';
  panel(chest,[[side*.082,.285],[side*.17,.274],[side*.201,.188],[side*.178,-.028],[side*.115,-.012],[side*.134,.12]],.013,'kit','vest_front_'+tag,.133);
  piping(chest,[[side*.080,.287,.14],[side*.104,.23,.158],[side*.127,.12,.157],[side*.113,-.013,.15]],.008,'cream','vest_lapel_'+tag);
  piping(chest,[[side*.173,.278,.095],[side*.222,.235,.037],[side*.229,.15,-.011]],.006,'cream','armhole_trim_'+tag);
  part(chest,box(.09,.018,.195),'kit','vest_shoulder_'+tag,[side*.164,.276,-.006]);
  piping(chest,[[side*.129,.289,.08],[side*.13,.289,-.075]],.006,'cream','shoulder_piping_'+tag);
 }
 // Belt wraps, red sash knot, and asymmetric articulated tails.
 for(let i=0;i<3;i++)part(pelvis,seg(.178,.178,.012,12,-1,1,.75),'tape','belt_wrap_'+i,[0,.089-i*.013,0]);
 part(pelvis,seg(.18,.18,.019,12,-1,1,.76),'sash','red_sash_belt',[0,.045,.001]);
 part(pelvis,ico(.032),'sash','sash_knot',[-.15,.05,.127],null,[1.1,.8,.55]);
 panel(pelvis,[[-.16,.06],[-.22,.10],[-.245,.063],[-.18,.035]],.013,'sash','sash_loop_R',.128);
 panel(pelvis,[[-.145,.06],[-.105,.105],[-.09,.067],[-.14,.032]],.013,'sash','sash_loop_L',.128);
 const tail=joint('sash_tail_long',pelvis,-.168,.037,.139);
 panel(tail,[[0,0],[-.038,-.025],[-.07,-.21],[-.023,-.185],[.004,-.09]],.008,'sash','sash_long',0);
 piping(tail,[[-.018,-.025,.01],[-.032,-.095,.01],[-.048,-.17,.01]],.0025,'sashLight','sash_highlight');
 const shortTail=joint('sash_tail_short',pelvis,-.17,.036,.134);
 panel(shortTail,[[0,0],[-.04,.005],[-.115,-.10],[-.07,-.096]],.008,'sash','sash_short',0);
 // Curled cream motifs on each shorts leg, with a clean cream hem.
 for(const [tag,leg,side] of [['L',legL,1],['R',legR,-1]]){
  part(leg.hip,seg(B.shortsLeg[1]+.004,B.shortsLeg[1]+.004,.017,10,-1),'cream',tag+'_shorts_hem',[0,-.203,0]);
  const points=[[-.071,-.17,.105],[-.035,-.178,.13],[.011,-.16,.136],[.049,-.175,.125],[.065,-.15,.108],[.034,-.122,.134],[.005,-.139,.14],[.026,-.15,.142]];
  piping(leg.hip,points.map(([x,y,z])=>[x*side,y,z]),.006,'cream',tag+'_shorts_wave');
  piping(leg.hip,[[-.083*side,-.01,.09],[-.096*side,-.08,.079],[-.085*side,-.18,.085]],.005,'cream',tag+'_shorts_side_trim');
  for(let i=0;i<12;i++){
   const y=.151-i*.013, r=.049+Math.max(0,y)*.07;
   part(leg.ankle,seg(r,r-.001,.014,16,-1),'tape',tag+'_ankle_wrap_line_'+i,[0,y,0]);
   piping(leg.ankle,Array.from({length:25},(_,j)=>{const a=j/24*Math.PI*2;return [Math.cos(a)*(r+.001),y-.011+Math.sin(a)*.002,Math.sin(a)*(r+.001)];}),.001,'tapeShade',tag+'_ankle_seam_'+i);
  }
 }
 // Red upper-arm tie and seam lines across the ivory hand wraps.
 part(armL.sh,seg(.074,.073,.029,10,-1),'sash','upperarm_red_tie',[0,-.108,0]);
 const tie=joint('arm_tie',armL.sh,.057,-.12,0);
 panel(tie,[[0,0],[.075,-.008],[.12,-.045],[.054,-.026]],.007,'sash','arm_tie_tail',0);
 const hands=[];
 for(const [tag,arm,side] of [['L',armL,1],['R',armR,-1]]){
  // A tapered palm with a separate thumb mound. Fingers remain individually jointed.
  part(arm.wr,round(.046),'tape',tag+'_palm',[0,-.040,0],null,[1,1.14,.58]);
  part(arm.wr,round(.022),'skin',tag+'_thenar',[-side*.031,-.051,.012],null,[.8,1.25,.85]);
  for(let i=0;i<9;i++){
   part(arm.wr,seg(.046-i*.00035,.046-i*.00035,.008,16,-1,1,.87),'tape',tag+'_wrist_layer_'+i,[0,.048-i*.011,0],[0,0,(i%2?1:-1)*.045]);
   piping(arm.wr,Array.from({length:25},(_,j)=>{const a=j/24*Math.PI*2;return [Math.cos(a)*(.046-i*.00035),.048-i*.011+Math.sin(a)*.003,Math.sin(a)*(.046-i*.00035)*.87];}),.0012,'tapeShade',tag+'_wrap_edge_'+i);
  }
  for(let i=0;i<3;i++)piping(arm.wr,[[-.035,-.021-i*.011,.026],[0,-.039-i*.011,.030],[.034,-.031-i*.011,.025]],.004,'tape',tag+'_diagonal_palm_wrap_'+i);
  const digits=[];
  for(let f=0;f<4;f++){
   const x=side*(f-1.5)*.021, lengths=[.030,.034,.031,.024];
   const root=joint(tag+'_finger_'+f,arm.wr,x,-.079+(f===3?.008:0),0);
   const middle=joint(tag+'_finger_'+f+'_middle',root,0,-lengths[f],0);
   const tip=joint(tag+'_finger_'+f+'_tip',middle,0,-lengths[f]*.72,0);
   [root,middle,tip].forEach((j,k)=>{
    const len=lengths[f]*[1,.72,.58][k],r=(f===3?.008:.0095)*(1-k*.12);
    part(j,round(r),'skin',tag+'_knuckle_'+f+'_'+k,[0,0,0],null,[1,1,.95]);
    part(j,seg(r*.84,r,len,10,-1),'skin',tag+'_digit_'+f+'_'+k);
    part(j,round(r*.86),'skin',tag+'_pad_'+f+'_'+k,[0,-len*.72,0],null,[1,1.3,1]);
    if(k===0)part(j,seg(r+.001,r+.001,.012,12,-1),'tape',tag+'_knuckle_tape_'+f,[0,-.004,0]);
    if(k===2)part(j,round(r*.62),'cream',tag+'_nail_'+f,[0,-len*.67,-r*.78],null,[.8,1.15,.19]);
   });
   digits.push([root,middle,tip]);
  }
  const thumb=joint(tag+'_thumb_base',arm.wr,-side*.039,-.034,.005);thumb.rotation.z=-side*.65;
  const thumbTip=joint(tag+'_thumb_tip',thumb,0,-.027,0);
  for(const [j,k] of [[thumb,0],[thumbTip,1]]){part(j,seg(.010,.013,.027,12,-1),'skin',tag+'_thumb_segment_'+k);part(j,round(.011),'skin',tag+'_thumb_pad_'+k,[0,-.023,0],null,[1,1.15,1]);}
  hands.push({digits,thumb,thumbTip,side});
 }
 // Rounded forefoot and heel, five graduated toes on the inner edge of each foot.
 for(const [tag,leg,side] of [['L',legL,1],['R',legR,-1]]){
  part(leg.ankle,round(.046),'skin',tag+'_heel',[0,-.042,-.035],null,[.9,.68,1.1]);
  part(leg.ankle,round(.051),'skin',tag+'_instep',[0,-.036,.047],null,[.86,.65,1.65]);
  part(leg.ankle,round(.052),'skin',tag+'_forefoot',[0,-.047,.119],null,[1,.49,.92]);
  for(let i=0;i<5;i++){
   const x=side*(-.034+i*.018),r=[.014,.0105,.0095,.0085,.0075][i],len=[.049,.045,.038,.032,.026][i];
   const toe=joint(tag+'_toe_joint_'+i,leg.ankle,x,-.049,.143-i*.002);
   part(toe,round(r),'skin',tag+'_toe_knuckle_'+i,[0,0,.005],null,[1,.8,1]);
   part(toe,round(r),'skin',tag+'_toe_form_'+i,[0,0,len*.46],null,[.92,.78,len/(r*1.8)]);
   part(toe,round(r*.64),'cream',tag+'_toenail_'+i,[0,r*.67,len*.70],null,[.83,.16,1.05]);
  }
  // Winding ribbons around the instep leave the heel and toe tips exposed.
  for(let i=0;i<6;i++){
   const ring=new THREE.TorusGeometry(.044+i*.001,.0075,5,28);
   part(leg.ankle,ring,'tape',tag+'_instep_wrap_'+i,[0,-.035,.004+i*.019],[.16,0,.12*side],[1,.70,1]);
   part(leg.ankle,new THREE.TorusGeometry(.044+i*.001,.001,4,28),'tapeShade',tag+'_instep_wrap_edge_'+i,[0,-.035,.012+i*.019],[.16,0,.12*side],[1,.70,1]);
  }
 }
 // Sculpted face: pale eye beds, dark irises, angled brows, mouth, lower lip.
 for(const side of [-1,1]){
  const tag=side>0?'L':'R';
  part(head,new THREE.SphereGeometry(.017,12,8),'eyeWhite','eye_white_'+tag,[side*.034,.105,.106],null,[1,.36,.22]);
  part(head,new THREE.SphereGeometry(.006,10,8),'eye','iris_'+tag,[side*.030,.105,.111],null,[1,.85,.4]);
  part(head,box(.039,.010,.013),'hair','brow_'+tag,[side*.034,.126,.102],[0,0,side*.22]);
  part(head,ico(.015),'skinDark','cheek_plane_'+tag,[side*.054,.075,.078],null,[1.4,.65,.4]);
 }
 part(head,box(.039,.005,.006),'lip','mouth',[0,.044,.104]);
 part(head,box(.030,.006,.008),'skinDark','lower_lip',[0,.037,.105]);
 // Close tapered sides and a dense, irregular crown of small coiled curls.
 const fadeGeo=new THREE.SphereGeometry(B.skull+.003,20,12,0,Math.PI*2,0,Math.PI*.50);
 const fadePos=fadeGeo.attributes.position;
 for(let i=0;i<fadePos.count;i++)fadePos.setY(i,fadePos.getY(i)+.039*Math.pow(Math.max(0,fadePos.getZ(i)/(B.skull+.003)),2)*Math.pow(1-fadePos.getY(i)/(B.skull+.003),3));
 fadeGeo.computeVertexNormals();
 part(head,fadeGeo,'hairFade','short_fade',[0,.121,-.006],null,[.94,1.04,1]);
 let curl=0;
 for(const [radius,y,count,size] of [[.088,.174,22,.017],[.079,.197,21,.020],[.059,.219,17,.021],[.032,.232,10,.020],[0,.236,1,.022]]){
  for(let i=0;i<count;i++){
   const a=i/count*Math.PI*2+y*11, x=Math.cos(a)*radius,z=Math.sin(a)*radius-.006;
   part(head,new THREE.SphereGeometry(size,8,6),'hair','curl_'+curl,[x,y+Math.sin(i*2.6)*.004,z],[i*.41,i*.83,i*.29],[1,.86,1]);
   part(head,new THREE.TorusGeometry(size*.58,.0032,4,9,Math.PI*1.65),'hairFade','coil_'+curl++,[x,y+size*.61,z+.005],[Math.PI/2+.3,i*.7,0]);
  }
 }
 // Deform each garment and its trim together, pinned at its upper edge.
 for(const parent of [chest,legL.hip,legR.hip]){
  parent.children.filter(o=>o.isMesh&& /vest_|lapel|armhole_trim|shoulder_piping|shorts_leg|shorts_hem|shorts_wave|shorts_side_trim|shorts_stripe/.test(o.name)).forEach(mesh=>{
   const hip=parent!==chest;
   if(hip)mesh.scale.set(1.09,1,1.09);
   registerFabric(mesh,(y)=>Math.pow(THREE.MathUtils.clamp(hip?(-y)/.21:(.22-y)/.25,0,1),1.6));
  });
 }
 let gesture='fist',fabric=true,lastTime=null;
 const springs=[{j:tail,a:0,v:0},{j:shortTail,a:0,v:0},{j:tie,a:0,v:0}];
 return {setGesture(g){gesture=g;},setCloth(on){fabric=on;},update(t,{action=false}={}){
  const dt=lastTime===null?0:Math.min(.05,Math.max(0,t-lastTime));lastTime=t;
  const g=action?'fist':gesture;
  for(const h of hands){
   h.digits.forEach((d,i)=>{
    const c=g==='fist'?1:g==='open'?0:g==='point'?(i===0?0:1):(i===0?.32+.30*(1+Math.sin(t*5)): .78);
    d.forEach((j,k)=>{const target=c*[1.05,1.35,.90][k];j.rotation.x+=(target-j.rotation.x)*(1-Math.exp(-dt*18));});
    d[0].rotation.z=(g==='open'?(i-1.5)*.09:0)*h.side;
   });
   h.thumb.rotation.x+=( (g==='fist'?.72:.12)-h.thumb.rotation.x)*(1-Math.exp(-dt*18));h.thumbTip.rotation.x=g==='fist'?.65:.22;
  }
  if(dt===0)return;
  for(const c of cloths){
   const angle=c.mesh.parent.rotation.x, speed=THREE.MathUtils.clamp((angle-c.last)/dt,-8,8);c.last=angle;
   const force=fabric?-.07*speed+Math.sin(t*2.6)*.12:0;
   c.velocity+=(force-c.angle*28-c.velocity*8)*dt;c.angle=THREE.MathUtils.clamp(c.angle+c.velocity*dt,-.025,.025);
   const p=c.mesh.geometry.attributes.position;
   for(let i=0;i<p.count;i++){
    const x=c.base[i*3],y=c.base[i*3+1],z=c.base[i*3+2],w=c.weight(y+c.mesh.position.y);
    const shift=fabric?c.angle*w:0;
    p.setXYZ(i,x+shift*.3,y,z+shift*(.65+.35*Math.cos(x*18)));
   }
   p.needsUpdate=true;c.mesh.geometry.computeVertexNormals();
   // Faces overlay follows the same moving vertices.
   const edge=c.mesh.children.find(o=>o.isLineSegments);
   if(edge&&edge.visible){edge.geometry.dispose();edge.geometry=new THREE.EdgesGeometry(c.mesh.geometry,1);}
  }
  for(const [i,s] of springs.entries()){
   const target=fabric?Math.sin(t*(2.2+i*.3)-i)*.10-pelvis.rotation.y*.17:0;
   s.v+=((target-s.a)*38-s.v*7)*dt;s.a+=s.v*dt;
   s.j.rotation.x=s.a;s.j.rotation.z=(i===1?-.15:.04)+s.a*.7;
  }
 }};
}};
