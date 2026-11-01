/* Texture Lab v0.27. A GPU size limit is a capability, not a memory guarantee. */
(function(){
 const presets={balanced:{label:'2K',size:2048,ratio:1.5,shadow:2048},ultra:{label:'4K Ultra',size:4096,ratio:2,shadow:4096},extreme:{label:'8K Extreme',size:8192,ratio:3,shadow:4096}};
 const query=new URLSearchParams(location.search);let saved='';try{saved=localStorage.getItem('gsf-quality-v27')||'';}catch{}
 let requested=query.get('quality')||saved||'extreme';if(!presets[requested])requested='extreme';
 const api=window.GSFQuality={presets,requested,key:requested,profile:presets[requested],maxTextureSize:2048,anisotropy:1,error:null,notice:'',fps:0,ready:null};
 function script(src){return new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=src;s.onload=()=>{s.remove();resolve();};s.onerror=()=>{s.remove();reject(new Error('Could not load '+src));};document.head.append(s);});}
 api.init=renderer=>{
  api.maxTextureSize=renderer.capabilities?.maxTextureSize||2048;
  api.anisotropy=renderer.capabilities?.getMaxAnisotropy?.()||1;
  const previous=api.key;
  while(api.profile.size>api.maxTextureSize&&api.key!=='balanced'){api.key=api.key==='extreme'?'ultra':'balanced';api.profile=presets[api.key];}
  if(previous!==api.key)api.notice='Device texture limit: using '+api.profile.label+'.';
  const select=document.getElementById('graphics-quality');select.value=api.key;
  for(const o of select.options)o.disabled=presets[o.value].size>api.maxTextureSize;
  api.pixelRatio=Math.min(devicePixelRatio||1,api.profile.ratio);
  renderer.setPixelRatio?.(api.pixelRatio);
  if(renderer.shadowMap)renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  api.ready=script('stage/textures/level-'+api.profile.size+'.js').then(()=>{
   const assets=window.GSF_HD_ASSETS;delete window.GSF_HD_ASSETS;
   return Promise.all([script('stage/textures/surface-data.js'),script('stage/textures/inner-level-'+api.profile.size+'.js'),script('stage/textures/inner-surface-data.js'),script('stage/textures/scenic-join-data.js')]).then(()=>{assets.surface=window.GSF_STONE_SURFACE;assets.innerStone=window.GSF_INNER_STONE;assets.innerSurface=window.GSF_INNER_SURFACE;assets.scenicJoin=window.GSF_SCENIC_JOIN;delete window.GSF_STONE_SURFACE;delete window.GSF_INNER_STONE;delete window.GSF_INNER_SURFACE;delete window.GSF_SCENIC_JOIN;return assets;});
  }).catch(e=>{api.error=e.message;throw e;});
  api.ready.catch(()=>{});
  select.onchange=()=>{
   try{localStorage.setItem('gsf-quality-v27',select.value);}catch{}
   const u=new URL(location.href);u.searchParams.set('quality',select.value);u.searchParams.set('skipintro','1');location.href=u.href;
  };
  renderer.domElement?.addEventListener('webglcontextlost',e=>{e.preventDefault();api.error='Graphics memory was exhausted. Try 4K or 2K.';api.report();});
  renderer.domElement?.addEventListener('webglcontextrestored',()=>{api.error=null;api.report();});
  api.renderer=renderer;
 };
 api.report=()=>{
  const lab=window.FighterLab,s=lab?.surface,p=lab?.scenery,el=document.getElementById('graphics-status');if(!el)return;
  const errors=[api.error,s?.error,p?.error].filter(Boolean);
  if(errors.length){el.textContent=errors.join(' · ');return;}
  if(!s?.ready||!p?.ready){el.textContent='Loading '+api.profile.label+' textures…';return;}
  const d=p.dimensions;
  el.textContent=api.notice+' Inner floor '+s.innerDimensions.width+' × '+s.innerDimensions.height+' · Outer stone '+s.dimensions.width+' × '+s.dimensions.height+' · Backdrop '+d.width+' × '+d.height+' · '+api.anisotropy+'× filtering · '+api.fps+' FPS';
  document.getElementById('graphics-fps').textContent=api.profile.label+' · '+api.fps+' FPS';
 };
 let frames=0,last=performance.now();
 api.tick=now=>{frames++;if(now-last>1000){api.fps=Math.round(frames*1000/(now-last));frames=0;last=now;api.report();}};
 document.addEventListener('visibilitychange',()=>{last=performance.now();frames=0;});
 // Environment lighting approximation, not scene reflections or ray tracing.
 api.makeStoneEnvironment=(T,renderer)=>{
  if(!renderer.isWebGLRenderer)return null;
  const room=new T.Scene(),geometry=new T.SphereGeometry(30,24,12);
  const material=new T.ShaderMaterial({side:T.BackSide,vertexShader:'varying vec3 d;void main(){d=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',fragmentShader:'varying vec3 d;void main(){vec3 n=normalize(d);vec3 c=mix(vec3(.10,.12,.10),vec3(.60,.67,.75),smoothstep(-.15,1.0,n.y));float sun=pow(max(0.0,dot(n,normalize(vec3(-.3,.9,.4)))),80.0);gl_FragColor=vec4(c+vec3(1.7,1.45,1.1)*sun,1.0);}'});
  room.add(new T.Mesh(geometry,material));
  const pmrem=new T.PMREMGenerator(renderer),rt=pmrem.fromScene(room,.04,.1,60);
  pmrem.dispose();geometry.dispose();material.dispose();return rt;
 };
})();
