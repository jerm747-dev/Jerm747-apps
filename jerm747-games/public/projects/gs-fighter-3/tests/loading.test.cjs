const {readFileSync}=require('node:fs');
const {join}=require('node:path');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const source=readFileSync(join(__dirname,'../game/screen-transition.js'),'utf8');
function setup(reduced=false){
 let now=0;const timers=[],events={},navigations=[],nodes=[],calls=[];
 function node(){const classes=new Set(),children=new Map();return {hidden:false,style:{},dataset:{},offsetWidth:100,classList:{add(...v){v.forEach(x=>classes.add(x));},remove(...v){v.forEach(x=>classes.delete(x));},contains:v=>classes.has(v)},setAttribute(){},hasAttribute(){return false;},querySelector(s){if(!children.has(s))children.set(s,node());return children.get(s);},get classes(){return classes;}};}
 const doc={currentScript:{src:'https://game.test/game/screen-transition.js'},documentElement:node(),body:{prepend:n=>nodes.push(n)},head:{append:n=>nodes.push(n)},createElement:node,images:[],fonts:{ready:Promise.resolve()},activeElement:{blur(){}},getElementById(){return null;}};
 const sandbox={document:doc,URL,URLSearchParams,console,performance:{now:()=>now},matchMedia:()=>({matches:reduced}),location:{href:'https://game.test/game/index.html',search:'',assign:url=>navigations.push({url,at:now})},setTimeout(fn,ms){timers.push({at:now+ms,fn});},requestAnimationFrame(fn){timers.push({at:now+16,fn});},addEventListener(name,fn){(events[name]??=[]).push(fn);},FighterLab:{clearInput(){}},GSFGameShell:{releasePad(){}}};
 sandbox.window=sandbox;vm.runInNewContext(source,sandbox);
 async function tick(ms){const end=now+ms;for(let turns=0;turns<10000;turns++){for(let i=0;i<8;i++)await Promise.resolve();timers.sort((a,b)=>a.at-b.at);if(!timers.length||timers[0].at>end)break;const next=timers.shift();now=next.at;next.fn();}now=end;for(let i=0;i<8;i++)await Promise.resolve();}
 return {api:sandbox.GSFLoading,doc,events,navigations,tick,calls,root:nodes[0],get now(){return now;}};
}
(async()=>{
 const boot=setup();assert.equal(boot.api.busy,true);assert.equal(boot.root.hidden,false);let blocked=0;boot.events.keydown[0]({preventDefault(){blocked++;},stopImmediatePropagation(){blocked++;}});assert.equal(blocked,2);
 console.log('PASS boot starts covered and blocks keyboard input');
 const first=boot.api.hide();await boot.tick(999);assert.equal(boot.root.hidden,false);await boot.tick(400);await first;assert.equal(boot.api.busy,false);assert.equal(boot.root.hidden,true);
 console.log('PASS the one-second settling time finishes before the reveal fade');
 const nav=boot.api.navigate('/Fighter-Select.html',{before:()=>boot.calls.push({at:boot.now})});boot.api.navigate('/duplicate');assert.equal(boot.calls.length,0);await boot.tick(259);assert.equal(boot.navigations.length,0);await boot.tick(100);await nav;assert.equal(boot.calls.length,1);assert.equal(boot.navigations.length,1);assert.equal(boot.navigations[0].url,'/Fighter-Select.html');assert.equal(boot.root.hidden,false);
 console.log('PASS outgoing UI changes only after full cover; duplicate navigation is ignored');
 const races=setup();const stale=races.api.hide();await races.tick(900);const cover=races.api.show({instant:true});await races.tick(500);await Promise.all([stale,cover]);assert.equal(races.root.hidden,false);assert.equal(races.api.busy,true);
 console.log('PASS an older reveal cannot uncover a newer loading operation');
 const assets=setup();let resolveAsset;assets.doc.images=[{complete:true,naturalWidth:100,decode:()=>new Promise(resolve=>resolveAsset=resolve)}];const ready=assets.api.ready();await assets.tick(3000);assert.equal(assets.root.hidden,false);resolveAsset();await assets.tick(2000);await ready;assert.equal(assets.root.hidden,true);
 console.log('PASS readiness waits for image decoding before the one-second reveal buffer');
 const low=setup(true),done=low.api.hide();await low.tick(100);await done;assert.equal(low.root.hidden,true);
 console.log('PASS reduced motion avoids rotation/fade delays');
})().catch(error=>{console.error(error);process.exitCode=1;});
