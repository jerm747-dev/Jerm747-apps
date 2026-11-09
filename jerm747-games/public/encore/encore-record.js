/* Only the unlock and fastest completed timed run belong to this device. */
(() => {
'use strict';
const key='nigehood.encore.finish.v1';
const valid=ms=>Number.isSafeInteger(ms)&&ms>0;
function open(getStorage){
 let unlocked=false,best=null,persistent=true;
 function read(){
  try{const value=JSON.parse(getStorage().getItem(key)||'null');
   if(value?.unlocked===true)unlocked=true;
   if(valid(value?.bestMs))best=best===null?value.bestMs:Math.min(best,value.bestMs);
  }catch{persistent=false}
 }
 read();
 return {get unlocked(){return unlocked},get best(){return best},
  finish(timed,ms){read();const previous=best;unlocked=true;
   if(timed&&valid(ms)&&(best===null||ms<best))best=ms;
   try{getStorage().setItem(key,JSON.stringify({unlocked,bestMs:best}));persistent=true}catch{persistent=false}
   return {previous,best,persistent,improved:timed&&valid(ms)&&(previous===null||ms<previous)};
  }};
}
function format(ms){
 if(!valid(ms)&&ms!==0)return '—';
 const cs=Math.floor(ms/10);return Math.floor(cs/6000)+':'+String(Math.floor(cs/100)%60).padStart(2,'0')+'.'+String(cs%100).padStart(2,'0');
}
globalThis.EncoreRecord={open,format};
})();
