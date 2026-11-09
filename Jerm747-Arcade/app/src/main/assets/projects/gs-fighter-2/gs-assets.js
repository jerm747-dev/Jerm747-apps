(()=>{'use strict';
const jobs=new Map();
function image(img,src,tries=3){let attempt=0;const done=img.onload,fail=img.onerror;img.onload=async e=>{try{await img.decode()}catch{}img.onload=done;img.onerror=fail;done?.call(img,e);};img.onerror=e=>{if(++attempt<tries){setTimeout(()=>{img.src=src+(src.includes('?')?'&':'?')+'gsRetry='+attempt},attempt*300);}else{img.onload=done;img.onerror=fail;fail?.call(img,e);}};img.src=src;return img;}
async function check(){const assets=await fetch('/projects/gs-fighter-2/asset-manifest.json',{cache:'no-store'}).then(r=>r.json());let ok=0,failed=[];const queue=[...assets];await Promise.all(Array.from({length:6},async()=>{while(queue.length){const a=queue.shift();try{const r=await fetch(a.url,{method:'HEAD',cache:'no-cache'});if(!r.ok)throw Error();ok++;}catch{failed.push(a.url);}document.dispatchEvent(new CustomEvent('gs-asset-progress',{detail:{ok,failed:[...failed],total:assets.length}}));}}));return{ok,failed,total:assets.length};}
window.GSAssets={image,check,jobs};
})();
