/* Both backends finish the scene in display sRGB and then look up the same 32³ colour grade. */
(() => {
  'use strict';
  const look = window.GPVisuals;
  const N = look.size;
  const classicFragment = `
    uniform sampler2D frameMap, gradeMap;
    uniform vec2 pixel, cssPixel;
    uniform float sharpness, glow, motion;
    varying vec2 uv0;
    vec3 readFrame(vec2 p) { return texture2D(frameMap,p).rgb; }
    float luma(vec3 c) { return dot(c,vec3(.2126,.7152,.0722)); }
    vec3 bright(vec3 c) {
      return c*smoothstep(.67,.95,max(luma(c),max(c.r,max(c.g,c.b))*.83));
    }
    void main() {
      vec3 center=readFrame(uv0), color=center;
      vec2 dx=vec2(pixel.x,0.), dy=vec2(0.,pixel.y);
      if (sharpness>0.) {
        vec3 nearAvg=.25*(readFrame(uv0+dx)+readFrame(uv0-dx)+readFrame(uv0+dy)+readFrame(uv0-dy));
        float edge=clamp(luma(center-nearAvg),-.065,.065);
        color+=edge*sharpness*.85;
      }
      if (glow>0.) {
        vec2 d=cssPixel*2.5;
        vec3 halo=.25*(bright(readFrame(uv0+d))+bright(readFrame(uv0-d))+
                       bright(readFrame(uv0+vec2(d.x,-d.y)))+bright(readFrame(uv0+vec2(-d.x,d.y))));
        color+=max(halo-bright(center),0.)*(1.-center)*(.20*glow);
      }
      float outer=smoothstep(.18,.48,abs(uv0.x-.5));
      if (motion>.001 && outer>.001) {
        vec2 offset=(uv0-vec2(.5,.52))*cssPixel*(15.*motion*outer);
        vec3 streak=.5*(readFrame(uv0-offset*.5)+readFrame(uv0-offset));
        color=mix(color,streak,.44*outer*smoothstep(0.,.12,motion));
      }
      vec3 q=clamp(color,0.,1.)*31.;
      float blue=floor(q.b);
      vec2 at=vec2((q.r+.5+blue*32.)/1024.,(q.g+.5)/32.);
      vec3 a=texture2D(gradeMap,at).rgb;
      vec3 b=texture2D(gradeMap,at+vec2(min(1.,31.-blue)/32.,0.)).rgb;
      gl_FragColor=vec4(mix(a,b,fract(q.b)),1.);
    }`;

  function classic(T, renderer, scene, camera, lut) {
    const target = renderer.capabilities.isWebGL2 && T.WebGLMultisampleRenderTarget ?
      new T.WebGLMultisampleRenderTarget(1,1) : null;
    const frame = target ? target.texture : new T.DataTexture(null,1,1,T.RGBAFormat);
    const origin = new T.Vector2(0,0);
    if (target) target.samples=Math.min(4,renderer.capabilities.maxSamples);
    frame.encoding=renderer.outputEncoding;
    frame.minFilter=frame.magFilter=T.LinearFilter;
    frame.generateMipmaps=false;
    if (!target) frame.needsUpdate=true;
    const uniforms = {
      frameMap:{value:frame}, gradeMap:{value:lut},
      pixel:{value:new T.Vector2()}, cssPixel:{value:new T.Vector2()},
      sharpness:{value:0}, glow:{value:0}, motion:{value:0}
    };
    const geometry = new T.BufferGeometry();
    geometry.setAttribute('position',new T.Float32BufferAttribute([-1,-1,0,3,-1,0,-1,3,0],3));
    const material = new T.ShaderMaterial({uniforms,
      vertexShader:'varying vec2 uv0; void main(){uv0=position.xy*.5+.5;gl_Position=vec4(position,1.);}',
      fragmentShader:classicFragment, toneMapped:false,depthTest:false,depthWrite:false});
    const mesh=new T.Mesh(geometry,material);
    mesh.frustumCulled=false;
    const screen=new T.Scene(), screenCamera=new T.Camera();
    screen.add(mesh);
    return {
      uniforms,
      render(width,height) {
        if (target) {
          target.setSize(width,height);
          renderer.setRenderTarget(target);
          try { renderer.render(scene,camera); }
          finally { renderer.setRenderTarget(null); }
        } else {
          // WebGL 1 has no multisampled scene target. Keep the game's canvas antialiasing.
          renderer.render(scene,camera);
          if (frame.image.width!==width || frame.image.height!==height) {
            frame.image.width=width; frame.image.height=height; frame.needsUpdate=true;
          }
          renderer.copyFramebufferToTexture(origin,frame);
        }
        renderer.render(screen,screenCamera);
      }
    };
  }

  function modern(T, renderer, scene, camera, lut) {
    const {vec2,vec3,vec4,uniform,uv,clamp,smoothstep,mix,max,min,dot,If} = T;
    const pass=T.pass(scene,camera);
    const source=pass.getTextureNode();
    const uv0=uv();
    const tone=renderer.toneMapping, space=renderer.outputColorSpace;
    const readFrame=p=>clamp(T.renderOutput(source.uv(p),tone,space).rgb,0,1);
    const weights=vec3(.2126,.7152,.0722);
    const bright=c=>c.mul(smoothstep(.67,.95,max(dot(c,weights),max(c.r,max(c.g,c.b)).mul(.83))));
    const pixel=uniform(new T.Vector2()), cssPixel=uniform(new T.Vector2());
    const sharpness=uniform(0), glow=uniform(0), motion=uniform(0);
    const colors=T.texture(lut);
    const output=T.Fn(()=>{
      const center=readFrame(uv0).toVar(), color=center.toVar();
      const dx=vec2(pixel.x,0),dy=vec2(0,pixel.y);
      If(sharpness.greaterThan(0),()=>{
        const near=readFrame(uv0.add(dx)).add(readFrame(uv0.sub(dx))).add(readFrame(uv0.add(dy))).add(readFrame(uv0.sub(dy))).mul(.25);
        const edge=clamp(dot(center.sub(near),weights),-.065,.065);
        color.addAssign(edge.mul(sharpness).mul(.85));
      });
      If(glow.greaterThan(0),()=>{
        const d=cssPixel.mul(2.5), reflected=d.mul(vec2(1,-1));
        const halo=bright(readFrame(uv0.add(d))).add(bright(readFrame(uv0.sub(d))))
          .add(bright(readFrame(uv0.add(reflected)))).add(bright(readFrame(uv0.sub(reflected)))).mul(.25);
        color.addAssign(max(halo.sub(bright(center)),0).mul(center.oneMinus()).mul(glow).mul(.20));
      });
      const outer=smoothstep(.18,.48,uv0.x.sub(.5).abs());
      If(motion.greaterThan(.001).and(outer.greaterThan(.001)),()=>{
        // The quad's UV origin is at the top in TSL.
        const d=uv0.sub(vec2(.5,.48)).mul(cssPixel).mul(motion.mul(15).mul(outer));
        const streak=readFrame(uv0.sub(d.mul(.5))).add(readFrame(uv0.sub(d))).mul(.5);
        color.assign(mix(color,streak,outer.mul(.44).mul(smoothstep(0,.12,motion))));
      });
      const q=clamp(color,0,1).mul(N-1), slice=q.b.floor();
      const at=vec2(q.r.add(.5).add(slice.mul(N)).div(N*N),q.g.add(.5).div(N));
      const right=at.add(vec2(min(1,slice.negate().add(N-1)).div(N),0));
      return vec4(mix(colors.uv(at).rgb,colors.uv(right).rgb,q.b.fract()),1);
    })();
    const post=new T.PostProcessing(renderer,output);
    post.outputColorTransform=false;
    return {uniforms:{pixel,cssPixel,sharpness,glow,motion},render:()=>post.render()};
  }

  look.createRenderer = function(T, renderer, scene, camera) {
    let pipe, lut, lastKey='', failed=false;
    function update() {
      if (!pipe || !look.settings.enabled) return;
      const s=look.settings, next=s.warmth+'/'+s.light;
      if (next !== lastKey) {
        look.fillLut(lut.image.data);
        lut.needsUpdate=true; lastKey=next;
      }
      pipe.uniforms.sharpness.value=s.sharpness/100;
      pipe.uniforms.glow.value=s.glow/100;
    }
    look.listeners.add(update);
    return function render(speedFraction=0) {
      if (!failed && look.settings.enabled) {
        const oldTone=renderer.toneMapping, oldSpace=renderer.outputColorSpace;
        try {
          if (!pipe) {
            lut = new T.DataTexture(new Uint8Array(N*N*N*4),N*N,N,T.RGBAFormat);
            lut.minFilter=lut.magFilter=T.LinearFilter; lut.generateMipmaps=false;
            pipe=(renderer.isWebGPURenderer ? modern : classic)(T,renderer,scene,camera,lut);
            update();
          }
          const canvas=renderer.domElement,w=canvas.width,h=canvas.height;
          const ratio=renderer.getPixelRatio();
          pipe.uniforms.pixel.value.set(1/w,1/h);
          pipe.uniforms.cssPixel.value.set(ratio/w,ratio/h);
          pipe.uniforms.motion.value=look.motionAmount(speedFraction);
          pipe.render(w,h);
          return;
        } catch (err) {
          failed=true;
          renderer.setRenderTarget(null);
          renderer.toneMapping=oldTone;
          if (oldSpace !== undefined) renderer.outputColorSpace=oldSpace;
          renderer.domElement.setAttribute('data-gp-menu-art','');
          look.setColorOnly();
          console.warn('747 GP is using the menu color grade for this renderer.',err);
        }
      }
      renderer.render(scene,camera);
    };
  };
})();
