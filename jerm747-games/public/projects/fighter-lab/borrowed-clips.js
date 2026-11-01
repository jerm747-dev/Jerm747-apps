/* v0.14: Nika has no get-up clip yet, so she borrows Akeem's Stand_Up1/3/7.
 * Both rigs use the same Mixamo-named skeleton and Meshy clips store full local rotations, so rotations copy across
 * by bone name. Hip height is scaled to Nika's proportions; other bones keep Nika's own lengths. */
(function(){
 function borrow(from,to,names){const idx=new Map(to.bones.map((b,i)=>[b.name,i])),ratio=to.bones[0].position[1]/from.bones[0].position[1];
  for(const name of names){const c=from.clips.find(c=>c.name===name);if(!c||to.clips.some(k=>k.name===name))continue;const tracks=[];
   for(const t of c.tracks){const bi=idx.get(from.bones[t.bone].name);if(bi==null)continue;
    if(t.path==='rotation')tracks.push({bone:bi,path:'rotation',times:t.times,values:t.values});
    else if(t.path==='translation'&&from.bones[t.bone].parent<0)tracks.push({bone:bi,path:'translation',times:t.times,values:t.values.map(v=>v*ratio)});}
   to.clips.push({name,duration:c.duration,tracks,borrowed:from===window.AkeemMeshData?'Akeem':'other'});}}
 borrow(window.AkeemMeshData,window.NikaMeshData,['Stand_Up1','Stand_Up3','Stand_Up7']);
})();
