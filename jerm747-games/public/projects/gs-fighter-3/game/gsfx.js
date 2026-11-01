/* GS Fighter III v1.0 — post-processing and impact feel.
 * Bloom (bright pass + separable blur at two scales), color grade, vignette, impact flash, chromatic
 * aberration pulse, film grain, hit-stop and camera shake. Fighters get a fresnel rim light.
 * Levels: off (direct render) · standard (half-res bloom) · high (MSAA target + two-scale bloom). */
window.GSFX=(function(){'use strict';
 const T=window.THREE;let level='high',rim=true,ok=false,failed=false,w=0,h=0;
 try{const v=localStorage.getItem('gsf-postfx');if(['off','standard','high'].includes(v))level=v;else if(/Android|iPhone|iPad|Mobile/i.test(navigator.userAgent))level='standard';const r=localStorage.getItem('gsf-rim');if(r==='0')rim=false;}catch{}
 let rt,bA,bB,cA,cB,quad,qScene,qCam,mBright,mBlur,mComp;let flash=0,flashColor=[1,1,1],aberr=0,shake=0,stop=0,time=0;const rimMats=new Set();
 const vs='varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}';
 function target(W,H,ms){const o={minFilter:T.LinearFilter,magFilter:T.LinearFilter,format:T.RGBAFormat,depthBuffer:!!ms,stencilBuffer:false};
  let t=ms&&T.WebGLMultisampleRenderTarget?new T.WebGLMultisampleRenderTarget(W,H,o):new T.WebGLRenderTarget(W,H,o);if(ms&&t.samples!==undefined)t.samples=4;t.texture.encoding=T.sRGBEncoding;return t;}
 function setup(renderer){
  if(failed)return false;if(ok)return true;
  try{
   qScene=new T.Scene();qCam=new T.OrthographicCamera(-1,1,1,-1,0,1);quad=new T.Mesh(new T.PlaneGeometry(2,2),null);quad.frustumCulled=false;qScene.add(quad);
   mBright=new T.ShaderMaterial({uniforms:{tDiffuse:{value:null},threshold:{value:.78},knee:{value:.18}},vertexShader:vs,depthTest:false,depthWrite:false,
    fragmentShader:'uniform sampler2D tDiffuse;uniform float threshold,knee;varying vec2 vUv;void main(){vec4 c=texture2D(tDiffuse,vUv);float l=max(c.r,max(c.g,c.b));float s=clamp((l-threshold+knee)/(2.*knee),0.,1.);s=s*s*(3.-2.*s);gl_FragColor=vec4(c.rgb*s*c.a,1.);}'});
   mBlur=new T.ShaderMaterial({uniforms:{tDiffuse:{value:null},dir:{value:new T.Vector2()}},vertexShader:vs,depthTest:false,depthWrite:false,
    fragmentShader:'uniform sampler2D tDiffuse;uniform vec2 dir;varying vec2 vUv;void main(){vec3 c=texture2D(tDiffuse,vUv).rgb*.2270270;c+=(texture2D(tDiffuse,vUv+dir*1.3846153).rgb+texture2D(tDiffuse,vUv-dir*1.3846153).rgb)*.3162162;c+=(texture2D(tDiffuse,vUv+dir*3.2307692).rgb+texture2D(tDiffuse,vUv-dir*3.2307692).rgb)*.0702702;gl_FragColor=vec4(c,1.);}'});
   mComp=new T.ShaderMaterial({uniforms:{tDiffuse:{value:null},tBloom:{value:null},tBloom2:{value:null},bloom:{value:.7},bloom2:{value:.5},flash:{value:0},flashColor:{value:new T.Vector3(1,1,1)},aberr:{value:0},time:{value:0},vignette:{value:.32},grain:{value:.025},res:{value:new T.Vector2(1,1)}},vertexShader:vs,depthTest:false,depthWrite:false,transparent:true,
    fragmentShader:`uniform sampler2D tDiffuse,tBloom,tBloom2;uniform float bloom,bloom2,flash,aberr,time,vignette,grain;uniform vec3 flashColor;uniform vec2 res;varying vec2 vUv;
float h(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
void main(){vec2 d=(vUv-.5);float r2=dot(d,d);vec2 off=d*aberr*.012;
vec4 base=texture2D(tDiffuse,vUv);vec3 c=base.rgb;
if(aberr>.001){c.r=texture2D(tDiffuse,vUv+off).r;c.b=texture2D(tDiffuse,vUv-off).b;}
vec3 b=texture2D(tBloom,vUv).rgb*bloom+texture2D(tBloom2,vUv).rgb*bloom2;
c+=b;
float l=dot(c,vec3(.299,.587,.114));c=mix(vec3(l),c,1.08);c=(c-.5)*1.05+.5;
c*=vec3(1.02,1.,.97)+vec3(.03,.01,-.02)*smoothstep(.55,1.,l);
c*=1.-vignette*smoothstep(.12,.62,r2*1.6);
c+=(h(vUv*res+time)-.5)*grain;
c=mix(c,flashColor,flash);
float a=max(base.a,clamp(max(b.r,max(b.g,b.b)),0.,1.));
gl_FragColor=vec4(clamp(c,0.,1.),a);}`});
   ok=true;return true;
  }catch(e){console.warn('Post FX unavailable',e);failed=true;return false;}
 }
 function resize(renderer){
  const s=renderer.getDrawingBufferSize(new T.Vector2());if(s.x===w&&s.y===h&&rt)return;w=s.x;h=s.y;
  for(const t of [rt,bA,bB,cA,cB])t?.dispose();
  const isGL2=renderer.capabilities.isWebGL2;rt=target(w,h,level==='high'&&isGL2?true:false);if(!rt.depthBuffer){rt.dispose();rt=new T.WebGLRenderTarget(w,h,{minFilter:T.LinearFilter,magFilter:T.LinearFilter,format:T.RGBAFormat,depthBuffer:true});rt.texture.encoding=T.sRGBEncoding;}
  const q=level==='high'?2:3;bA=target(Math.max(1,w>>q),Math.max(1,h>>q));bB=target(Math.max(1,w>>q),Math.max(1,h>>q));
  cA=target(Math.max(1,w>>(q+2)),Math.max(1,h>>(q+2)));cB=target(Math.max(1,w>>(q+2)),Math.max(1,h>>(q+2)));
  mComp.uniforms.res.value.set(w,h);
 }
 function pass(renderer,mat,out){quad.material=mat;renderer.setRenderTarget(out);renderer.render(qScene,qCam);}
 function blur(renderer,src,tmp,iters){const W=src.width,H=src.height;for(let i=0;i<iters;i++){mBlur.uniforms.tDiffuse.value=src.texture;mBlur.uniforms.dir.value.set(1/W,0);pass(renderer,mBlur,tmp);mBlur.uniforms.tDiffuse.value=tmp.texture;mBlur.uniforms.dir.value.set(0,1/H);pass(renderer,mBlur,src);}}
 const camOff=new (T?T.Vector3:Object)();
 function render(renderer,scene,camera,dt){
  time+=dt;flash=Math.max(0,flash-dt*3.2);aberr=Math.max(0,aberr-dt*2.4);shake=Math.max(0,shake-dt*2.8);
  let shaken=false;
  if(shake>.001&&camera.isCamera){const k=shake*shake*.09;camOff.set((Math.random()-.5)*k,(Math.random()-.5)*k,0).applyQuaternion(camera.quaternion);camera.position.add(camOff);camera.updateMatrixWorld();shaken=true;}
  if(level==='off'||!renderer.isWebGLRenderer||!setup(renderer)){renderer.render(scene,camera);if(shaken){camera.position.sub(camOff);camera.updateMatrixWorld();}return;}
  try{
   resize(renderer);const prevAuto=renderer.autoClear;
   renderer.setRenderTarget(rt);renderer.clear();renderer.render(scene,camera);
   mBright.uniforms.tDiffuse.value=rt.texture;pass(renderer,mBright,bA);blur(renderer,bA,bB,level==='high'?2:1);
   const wide=level==='high';if(wide){mBlur.uniforms.tDiffuse.value=bA.texture;mBlur.uniforms.dir.value.set(0,0);pass(renderer,mBlur,cA);blur(renderer,cA,cB,2);}
   const u=mComp.uniforms;u.tDiffuse.value=rt.texture;u.tBloom.value=bA.texture;u.tBloom2.value=wide?cA.texture:bA.texture;u.bloom2.value=wide?.55:0;u.flash.value=flash*.55;u.flashColor.value.set(...flashColor);u.aberr.value=aberr;u.time.value=time%100;u.grain.value=level==='high'?.022:.012;
   renderer.setRenderTarget(null);renderer.clear();quad.material=mComp;renderer.render(qScene,qCam);renderer.autoClear=prevAuto;
  }catch(e){console.warn('Post FX disabled',e);failed=true;ok=false;renderer.setRenderTarget(null);renderer.render(scene,camera);}
  if(shaken){camera.position.sub(camOff);camera.updateMatrixWorld();}
 }
 function decorate(rig){
  if(!rig?.root)return;rig.root.traverse(o=>{if(!o.isMesh&&!o.isSkinnedMesh)return;for(const m of [].concat(o.material)){if(!m||m.userData.gsfRim||!m.isMeshStandardMaterial)continue;m.userData.gsfRim=true;
   m.onBeforeCompile=sh=>{sh.uniforms.gsfRim={value:rim?1:0};m.userData.rimUniform=sh.uniforms.gsfRim;
    sh.fragmentShader='uniform float gsfRim;\n'+sh.fragmentShader.replace('gl_FragColor = vec4( outgoingLight, diffuseColor.a );',
     'vec3 gsfView=isOrthographic?vec3(0.,0.,1.):normalize(vViewPosition);float gsfF=pow(1.-clamp(dot(normal,gsfView),0.,1.),2.6);outgoingLight+=gsfRim*gsfF*vec3(.55,.62,.85)*.55*(.35+.65*diffuseColor.rgb);\n gl_FragColor = vec4( outgoingLight, diffuseColor.a );');};
   m.needsUpdate=true;rimMats.add(m);}});
 }
 return {render,decorate,
  get level(){return level;},setLevel(v){level=v;w=h=0;try{localStorage.setItem('gsf-postfx',v);}catch{}},
  get rim(){return rim;},setRim(on){rim=!!on;for(const m of rimMats)if(m.userData.rimUniform)m.userData.rimUniform.value=rim?1:0;try{localStorage.setItem('gsf-rim',rim?'1':'0');}catch{}},
  impact(damage=5,onPlayer=false,hit={}){const k=Math.min(1,damage/14),heavy=!!hit.knockdown||damage>=12||['hk','jumpkick','sweep','vwave'].includes(hit.move),kick=['lk','mk'].includes(hit.move),strength=heavy?.45+k*.8:kick?.62:.3+k*.12;flash=Math.max(flash,.18+.35*k);flashColor=onPlayer?[1,.35,.3]:[1,.95,.85];aberr=Math.max(aberr,heavy?.4+k:.16+k*.25);shake=Math.max(shake,strength);stop=Math.max(stop,heavy?.045+damage*.004:.025+damage*.002);if(window.GSFAudio)GSFAudio.hit(damage,onPlayer);if(onPlayer&&window.GSFUI?.rumble)GSFUI.rumble(80+damage*10,.4+k*.5);},
  block(){flash=Math.max(flash,.1);flashColor=[.6,.8,1];shake=Math.max(shake,.12);stop=Math.max(stop,.03);if(window.GSFAudio)GSFAudio.block();},
  whiff(){if(window.GSFAudio)GSFAudio.whiff();},
  timeScale(dt){if(stop>0){stop=Math.max(0,stop-dt);return .06;}return 1;}
 };
})();
