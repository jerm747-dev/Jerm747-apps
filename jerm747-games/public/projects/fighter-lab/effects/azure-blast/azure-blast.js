/* Static FBX conversion: original geometry/UV seams/textures; no skeletal rig needed. */
(function(){'use strict';
window.createAzureBlastAsset=function(T){
 const data=window.AzureBlastData,asset={status:'loading',error:null,geometry:null,textures:{},ready:null};
 if(!data){asset.status='error';asset.error='Blast data missing';asset.ready=Promise.resolve(asset);return asset;}
 function array(value,Type){const s=atob(value),bytes=new Uint8Array(s.length);for(let i=0;i<s.length;i++)bytes[i]=s.charCodeAt(i);return new Type(bytes.buffer);}
 const geometry=new T.BufferGeometry();
 geometry.setAttribute('position',new T.BufferAttribute(array(data.position,Float32Array),3));
 geometry.setAttribute('normal',new T.BufferAttribute(array(data.normal,Float32Array),3));
 geometry.setAttribute('uv',new T.BufferAttribute(array(data.uv,Float32Array),2));
 geometry.setIndex(new T.BufferAttribute(array(data.index,data.indexType==='uint16'?Uint16Array:Uint32Array),1));
 geometry.computeBoundingBox();geometry.computeBoundingSphere();asset.geometry=geometry;
 const loader=new T.TextureLoader();
 asset.ready=Promise.all(Object.entries(data.textures).map(([key,url])=>new Promise(resolve=>{
  loader.load(url,texture=>{texture.encoding=key==='color'?T.sRGBEncoding:T.LinearEncoding;texture.wrapS=texture.wrapT=T.ClampToEdgeWrapping;texture.anisotropy=4;asset.textures[key]=texture;resolve();},undefined,()=>{asset.error='One or more blast textures could not load';resolve();});
 }))).then(()=>{asset.status=asset.textures.color?'ready':'error';return asset;});
 asset.createMesh=function(){
  if(asset.status!=='ready')return null;
  const material=new T.MeshStandardMaterial({color:0x888888,map:asset.textures.color,emissive:0xffffff,emissiveMap:asset.textures.color,emissiveIntensity:.9,normalMap:asset.textures.normal||null,normalScale:new T.Vector2(.23,.23),roughnessMap:asset.textures.metalRough||null,metalnessMap:asset.textures.metalRough||null,roughness:1,metalness:.12,side:T.DoubleSide});
  const mesh=new T.Mesh(geometry,material);mesh.name='Azure Singularity · original Meshy mesh';return mesh;
 };
 return asset;
};
})();
