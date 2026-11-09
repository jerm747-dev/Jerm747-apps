/* v0.30: retain double-height sky; soften reflections with asymmetric joins. */
window.createRiverScenery=function(T,scene,maxTextureSize=4096){
 const group=new T.Group();group.name='Living River texture lab panorama';scene.add(group);
 const clock={value:0},radius=14,panels=[],joins=[];let ready=false,error=null,dimensions=null,viewAspect=2,joinSource=null;
 // An opaque sky continuation stops the distant terrace showing ABOVE the art.
 // Back faces show only the far side, leaving the fighting lane unobstructed.
 const sky=new T.Mesh(new T.CylinderGeometry(radius+.06,radius+.06,180,96,1,true),new T.MeshBasicMaterial({color:new T.Color(0x1689ef).convertSRGBToLinear(),side:T.BackSide,fog:false}));
 sky.position.y=90-.04;sky.name='Panorama sky continuation';sky.renderOrder=-20;group.add(sky);
 const image=new Image();
 image.onload=()=>{try{
  dimensions={width:image.width,height:image.height};
  // Split large panoramas to fit the device GPU, preserving native pixels.
  const limit=Math.max(256,maxTextureSize),cols=Math.ceil(image.width/limit),rows=Math.ceil(image.height/limit);
  const imageAspect=1983/793; // Fit the ORIGINAL lower landscape, then add sky above.
  // Fit the complete central painting above the floor at the initial 11m spacing.
  function fittedHeight(){const half=Math.max(1.1,Math.max(2,8.5/viewAspect)/(17/13.4));return Math.max(2,Math.min(6,(.9+half-radius*Math.sin(.08))*.92,2*half*viewAspect*.92/imageAspect));}
  function place(mesh){const d=mesh.userData.panorama,baseHeight=fittedHeight(),h=baseHeight*2,arc=baseHeight*imageAspect/radius;
   mesh.geometry?.dispose();mesh.geometry=new T.CylinderGeometry(radius,radius,h*(d.y1-d.y0)/image.height,Math.max(12,Math.ceil(48/cols)),1,true,Math.PI-arc/2+arc*(d.copy+(Math.abs(d.copy)%2?1-d.x1/image.width:d.x0/image.width)),arc*(d.x1-d.x0)/image.width);
   if(Math.abs(d.copy)%2){const uv=mesh.geometry.attributes.uv;for(let i=0;i<uv.count;i++)uv.setX(i,1-uv.getX(i));}
   mesh.position.y=h*(1-(d.y0+d.y1)/(2*image.height))-.04;
  }
  function placeJoin(mesh){
   const baseHeight=fittedHeight(),h=baseHeight*2,arc=baseHeight*imageAspect/radius,joinArc=arc*.4;
   mesh.geometry?.dispose();mesh.geometry=new T.CylinderGeometry(radius-.02,radius-.02,h,32,1,true,Math.PI+mesh.userData.join*arc-joinArc/2,joinArc);
   mesh.position.y=h/2-.04;
  }
  group.userData.refit=()=>{panels.forEach(place);joins.forEach(placeJoin);};
  for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){
   const x0=Math.floor(col*image.width/cols),x1=Math.floor((col+1)*image.width/cols);
   const y0=Math.floor(row*image.height/rows),y1=Math.floor((row+1)*image.height/rows);
   let source=image;
   if(cols>1||rows>1){source=document.createElement('canvas');source.width=x1-x0;source.height=y1-y0;source.getContext('2d').drawImage(image,x0,y0,x1-x0,y1-y0,0,0,x1-x0,y1-y0);}
   const texture=new T.Texture(source);texture.encoding=T.sRGBEncoding;const pot=n=>(n&(n-1))===0,canMip=!!window.GSFQuality?.renderer?.capabilities?.isWebGL2||(pot(source.width)&&pot(source.height));texture.minFilter=canMip?T.LinearMipmapLinearFilter:T.LinearFilter;texture.magFilter=T.LinearFilter;texture.generateMipmaps=canMip;texture.anisotropy=window.GSFQuality?.anisotropy||1;texture.needsUpdate=true;
   for(let copy=-2;copy<=2;copy++){
   const material=new T.MeshBasicMaterial({map:texture,side:T.BackSide,fog:false,transparent:true,depthWrite:false});
   // Very subtle water shimmer is applied on the GPU without degrading the artwork.
   material.onBeforeCompile=shader=>{
    shader.uniforms.riverTime=clock;shader.uniforms.panoramaRect={value:new T.Vector4(x0/image.width,1-y1/image.height,(x1-x0)/image.width,(y1-y0)/image.height)};shader.uniforms.panoramaCopy={value:copy};
    shader.fragmentShader='uniform float riverTime; uniform vec4 panoramaRect; uniform float panoramaCopy;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',T.ShaderChunk.map_fragment+`
     #ifdef USE_MAP
      vec2 panoramaUV=panoramaRect.xy+vUv*panoramaRect.zw;
      float edgeU=mod(abs(panoramaCopy),2.0)>.5?1.0-panoramaUV.x:panoramaUV.x;
      float panoramaPosition=panoramaCopy+edgeU;
      float sideFade=smoothstep(-2.0,-1.2,panoramaPosition)*(1.0-smoothstep(2.2,3.0,panoramaPosition));
      float topFade=1.0-smoothstep(.94,1.0,panoramaUV.y);
      diffuseColor.a*=sideFade*topFade;
      float waterMask=smoothstep(.025,.16,texelColor.b-texelColor.r)*smoothstep(.015,.10,texelColor.g-texelColor.r)*(1.0-smoothstep(.24,.34,panoramaUV.y));
      float glint=pow(max(0.0,sin(panoramaUV.x*650.0+riverTime*.7)*sin(panoramaUV.y*470.0-riverTime*1.1)),12.0);
      diffuseColor.rgb+=vec3(.025,.035,.04)*waterMask*glint;
     #endif
    `);
   };
   material.customProgramCacheKey=()=> 'double-height-river-sky-v29';
   const mesh=new T.Mesh(undefined,material);mesh.userData.panorama={x0,x1,y0,y1,copy};place(mesh);
   mesh.name=copy===0?'Full central panorama':'Mirrored scenic wing';mesh.renderOrder=-10;group.add(mesh);panels.push(mesh);
   }
  }

  // One new, non-symmetric mountain strip sits over each reflected boundary.
  // Feather only this small region, preserving the approved central painting.
  const joinImage=new Image();
  joinImage.onload=()=>{try{
   let source=joinImage;
   if(Math.max(source.width,source.height)>limit){const ratio=limit/Math.max(source.width,source.height);source=document.createElement('canvas');source.width=Math.floor(joinImage.width*ratio);source.height=Math.floor(joinImage.height*ratio);source.getContext('2d').drawImage(joinImage,0,0,source.width,source.height);}
   const texture=new T.Texture(source);texture.encoding=T.sRGBEncoding;const pot=n=>(n&(n-1))===0,canMip=!!window.GSFQuality?.renderer?.capabilities?.isWebGL2||(pot(source.width)&&pot(source.height));texture.minFilter=canMip?T.LinearMipmapLinearFilter:T.LinearFilter;texture.magFilter=T.LinearFilter;texture.generateMipmaps=canMip;texture.anisotropy=window.GSFQuality?.anisotropy||1;texture.needsUpdate=true;
   for(let j=0;j<4;j++){
    const material=new T.MeshBasicMaterial({map:texture,side:T.BackSide,fog:false,transparent:true,depthWrite:false});
    material.onBeforeCompile=shader=>{
     shader.uniforms.riverTime=clock;shader.uniforms.joinFlip={value:j%2};shader.uniforms.joinOffset={value:(j-1.5)*.025};
     shader.fragmentShader='uniform float riverTime; uniform float joinFlip; uniform float joinOffset;\n'+shader.fragmentShader;
     shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`
      #ifdef USE_MAP
       vec2 joinUV=vec2(mix(vUv.x,1.0-vUv.x,joinFlip)*.9+.05+joinOffset,vUv.y);
      #endif
     `+T.ShaderChunk.map_fragment.replace('texture2D( map, vUv )','texture2D( map, joinUV )')+`
      #ifdef USE_MAP
       float joinFeather=1.0-smoothstep(.34,.50,abs(vUv.x-.5));
       float joinHeight=smoothstep(0.0,.045,vUv.y)*(1.0-smoothstep(.62,.70,vUv.y));
       diffuseColor.a*=joinFeather*joinHeight;
       float waterMask=smoothstep(.025,.16,texelColor.b-texelColor.r)*smoothstep(.015,.10,texelColor.g-texelColor.r)*(1.0-smoothstep(.24,.34,vUv.y));
       float glint=pow(max(0.0,sin(joinUV.x*260.0+riverTime*.7)*sin(vUv.y*470.0-riverTime*1.1)),12.0);
       diffuseColor.rgb+=vec3(.025,.035,.04)*waterMask*glint;
      #endif
     `);
    };
    material.customProgramCacheKey=()=> 'asymmetric-scenic-join-v30';
    const mesh=new T.Mesh(undefined,material);mesh.userData.join=j-1.5;placeJoin(mesh);mesh.name='Asymmetric mountain transition';mesh.renderOrder=-9;group.add(mesh);joins.push(mesh);
   }
   ready=true;
  }catch(e){error=e.message;console.warn('Scenic joins could not load',e);}};
  joinImage.onerror=()=>{error='Scenic mountain transition could not load';};joinImage.src=joinSource;
 }catch(e){error=e.message;console.warn('River panorama could not load',e);}};
 image.onerror=()=>{error='River panorama image could not load';};
 window.GSFQuality.ready.then(assets=>{joinSource=assets.scenicJoin;image.src=assets.river;}).catch(e=>{error=e.message;});
 return {backdrop:group,panels,joins,setViewAspect(aspect){if(Number.isFinite(aspect)&&aspect>0&&Math.abs(aspect-viewAspect)>.001){viewAspect=aspect;group.userData.refit?.();}},get dimensions(){return dimensions;},get ready(){return ready;},get error(){return error;},update(dt){if(ready)clock.value+=Math.min(dt,.1);}};
};
