/* Shared triplanar stone: original world scale with relief and variable roughness. */
window.getArenaStone=function(T,scene){
 if(scene.userData.arenaStone)return scene.userData.arenaStone;
 const quality=window.GSFQuality;
 const settings={scale:5,rotation:30,moisture:.55,light:.8,relief:1,vignette:.42,innerSize:3},materials=[];
 const foreground={amount:{value:0},size:{value:new T.Vector2(1,1)},feet:{value:1/3}},footPoint=new T.Vector3();
 const texture=new T.Texture(),surfaceMap=new T.Texture(),innerTexture=new T.Texture(),innerSurfaceMap=new T.Texture();
 for(const tex of [texture,surfaceMap,innerTexture,innerSurfaceMap]){tex.wrapS=tex.wrapT=T.MirroredRepeatWrapping;tex.anisotropy=quality?.anisotropy||4;tex.minFilter=T.LinearMipmapLinearFilter;tex.magFilter=T.LinearFilter;tex.generateMipmaps=true;}
 texture.encoding=innerTexture.encoding=T.sRGBEncoding;
 const uniforms={stoneDensity:{value:5/23.6},stoneAngle:{value:Math.PI/6},stoneOffset:{value:new T.Vector2(0,0)},stoneBumpStrength:{value:.055},stoneSurface:{value:surfaceMap},stoneWetness:{value:settings.moisture},stoneRelief:{value:1}};
 const innerUniforms={...uniforms,stoneDensity:{value:5/(23.6*settings.innerSize)},stoneOffset:{value:new T.Vector2(.41,.27)},stoneBumpStrength:{value:.075},stoneSurface:{value:innerSurfaceMap}};
 const api={settings,ready:false,error:null,texture,surfaceMap,innerTexture,innerSurfaceMap,materials,dimensions:null,innerDimensions:null,environment:null,foreground,updateView(camera,centerX,zoom,width,height){
  foreground.size.value.set(Math.max(1,width),Math.max(1,height));
  footPoint.set(centerX,0,0).project(camera);foreground.feet.value=footPoint.y*.5+.5;
  // Match the eased camera zoom: full at the wide idle view, gone by 3.2x.
  foreground.amount.value=settings.vignette*(1-T.MathUtils.smoothstep(zoom,1.45,3.2));
 },make({foreground:shadeForeground=false,inner=false}={}){
  const material=new T.MeshPhysicalMaterial({color:0xb5aa9e,map:inner?innerTexture:texture,bumpMap:inner?innerSurfaceMap:surfaceMap,bumpScale:inner ? .075 : .055,roughness:.9,metalness:0,clearcoat:.12,clearcoatRoughness:.38,envMap:api.environment?.texture||null,envMapIntensity:.35});
  material.userData.innerFloor=inner;
  material.extensions={...(material.extensions||{}),derivatives:true};
  material.onBeforeCompile=shader=>{
   Object.assign(shader.uniforms,inner?innerUniforms:uniforms);
   shader.vertexShader='varying vec3 stoneWorld; varying vec3 stoneNormal;\n'+shader.vertexShader;
   shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nstoneWorld=(modelMatrix*vec4(position,1.0)).xyz;stoneNormal=normalize(mat3(modelMatrix)*normal);');
   shader.fragmentShader=`varying vec3 stoneWorld; varying vec3 stoneNormal;
    uniform float stoneDensity; uniform float stoneAngle; uniform vec2 stoneOffset; uniform float stoneBumpStrength; uniform float stoneWetness; uniform float stoneRelief; uniform sampler2D stoneSurface;
    vec4 stoneSampleAt(sampler2D tex,vec3 position){
     vec3 w=pow(abs(normalize(stoneNormal)),vec3(8.0));w/=max(.0001,w.x+w.y+w.z);
     float c=cos(stoneAngle),s=sin(stoneAngle);mat2 turn=mat2(c,-s,s,c);
     vec3 p=position*stoneDensity;
     return texture2D(tex,turn*p.zy+stoneOffset)*w.x+texture2D(tex,turn*p.xz+stoneOffset)*w.y+texture2D(tex,turn*p.xy+stoneOffset)*w.z;
    }
    vec4 stoneSample(sampler2D tex){return stoneSampleAt(tex,stoneWorld);}
    float stoneHash(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
    float stoneNoise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(mix(stoneHash(i),stoneHash(i+vec3(1,0,0)),f.x),mix(stoneHash(i+vec3(0,1,0)),stoneHash(i+vec3(1,1,0)),f.x),f.y),mix(mix(stoneHash(i+vec3(0,0,1)),stoneHash(i+vec3(1,0,1)),f.x),mix(stoneHash(i+vec3(0,1,1)),stoneHash(i+vec3(1,1,1)),f.x),f.y),f.z);}
    float stoneHeight(vec3 p,float aa){return stoneSampleAt(stoneSurface,p).r+aa*(stoneNoise(p*155.0)*.028+stoneNoise(p*390.0)*.012);}
    vec2 stoneHeightGradient(){vec3 dx=dFdx(stoneWorld),dy=dFdy(stoneWorld);float aa=1.0-smoothstep(.003,.018,max(length(dx),length(dy)));float h=stoneHeight(stoneWorld,aa);return stoneBumpStrength*stoneRelief*vec2(stoneHeight(stoneWorld+dx,aa)-h,stoneHeight(stoneWorld+dy,aa)-h);}
    \n`+shader.fragmentShader;
   shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',T.ShaderChunk.map_fragment.replace('texture2D( map, vUv )','stoneSample(map)')+'\n diffuseColor.rgb*=stoneSample(stoneSurface).b;');
   shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>','float roughnessFactor=clamp(stoneSample(stoneSurface).g-stoneWetness*.22,.38,1.0);');
   shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',T.ShaderChunk.normal_fragment_maps.replace('dHdxy_fwd()','stoneHeightGradient()'));
   if(shadeForeground){
    shader.uniforms.foregroundAmount=foreground.amount;shader.uniforms.foregroundSize=foreground.size;shader.uniforms.foregroundFeet=foreground.feet;
    shader.fragmentShader='uniform float foregroundAmount; uniform vec2 foregroundSize; uniform float foregroundFeet;\n'+shader.fragmentShader;
    // Apply only to floor/ridge pixels. Fighter materials, walls and HUD stay lit.
    shader.fragmentShader=shader.fragmentShader.replace('#include <dithering_fragment>',`
     vec2 groundScreen=gl_FragCoord.xy/foregroundSize;
     float belowLane=1.0-smoothstep(foregroundFeet-.12,foregroundFeet-.015,groundScreen.y);
     vec2 oval=(groundScreen-vec2(.5,foregroundFeet+.08))/vec2(.66,.50);
     float ovalShade=smoothstep(.42,1.1,length(oval))*belowLane;
     gl_FragColor.rgb*=1.0-foregroundAmount*ovalShade;
     #include <dithering_fragment>
    `);
   }
  };
  material.customProgramCacheKey=()=> 'arena-world-stone-v30-'+shadeForeground+'-'+inner;materials.push(material);api.apply();return material;
 },apply(){uniforms.stoneDensity.value=settings.scale/23.6;innerUniforms.stoneDensity.value=5/(23.6*settings.innerSize);uniforms.stoneAngle.value=settings.rotation*Math.PI/180;uniforms.stoneWetness.value=settings.moisture;uniforms.stoneRelief.value=settings.relief;for(const m of materials){m.clearcoat=settings.moisture*.28;m.clearcoatRoughness=.5-settings.moisture*.23;}},set(key,value){if(!(key in settings)||!Number.isFinite(value))return;const lim={scale:[2,10],rotation:[0,180],moisture:[0,1],light:[0,2],relief:[0,2],vignette:[0,.65],innerSize:[1.5,5]}[key];settings[key]=T.MathUtils.clamp(value,...lim);api.apply();api.onChange?.();}};
 scene.userData.arenaStone=api;
 const load=(src,tex)=>new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>{let source=image;if(image.width>quality.maxTextureSize||image.height>quality.maxTextureSize){const scale=quality.maxTextureSize/Math.max(image.width,image.height);source=document.createElement('canvas');source.width=Math.floor(image.width*scale);source.height=Math.floor(image.height*scale);source.getContext('2d').drawImage(image,0,0,source.width,source.height);}tex.image=source;tex.needsUpdate=true;resolve(source);};image.onerror=()=>reject(new Error('Stone texture could not load'));image.src=src;});
 quality.ready.then(assets=>Promise.all([load(assets.stone,texture),load(assets.surface,surfaceMap),load(assets.innerStone,innerTexture),load(assets.innerSurface,innerSurfaceMap)])).then(([im,,innerIm])=>{api.dimensions={width:im.width,height:im.height};api.innerDimensions={width:innerIm.width,height:innerIm.height};api.ready=true;quality.report();}).catch(e=>{api.error=e.message;quality.report();});
 return api;
};
