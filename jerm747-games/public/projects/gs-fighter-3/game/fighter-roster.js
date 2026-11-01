/* GS Fighter III 1.01A — painted portraits based on each fighter's own rig.
 * Energy colors are shared by the selection brush spirals and gameplay V-Waves.
 * Newcomer rigs still load on demand (newcomers.js). */
window.FighterRoster=[
 {id:'Akeem',name:'Akeem',accent:'#ffbe69',subtitle:'Stand your ground',portrait:{body:'select-art/akeem-body-brush.png',head:'select-art/akeem-head-brush.png',spiral:'select-art/spiral-cyan.png'},data:()=>window.AkeemMeshData},
 {id:'Nika',name:'Nika',accent:'#b7a1ff',subtitle:'Move with purpose',portrait:{body:'select-art/nika-body-brush.png',head:'select-art/nika-head-brush.png',spiral:'select-art/spiral-gold.png'},data:()=>window.NikaMeshData}
].concat((window.GSFNewcomers?.list||[]).map(f=>({id:f.id,name:f.name,accent:f.accent,subtitle:f.subtitle,
 portrait:{body:'select-art/painted/'+f.id.toLowerCase()+'-body.webp',head:'select-art/painted/'+f.id.toLowerCase()+'-head.webp',spiral:'select-art/spiral-cyan.png'},
 data:()=>window[f.id+'MeshData']})));
FighterRoster.forEach(f=>{
 const colors=f.id==='Akeem'?[0x0675f9,0x54faff,0xc151ff]:f.id==='Nika'?[0xff4c10,0xffdc76,0xff913e]:null;
 const color=f.id==='Cyborg'?'#54faff':colors?'#'+colors[1].toString(16).padStart(6,'0'):f.accent;
 const n=parseInt(color.slice(1),16),scale=k=>((Math.round((n>>16)*k)<<16)|(Math.round(((n>>8)&255)*k)<<8)|Math.round((n&255)*k));
 f.energy={color,colors:colors||[scale(.4),n,scale(.78)]};
 f.portrait.tint=color;
});
