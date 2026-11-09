/* Apply uploaded motion rotations by bone name. Keep each fighter's mesh and limb lengths. */
(function(){'use strict';
 const pack=window.FighterReactionData;
 for(const data of [window.NikaMeshData,window.AkeemMeshData]){
  const index=new Map(data.bones.map((b,i)=>[b.name,i]));
  const hip=data.bones.find(b=>b.name==='mixamorig:Hips');
  const ratio=hip.position[1]/pack.hipHeight;
  for(const clip of pack.clips){
   if(data.clips.some(c=>c.name===clip.name))continue;
   const tracks=[];
   for(const t of clip.tracks){const bone=index.get(t.boneName);if(bone==null)continue;
    if(t.path==='rotation')tracks.push({bone,path:t.path,times:t.times,values:t.values});
    else if(t.path==='translation'&&t.boneName==='mixamorig:Hips')tracks.push({bone,path:t.path,times:t.times,values:t.values.map(v=>v*ratio)});
   }
   data.clips.push({name:clip.name,duration:clip.duration,tracks,borrowed:'Golden Valkyrie reaction pack'});
  }
 }
})();
