// Exercise the real geometry and pose code without requiring a GPU.
import * as Base from 'three';
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const base='public/projects/fighter-lab/';
const elements=new Map();let nextFrame,scene;
function element(id){if(!elements.has(id))elements.set(id,{id,style:{},hidden:id==='sheet',open:false,value:'',clientWidth:1000,clientHeight:720,offsetHeight:84,attributes:{},handlers:{},classList:{add(){},remove(){},toggle(){}},addEventListener(type,fn){this.handlers[type]=fn;},setAttribute(k,v){this.attributes[k]=v;},getAttribute(k){return this.attributes[k];},appendChild(){},focus(){},showModal(){this.open=true;},close(){this.open=false;}});return elements.get(id);}
class Renderer{constructor(){this.shadowMap={};this.domElement=element('canvas');}setClearColor(){}setPixelRatio(){}setSize(){}render(s){scene=s;}}
class Controls{constructor(){this.target=new Base.Vector3();}update(){}}
// v0.2 paints wrap textures on a canvas; a no-op 2D context is enough for the geometry checks.
const ctx2d=new Proxy({},{get(o,k){if(k in o)return o[k];if(/^create(Linear|Radial)Gradient$|^createPattern$/.test(k))return()=>({addColorStop(){}});if(k==='getImageData'||k==='createImageData')return(x,y,w=1,h=1)=>({data:new Uint8ClampedArray(w*h*4),width:w,height:h});if(k==='measureText')return()=>({width:0});return()=>{};},set(o,k,v){o[k]=v;return true;}});
function fakeCanvas(){return{width:0,height:0,style:{},getContext:()=>ctx2d,toDataURL:()=>'data:,',addEventListener(){}};}
const context={THREE:{...Base,WebGLRenderer:Renderer,OrbitControls:Controls},console,performance:{now:()=>0},ResizeObserver:class{constructor(fn){this.fn=fn;}observe(){this.fn();}},document:{getElementById:element,querySelector:()=>element('hud'),activeElement:element('body'),createElement:fakeCanvas},requestAnimationFrame:fn=>nextFrame=fn,URL,Blob,setTimeout,clearTimeout};
context.window=context;context.devicePixelRatio=1;context.addEventListener=()=>{};context.matchMedia=()=>({matches:false});context.navigator={};
vm.createContext(context);vm.runInContext(fs.readFileSync(base+'akeem-model.js','utf8'),context);
const html=fs.readFileSync(base+'index.html','utf8');const inline=[...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]).find(s=>s.includes('const SPECS'));
vm.runInContext(inline,context);let now=0;function tick(){now+=50;nextFrame(now);scene.updateMatrixWorld(true);}
tick();const model=scene.getObjectByName('AKEEM_root');assert.ok(model);
let meshes=0;model.traverse(o=>{if(o.isMesh){meshes++;assert.ok(o.geometry.attributes.position.array.every(Number.isFinite));assert.ok(o.material.color.r>=0);}});assert.ok(meshes>150);
for(const [mesh,joint]of [['vest_shell','chest'],['L_wrap_edge_0','L_wrist'],['L_knuckle_tape_0','L_finger_0'],['L_toenail_0','L_toe_joint_0'],['L_instep_wrap_0','L_ankle'],['L_shorts_wave','L_hip'],['curl_0','head']])assert.equal(scene.getObjectByName('AKEEM_'+mesh).parent.name,'AKEEM_'+joint);
for(const move of ['jab','cross','hook','upper','jump','jumpUpper','jumpKick','roundhouse']){
 element('a-'+move).handlers.click();
 for(let i=0;i<24;i++){tick();model.traverse(o=>assert.ok(o.matrixWorld.elements.every(Number.isFinite),move+' '+o.name));const bounds=new Base.Box3().setFromObject(model);assert.ok(bounds.max.y<3.5&&bounds.min.y>-.4,move+' bounds');}
}
element('b-export').handlers.click();assert.ok(element('obj-text').value.includes('AKEEM_vest_shell'));assert.ok(!/NaN|Infinity/.test(element('obj-text').value));
console.log(`Passed: ${meshes} Akeem meshes, body-part attachments (wraps, fingers, toes), all eight moves, finite transforms/bounds, and OBJ geometry.`);
