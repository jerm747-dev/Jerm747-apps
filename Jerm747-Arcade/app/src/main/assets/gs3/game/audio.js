/* GS Fighter III v1.0 — synthesized sound effects (Web Audio, no sample files). */
window.GSFAudio=(function(){'use strict';
 let ctx=null,master=null,noiseBuf=null,volume=.7;
 try{const v=Number(localStorage.getItem('gsf-volume'));if(!Number.isNaN(v)&&localStorage.getItem('gsf-volume')!==null)volume=v;}catch{}
 function init(){if(ctx)return ctx;const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return null;ctx=new AC();master=ctx.createGain();master.gain.value=volume;
  const comp=ctx.createDynamicsCompressor();comp.threshold.value=-14;comp.ratio.value=4;master.connect(comp);comp.connect(ctx.destination);
  noiseBuf=ctx.createBuffer(1,ctx.sampleRate*1.5,ctx.sampleRate);const d=noiseBuf.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;return ctx;}
 function unlock(){init();if(ctx&&ctx.state==='suspended')ctx.resume();}
 for(const ev of ['pointerdown','keydown','touchstart'])window.addEventListener(ev,unlock,{capture:true,passive:true});
 function live(){return ctx&&ctx.state==='running'&&volume>0;}
 function env(g,t,a,peak,dec){g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(peak,t+a);g.gain.exponentialRampToValueAtTime(.0001,t+a+dec);}
 function noise(t,dur,type,f,q,peak,dec){const s=ctx.createBufferSource();s.buffer=noiseBuf;const fl=ctx.createBiquadFilter();fl.type=type;fl.frequency.value=f;fl.Q.value=q;const g=ctx.createGain();env(g,t,.002,peak,dec);s.connect(fl);fl.connect(g);g.connect(master);s.start(t);s.stop(t+dur);return fl;}
 function tone(t,type,f0,f1,peak,dec,a=.003){const o=ctx.createOscillator();o.type=type;o.frequency.setValueAtTime(f0,t);o.frequency.exponentialRampToValueAtTime(Math.max(20,f1),t+dec);const g=ctx.createGain();env(g,t,a,peak,dec);o.connect(g);g.connect(master);o.start(t);o.stop(t+a+dec+.05);}
 return {unlock,
  get volume(){return volume;},setVolume(v){volume=v;if(master)master.gain.value=v;try{localStorage.setItem('gsf-volume',String(v));}catch{}},
  hit(d=5,onPlayer){if(!live())return;const t=ctx.currentTime,k=Math.min(1,d/14);tone(t,'sine',150+40*k,42,.9,.16+.18*k);noise(t,.25,'lowpass',1800+1500*k,.8,.55+.3*k,.09+.12*k);tone(t,'triangle',onPlayer?320:420,120,.18,.07);},
  block(){if(!live())return;const t=ctx.currentTime;tone(t,'square',1250,900,.12,.07);tone(t,'triangle',2100,1700,.1,.12);noise(t,.1,'highpass',3500,.7,.3,.05);},
  whiff(){if(!live())return;const t=ctx.currentTime;const f=noise(t,.22,'bandpass',600,1.2,.28,.16);f.frequency.exponentialRampToValueAtTime(2600,t+.16);},
  ko(){if(!live())return;const t=ctx.currentTime;tone(t,'sine',90,30,1,1.1,.01);noise(t,1.2,'lowpass',900,.6,.6,.9);tone(t+.02,'sawtooth',180,50,.15,.7);},
  bell(){if(!live())return;const t=ctx.currentTime;for(const [f,p] of [[880,.35],[1320,.18],[1760,.1]])tone(t,'sine',f,f*.99,p,1.1,.005);},
  fight(){if(!live())return;const t=ctx.currentTime;tone(t,'sawtooth',220,440,.18,.25);tone(t+.08,'square',330,660,.12,.3);noise(t,.3,'bandpass',1200,1,.25,.25);},
  wave(){if(!live())return;const t=ctx.currentTime;const f=noise(t,.7,'bandpass',300,3,.35,.6);f.frequency.exponentialRampToValueAtTime(2400,t+.5);tone(t,'sine',180,900,.15,.5,.05);},
  // 1.3.3 victory sounds to workshop (Options › Audio › Victory sound). 'classic' is the original.
  // 1.4 Aura ignition: a rising whoosh into a bright power chord.
  aura(){if(!live())return;const t=ctx.currentTime;const f=noise(t,.7,'bandpass',400,1.2,.35,.6);f.frequency.exponentialRampToValueAtTime(5200,t+.55);
   tone(t,'sawtooth',110,440,.05,.5,.02);for(const [fr,g] of [[392,.09],[587.3,.07],[784,.06],[1174.7,.035]])tone(t+.42,'triangle',fr,fr,g,.9,.01);noise(t+.42,1,'highpass',6000,.6,.06,.8);},
  win(kind){if(!live())return;if(!kind){try{kind=JSON.parse(localStorage.getItem('gsf-settings')||'{}').winSound;}catch{}}kind=kind||'fanfare';if(kind==='off')return;const t=ctx.currentTime;
   if(kind==='classic'){for(const [i,f]of [523.25,659.25,783.99,1046.5].entries()){tone(t+i*.075,'triangle',f,f,.13,.55,.01);tone(t+.25,'sine',f,f,.07,.75,.01);}return;}
   if(kind==='chime'){for(const [i,f]of [1046.5,1318.5,1568,2093].entries()){const s=t+i*.09;tone(s,'sine',f,f,.12,1.1,.004);tone(s,'sine',f*2.76,f*2.76,.025,.35,.002);tone(s,'triangle',f/2,f/2,.04,.6,.006);}noise(t+.32,1.4,'highpass',7000,.7,.035,1.1);return;}
   if(kind==='arcade'){[523.25,659.25,783.99,1046.5,1318.5,1568,2093].forEach((f,i)=>tone(t+i*.055,'square',f,f,.05,.09,.002));for(const f of [1046.5,1568,2093])tone(t+.42,'square',f,f,.045,.55,.004);tone(t+.42,'triangle',261.6,261.6,.12,.6,.004);return;}
   // fanfare (default): three bright pickup notes, then a full major chord with a soft cymbal swell. No low boom.
   for(let i=0;i<3;i++){tone(t+i*.1,'triangle',392,392,.12,.08,.004);tone(t+i*.1,'square',784,784,.025,.06,.003);}
   const c=t+.32;for(const [f,g] of [[523.25,.11],[659.25,.09],[783.99,.09],[1046.5,.07]]){tone(c,'triangle',f,f,g,1.3,.02);tone(c,'sine',f*2,f*2,g*.25,.8,.02);}
   tone(c,'sawtooth',261.6,261.6,.025,.9,.03);noise(c,1.6,'highpass',5500,.6,.05,1.3);
  },
  tally(){if(!live())return;const t=ctx.currentTime;tone(t,'sine',1500,1750,.025,.035);},
  tallyDone(){if(!live())return;const t=ctx.currentTime;tone(t,'triangle',1046,1046,.08,.15);tone(t+.065,'triangle',1568,1568,.06,.2);},
  ui(){if(!live())return;const t=ctx.currentTime;tone(t,'triangle',880,1320,.12,.06);}
 };
})();
