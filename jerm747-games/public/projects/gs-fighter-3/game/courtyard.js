/* Open, real-geometry courtyard. No camera-following plate or parallax. */
window.createCourtyard=function(T,scene){
 const group=new T.Group();scene.add(group);
 const surface=getArenaStone(T,scene),stone=surface.make({foreground:true});
 // Foreground stone must not wash out into the gray atmospheric fog.
 stone.fog=false;
 function mesh(g,m,x,y,z){const o=new T.Mesh(g,m);o.position.set(x,y,z);o.receiveShadow=true;group.add(o);return o;}
 // Single continuous terrace covers the ring interior and extends in every direction.
 // Two triangles cover the visible ground. World-space material coordinates
 // keep every stone fixed when the coverage plane follows the view center.
 const terrace=mesh(new T.PlaneGeometry(2,2),stone,0,-.025,0);
 terrace.scale.set(200,200,1);
 terrace.rotation.x=-Math.PI/2;terrace.name='Continuous stone terrace';
 // Independent, fixed disk: new giant slabs stop exactly at the ridge's inner
 // radius. The original continuous terrace remains underneath and outside.
 const innerStone=surface.make({foreground:true,inner:true});innerStone.fog=false;
 const innerFloor=mesh(new T.CircleGeometry(11.65,160),innerStone,0,-.024,0);
 innerFloor.rotation.x=-Math.PI/2;innerFloor.name='Giant slab inner circle';
 group.userData.innerFloor=innerFloor;
 // A low, softly undulating ridge defines the arena without a pale separate border.
 const ridgeGeometry=new T.RingGeometry(11.65,12.35,160,12),pos=ridgeGeometry.attributes.position;
 for(let i=0;i<pos.count;i++){
  const x=pos.getX(i),y=pos.getY(i),r=Math.hypot(x,y),a=Math.atan2(y,x);
  const t=(r-11.65)/.7,h=Math.sin(Math.PI*t)*(.07+.012*Math.sin(a*7)+.009*Math.cos(a*11));
  pos.setZ(i,h);
 }
 ridgeGeometry.computeVertexNormals();
 const ridge=mesh(ridgeGeometry,stone,0,-.024,0);ridge.rotation.x=-Math.PI/2;ridge.name='Natural arena ridge';
 const stageKey=new T.SpotLight(0xffce91,.8,45,Math.PI*.37,.85,1);
 stageKey.position.set(-4,8,3);stageKey.target.position.set(0,0,0);scene.add(stageKey,stageKey.target);
 const fill=new T.DirectionalLight(0xc5b8e3,.23);fill.position.set(5,5,-6);scene.add(fill);
 surface.onChange=()=>{stageKey.intensity=surface.settings.light;};surface.apply();
 group.userData.surface=surface;
 // v0.29: remove the oversized 3D trunks/crowns; painted riverside trees remain.
 // Open blue atmosphere complements the extended panorama.
 // This is atmosphere, not a physical ceiling; it stays well beyond the arena.
 const dome=new T.Mesh(new T.SphereGeometry(85,32,20),new T.ShaderMaterial({
  side:T.BackSide,depthWrite:false,
  vertexShader:'varying vec3 skyDirection; void main(){skyDirection=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
  fragmentShader:`varying vec3 skyDirection;
   void main(){
    vec3 d=normalize(skyDirection);
    float up=smoothstep(-.08,.9,d.y);
    vec3 color=mix(vec3(.06,.46,.86),vec3(.025,.24,.72),up);
    float cloud=sin(d.x*13.0+d.z*8.0)*sin(d.z*17.0-d.y*11.0)*.012*up;
    float halo=pow(max(0.0,dot(d,normalize(vec3(-.12,.95,.2)))),12.0)*.13;
    gl_FragColor=vec4(color+cloud+vec3(halo*.98,halo*.96,halo*.88),1.0);
    #include <tonemapping_fragment>
    #include <encodings_fragment>
   }`
 }));
 dome.name='Open blue sky';dome.renderOrder=-100;group.add(dome);
 scene.background=new T.Color(0x1689ef);scene.fog=new T.Fog(new T.Color(.12,.16,.15),42,75);
 group.userData.terrace=terrace;
 group.userData.updateForeground=(camera,centerX,view)=>{
  terrace.position.x=centerX;
  terrace.scale.set(view.groundExtent,view.groundExtent,1);
  // The sky is infinitely distant scenery; keep the camera inside its dome.
  dome.position.copy(camera.position);
  // Preserve the original fog on fighters/walls when only camera depth changes.
  scene.fog.near=42+view.depthOffset;scene.fog.far=75+view.depthOffset;
 };
 return group;
};
