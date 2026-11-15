import {useState,useRef,useEffect} from 'react';
import {audio,out} from '../engine/audio.js';
import {saveRegions} from '../engine/library.js';

const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
export default function SampleEditor({clip,onClose}){
  const buffer=clip.buffer, total=buffer.length, rate=buffer.sampleRate;
  const [mode,setMode]=useState('Trim'),[a,setA]=useState(0),[b,setB]=useState(total),[split,setSplit]=useState(Math.floor(total/2));
  const [view,setView]=useState([0,total]),[marker,setMarker]=useState('Start'),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const wave=useRef(null),points=useRef(new Map()),gesture=useRef(null),source=useRef(null),saving=useRef(false);
  const start=view[0],width=view[1]-start,active=mode==='Chop'?'Split':marker;
  const frameOf=name=>name==='Start'?a:name==='End'?b:split;
  const change=(name,value)=>{const n=Math.round(value);if(name==='Split')setSplit(clamp(n,1,total-1));else if(name==='Start')setA(clamp(n,0,b-1));else setB(clamp(n,a+1,total))};
  const zoom=(span,anchor,fraction)=>{span=clamp(Math.round(span),Math.min(32,total),total);const left=clamp(Math.round(anchor-span*fraction),0,total-span);setView([left,left+span])};
  const fraction=e=>clamp((e.clientX-e.currentTarget.getBoundingClientRect().left)/e.currentTarget.clientWidth,0,1);
  function down(e){
    e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);const f=fraction(e);points.current.set(e.pointerId,f);
    if(points.current.size===2){const [x,y]=points.current.values();gesture.current={type:'zoom',span:width,gap:Math.max(.001,Math.abs(x-y)),anchor:start+width*(x+y)/2};return}
    if(points.current.size!==1)return;
    const n=start+width*f;let name=active;
    if(mode==='Trim'){if(Math.abs(n-a)/width<.10)name='Start';else if(Math.abs(n-b)/width<.10)name='End';setMarker(name)}
    gesture.current={type:'drag',name,initial:f,moved:false};
  }
  function move(e){
    if(!points.current.has(e.pointerId))return;
    const f=fraction(e);points.current.set(e.pointerId,f);const g=gesture.current;if(!g)return;
    if(g.type==='zoom'&&points.current.size===2){const [x,y]=points.current.values();zoom(g.span*g.gap/Math.max(.001,Math.abs(x-y)),g.anchor,(x+y)/2)}
    else if(g.type==='drag'&&Math.abs(f-g.initial)>.005){g.moved=true;change(g.name,start+f*width)}
  }
  function up(e){
    if(!points.current.has(e.pointerId))return;
    const g=gesture.current;if(e.type==='pointerup'&&g?.type==='drag'&&!g.moved)change(g.name,start+fraction(e)*width);
    points.current.delete(e.pointerId);gesture.current=null;
  }
  useEffect(()=>{
    const canvas=wave.current;
    function draw(){
      const w=Math.max(1,Math.round(canvas.clientWidth)),h=Math.max(1,Math.round(canvas.clientHeight)),d=Math.min(devicePixelRatio||1,2);
      canvas.width=w*d;canvas.height=h*d;const c=canvas.getContext('2d');c.scale(d,d);c.fillStyle='#101b21';c.fillRect(0,0,w,h);
      const px=n=>(n-start)*w/width;
      if(mode==='Trim'){c.fillStyle='#183b3d';c.fillRect(px(a),0,px(b)-px(a),h)}
      for(let x=0;x<w;x++){let peak=0;const i=Math.floor(start+x*width/w),end=Math.min(total,Math.max(i+1,Math.ceil(start+(x+1)*width/w)));for(let ch=0;ch<buffer.numberOfChannels;ch++){const data=buffer.getChannelData(ch);for(let j=i;j<end;j+=Math.max(1,Math.floor((end-i)/96)))peak=Math.max(peak,Math.abs(data[j]))}
        c.fillStyle='#81e4d7';const v=Math.max(1,peak*h*.85);c.fillRect(x,(h-v)/2,1,v)}
      for(const [label,n] of mode==='Trim'?[['Start',a],['End',b]]:[['Split',split]]){if(n<start||n>start+width)continue;const x=clamp(px(n),1,w-2);c.fillStyle='#ffb06d';c.fillRect(x-1,0,3,h);c.font='bold 12px system-ui';c.fillText(label,clamp(x+4,4,w-32),16)}
    }
    draw();const observer=new ResizeObserver(draw);observer.observe(canvas);return()=>observer.disconnect();
  },[buffer,start,width,a,b,split,mode]);
  function stop(){if(source.current){try{source.current.stop()}catch{}source.current=null}}
  useEffect(()=>()=>stop(),[]);
  function preview(lo,hi){stop();const ac=audio();if(!ac)return;const s=ac.createBufferSource();s.buffer=buffer;s.connect(out());source.current=s;s.start(0,lo/rate,(hi-lo)/rate)}
  async function save(){if(saving.current)return;saving.current=true;setBusy(true);stop();try{const regions=mode==='Trim'?[[a,b,'trim']]:[[0,split,'A'],[split,total,'B']];await saveRegions(clip,regions);onClose(mode==='Trim'?'Trimmed copy saved.':'Both chops saved.')}catch(e){setError('Could not save the edit. Your original is available.');saving.current=false;setBusy(false)}}
  return <div className="pop-scrim bin-scrim"><section className="pop-card sample-editor" role="dialog" aria-label="Sample editor"><div className="edit-head"><h3>{clip.name}</h3><button className="btn" disabled={busy} onClick={()=>onClose('')}>Back</button></div>
    <div className="edit-actions">{['Trim','Chop'].map(m=><button className="btn" key={m} aria-pressed={m===mode} disabled={m==='Chop'&&total<2} onClick={()=>setMode(m)}>{m}</button>)}</div>
    <canvas ref={wave} aria-label="Sample waveform. Drag a marker or pinch to zoom" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onLostPointerCapture={up}/>
    <div className="edit-overview" aria-label="Visible portion of the full sample"><i style={{left:(100*start/total)+'%',width:(100*width/total)+'%'}}/></div>
    <small>Window {(start/rate).toFixed(3)}–{((start+width)/rate).toFixed(3)} s · {(total/width).toFixed(1)}×</small>
    <div className="edit-actions">{(mode==='Trim'?['Start','End']:['Split']).map(n=><button className="btn" key={n} aria-pressed={active===n} onClick={()=>setMarker(n)}>{n} {(frameOf(n)/rate).toFixed(3)} s</button>)}
    <button className="btn" onClick={()=>zoom(width/2,frameOf(active),.5)}>Zoom +</button><button className="btn" onClick={()=>zoom(width*2,frameOf(active),.5)}>Zoom −</button></div>
    <label>{active} marker <input aria-label={active+' marker'} type="range" min={active==='Start'?0:active==='End'?a+1:1} max={active==='Start'?b-1:active==='End'?total:total-1} step="1" value={frameOf(active)} onChange={e=>change(active,+e.target.value)}/></label>
    <div className="edit-actions"><button className="btn" onClick={()=>preview(mode==='Trim'?a:0,mode==='Trim'?b:split)}>{mode==='Trim'?'Preview trim':'Preview A'}</button>{mode==='Chop'&&<button className="btn" onClick={()=>preview(split,total)}>Preview B</button>}<button className="btn" onClick={stop}>Stop</button><button className="btn" disabled={busy} onClick={save}>{busy?'Saving…':mode==='Trim'?'Save trimmed copy':'Save two samples'}</button></div>{error&&<p role="alert">{error}</p>}
  </section></div>
}
