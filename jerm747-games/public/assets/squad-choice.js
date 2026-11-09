/* v131 · One remembered Player 1 / Groove Squad face. Opponent selections are independent. */
(()=>{'use strict';if(window.Jerm747SquadChoice)return;
const ids=Object.freeze(["og-jerm", "kiana", "jado", "eli", "honest", "simcity", "nige-hood", "lyfelong", "jimmy", "manager", "jazz", "j-read", "l-noelle", "idrum", "sir-abstraxxx", "hookshot-charlie", "mama-love", "jaycee", "g-rod", "dramas-key", "rizzy", "dirty-harry", "pg", "ronnie", "big-kent", "unk-major", "unk-engineer", "unk-supporter", "fouji", "john-henry", "chaundra", "wornitha", "dee-dee", "angela", "neese", "kay", "quinton", "kobie-keys", "sir-naulte", "nitabug"]),key='jerm747.squad.pick',playersKey='jerm747.player-fighters';
const aliases={"major": "unk-major", "cyon": "ronnie", "sheila": "unk-engineer", "rayburn": "unk-supporter", "tank": "dee-dee", "billie": "angela"};
try{const key="jerm747.squad.pick",old=localStorage.getItem(key);if(aliases[old])localStorage.setItem(key,aliases[old]);const k="jerm747.player-fighters",pair=JSON.parse(localStorage.getItem(k)||"null");if(Array.isArray(pair)&&pair.some(x=>aliases[x]))localStorage.setItem(k,JSON.stringify(pair.map(x=>aliases[x]||x)));}catch{}
let memory=null;
const valid=id=>typeof id==='string'&&ids.includes(id);
function get(){if(valid(memory))return memory;try{const id=localStorage.getItem(key);if(valid(id))return id;const old=JSON.parse(localStorage.getItem(playersKey)||'null');if(Array.isArray(old)&&valid(old[0]))return old[0];}catch{}return valid(memory)?memory:'og-jerm';}
function has(){if(valid(memory))return true;try{if(valid(localStorage.getItem(key)))return true;const pair=JSON.parse(localStorage.getItem(playersKey)||'null');return Array.isArray(pair)&&valid(pair[0]);}catch{return false;}}
function frames(){return [...document.querySelectorAll('iframe.get-down-frame,iframe.catalog-clash-frame,.j747-showcase-panel iframe')].filter(f=>{try{return new URL(f.src,location.href).origin===location.origin&&['/groove-squad-get-down.html','/groove-squad-arcade.html','/catalog-clash-level10.html'].includes(new URL(f.src,location.href).pathname);}catch{return false;}});}
function set(id,broadcast=true){if(!valid(id))return false;const before=get();memory=id;
 try{localStorage.setItem(key,id);memory=null;}catch{}
 // Preserve Player 2 even if the legacy storage is missing or malformed.
 try{let pair;try{pair=JSON.parse(localStorage.getItem(playersKey)||'null');}catch{}if(!Array.isArray(pair))pair=[id,'jimmy'];pair[0]=id;localStorage.setItem(playersKey,JSON.stringify(pair));}catch{}
 if(before!==id)window.dispatchEvent(new CustomEvent('jerm747-squad-choice',{detail:{id}}));
 if(broadcast){if(parent!==window)parent.postMessage({type:'jerm747-squad-choice',id},location.origin);for(const f of frames())f.contentWindow?.postMessage({type:'jerm747-squad-choice',id},location.origin);}
 return true;
}
window.addEventListener('message',e=>{if(e.origin!==location.origin||e.data?.type!=='jerm747-squad-choice'||!valid(e.data.id))return;const fromParent=parent!==window&&e.source===parent,fromGame=frames().some(f=>f.contentWindow===e.source);if(!fromParent&&!fromGame)return;set(e.data.id,false);});
window.addEventListener('storage',e=>{if(e.key===key||e.key===null)memory=null;});
window.Jerm747SquadChoice={ids,valid,get,set,has};
})();
