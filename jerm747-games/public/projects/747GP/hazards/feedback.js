// Short original PCM one-shots and seamless textures. No external sample fetch.
(() => {
  'use strict';
  const unit = x => Math.min(1, Math.max(0, x));
  const TAU = 2*Math.PI, rate = 24000;
  function random(seed) {
    return () => { seed = (Math.imul(1664525,seed)+1013904223) >>> 0; return seed / 4294967296; };
  }

  // Each voice has its own attack, low resonance and ringing panel frequencies.
  const panels = [[115,390,715,.13],[78,280,530,.22],[155,490,860,.12],[96,355,1020,.18]];
  const rails = [[67,640,1315,.30],[88,860,1750,.23],[55,465,1120,.34]];
  function impact(ac, shape, metal, seed) {
    const [low,mid,high,tail] = shape, n = Math.ceil(rate*(tail+.035));
    const b = ac.createBuffer(1,n,rate), a = b.getChannelData(0), noise = random(seed);
    let smooth = 0;
    for (let i=0; i<n; i++) {
      const t=i/rate, raw=noise()*2-1;
      smooth += (raw-smooth)*.28;
      const attack=1-Math.exp(-t*1700), fade=unit((n-1-i)/220);
      const ring=.24*Math.sin(TAU*mid*t)*Math.exp(-t*5/tail)
        + .16*Math.sin(TAU*high*t)*Math.exp(-t*(metal?3.7:7)/tail);
      const thud=.6*Math.sin(TAU*(low*t+0.8*(1-Math.exp(-t*45))))*Math.exp(-t*6/tail);
      const clatter=(raw-smooth)*(.34*Math.exp(-t*105)+.15*Math.exp(-Math.abs(t-.029)*145));
      a[i]=Math.tanh(thud+ring+clatter)*attack*fade;
    }
    return b;
  }

  function texture(ac, kind) {
    const n=rate*2, overlap=2000, wave=new Float32Array(n+overlap);
    const noise=random({grass:12,dirt:42,gravel:31,curb:54,skid:87,scrape:105}[kind]);
    let slow=0, grain=0, last=0;
    for(let i=0; i<wave.length; i++) {
      const t=i/rate, r=noise()*2-1;
      slow+=(r-slow)*.11;
      if(noise()<.013) grain=.25+.75*noise();
      grain*=.976;
      switch(kind) {
        case 'grass': wave[i]=slow*(.65+.25*Math.sin(TAU*4.5*t))+.11*(r-last)*grain;break;
        case 'dirt': wave[i]=.52*slow+.32*(r-last)*grain;break;
        case 'gravel': wave[i]=grain*(.29*r+.45*Math.sin(TAU*1350*t))+.22*slow;break;
        case 'curb': wave[i]=Math.exp(-((t*19)%1)*7)*(.5*Math.sin(TAU*102*t)+.35*slow);break;
        case 'scrape': wave[i]=(.30*(r-last)+.21*Math.sin(TAU*686*t))* (.65+.3*grain);break;
        case 'skid': wave[i]=.39*Math.sin(TAU*1040*t+2.8*Math.sin(TAU*19.5*t))+
          .19*Math.sin(TAU*1540*t+.8*Math.sin(TAU*33*t))+.18*(r-last);break;
      }
      last=r;
    }
    const buf=ac.createBuffer(1,n,rate), data=buf.getChannelData(0);
    data.set(wave.subarray(0,n));
    for(let i=0;i<overlap;i++){const w=i/overlap;data[i]=wave[n+i]*(1-w)+wave[i]*w;}
    return buf;
  }

  class Sound {
    constructor(ac) {
      this.ac=ac; this.out=ac.createGain(); this.out.gain.value=0; this.out.connect(ac.destination);
      this.hits={body:panels.map((x,i)=>impact(ac,x,false,2026+i)),wall:rails.map((x,i)=>impact(ac,x,true,747+i))};
      this.next={body:0,wall:0}; this.loops={};
      for(const k of ['grass','dirt','gravel','curb','skid','scrape']) {
        const gain=ac.createGain(), src=ac.createBufferSource();
        gain.gain.value=0; src.buffer=texture(ac,k);src.loop=true;src.connect(gain);gain.connect(this.out);
        src.start();this.loops[k]={gain,src,level:0,rate:1};
      }
    }
    volume(value) { if(value!==this.level){this.level=value;this.out.gain.setTargetAtTime(value,this.ac.currentTime,.012);} }
    hit(type, speed, near=1) {
      if(!this.level || near<=0) return;
      const bank=this.hits[type], index=this.next[type]++%bank.length;
      const src=this.ac.createBufferSource(), gain=this.ac.createGain();
      src.buffer=bank[index]; src.playbackRate.value=.96+Math.random()*.08;
      gain.gain.value=(.17+.67*unit(speed/20))*near;
      src.connect(gain);gain.connect(this.out);src.onended=()=>{src.disconnect();gain.disconnect();};src.start();
    }
    road(kind,speed,slip,scrape) {
      const motion=unit((speed-.8)/21);
      for (const [key,voice] of Object.entries(this.loops)) {
        let level=key===kind ? motion*(key==='grass'?.30:key==='gravel'?.48:.34) : 0;
        if(key==='skid')level=kind==='asphalt'?motion*unit((slip-.045)*6)*.29:0;
        if(key==='scrape')level=unit(scrape)*motion*.41;
        const pitch=key==='skid'?.86+.22*unit(slip*3):.70+.60*unit(speed/55);
        if(Math.abs(voice.level-level)>.003 || (!level && voice.level)) {
          voice.gain.gain.setTargetAtTime(level,this.ac.currentTime,.045);voice.level=level;
        }
        if(level && Math.abs(pitch-voice.rate)>.015){
          voice.src.playbackRate.setTargetAtTime(pitch,this.ac.currentTime,.05);voice.rate=pitch;
        }
      }
    }
  }

  class Haptics {
    constructor(device=navigator) { this.device=device; this.enabled=true; this.next=0; this.epoch=0; this.pad=null; }
    pulse(power, duration, impact=false) {
      if(!this.enabled || !power || (!impact && performance.now()<this.next))return;
      power=unit(power);
      this.next=performance.now()+(impact?Math.max(145,duration+55):duration+95);
      const epoch=++this.epoch;
      const phone=()=>{if(this.enabled && epoch===this.epoch && this.device.vibrate) {
        try{this.device.vibrate(Math.round(duration*(.4+.6*power)));}catch(_){}
      }};
      try {
        const pad=Array.from(this.device.getGamepads?.() || []).find(p=>p?.connected);
        const act=pad?.vibrationActuator || pad?.hapticActuators?.[0];
        if(!act){phone();return;}
        this.pad=act;
        let result;
        if(act.playEffect)result=act.playEffect('dual-rumble',{duration,startDelay:0,strongMagnitude:power,weakMagnitude:Math.sqrt(power)*.8});
        else if(act.pulse)result=act.pulse(power,duration);
        else {phone();return;}
        Promise.resolve(result).then(v=>{if(v===false||v==='not-supported')phone();},phone);
      }catch(_){phone();}
    }
    hit(speed) { const p=unit(speed/19);this.pulse(.18+.78*p,Math.round(25+83*p),true); }
    road(kind,speed,slip,scrape) {
      const motion=unit((speed-1.5)/23);
      let level={grass:.14,dirt:.19,gravel:.32,curb:.27}[kind]||0;
      if(kind==='asphalt')level=.17*unit((slip-.05)*6);
      level=Math.max(level,.38*unit(scrape))*motion;
      if(level>.025)this.pulse(level,Math.round(18+level*105));
    }
    stop() {
      ++this.epoch;this.next=0;
      try{this.pad?.reset?.()?.catch?.(()=>{});}catch(_){}
      if(this.device.vibrate)try{this.device.vibrate(0);}catch(_){}
    }
  }
  window.GPFeedback={Sound,Haptics};
})();
