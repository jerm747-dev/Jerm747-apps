/* Akeem: geometry fitted to the lab's existing articulated segment rig.
 * Local +Z is the front. Every detail is parented to its moving body segment.
 * No raster stand-in: vest, trim, curls, wraps and sash are actual geometry.
 */
window.AkeemModel={attach({THREE,part,joint,seg,box,ico,head,chest,spine,pelvis,armL,armR,legL,legR,B}){
 const V=THREE.Vector3;
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
  for(let i=0;i<5;i++)part(leg.ankle,seg(.045-i*.001,.046-i*.001,.008,10,-1),'tape',tag+'_ankle_wrap_line_'+i,[0,.068-i*.017,0]);
 }
 // Red upper-arm tie and seam lines across the ivory hand wraps.
 part(armL.sh,seg(.074,.073,.029,10,-1),'sash','upperarm_red_tie',[0,-.108,0]);
 const tie=joint('arm_tie',armL.sh,.057,-.12,0);
 panel(tie,[[0,0],[.075,-.008],[.12,-.045],[.054,-.026]],.007,'sash','arm_tie_tail',0);
 for(const [tag,arm] of [['L',armL],['R',armR]]){
  for(let i=0;i<5;i++)part(arm.wr,seg(.043,.043,.006,10,-1),'tapeShade',tag+'_wrap_seam_'+i,[0,.045-i*.015,0]);
  part(arm.wr,box(.077,.014,.099),'tapeShade',tag+'_palm_wrap',[0,-.058,0]);
 }
 // Sculpted face: pale eye beds, dark irises, angled brows, mouth, lower lip.
 for(const side of [-1,1]){
  const tag=side>0?'L':'R';
  part(head,box(.031,.011,.005),'eyeWhite','eye_white_'+tag,[side*.034,.105,.106]);
  part(head,box(.012,.010,.006),'eye','iris_'+tag,[side*.030,.105,.111]);
  part(head,box(.039,.010,.013),'hair','brow_'+tag,[side*.034,.126,.102],[0,0,side*.22]);
  part(head,ico(.015),'skinDark','cheek_plane_'+tag,[side*.054,.075,.078],null,[1.4,.65,.4]);
 }
 part(head,box(.039,.005,.006),'lip','mouth',[0,.044,.104]);
 part(head,box(.030,.006,.008),'skinDark','lower_lip',[0,.037,.105]);
 // A close fade under a compact crown of distinct faceted curls.
 part(head,new THREE.SphereGeometry(B.skull+.002,10,5,0,Math.PI*2,0,Math.PI*.40),'hairFade','short_fade',[0,.113,-.009],null,[.9,1.02,.99]);
 let curl=0;
 for(const [radius,y,count,size] of [[.073,.187,12,.023],[.052,.217,10,.024],[.025,.232,6,.022]]){
  for(let i=0;i<count;i++){
   const a=i/count*Math.PI*2+(count%3)*.23;
   const piece=part(head,ico(size),'hair','curl_'+curl++,[Math.cos(a)*radius,y+Math.sin(i*2.6)*.004,Math.sin(a)*radius-.01],[i*.41,i*.83,i*.29],[1,.84,1]);
  }
 }
 part(head,ico(.023),'hair','crown_curl',[0,.234,-.007]);
 return {update(t){tail.rotation.z=.04+Math.sin(t*2.4)*.06;tail.rotation.x=Math.sin(t*2)*.09;shortTail.rotation.z=-.15+Math.sin(t*2.7+.8)*.10;tie.rotation.y=Math.sin(t*3)*.1;}};
}};
