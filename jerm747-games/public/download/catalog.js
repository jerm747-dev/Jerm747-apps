// Include game-specific downloads from the site's own registry.
(async()=>{
 try{
  const response=await fetch('/api/games.php');
  if(!response.ok)return;
  const data=await response.json(),list=document.querySelector('.list');
  const known=new Set([...list.querySelectorAll('a')].map(a=>a.href));
  for(const game of data.projects||[]){
   if(!game.download?.url)continue;
   const url=new URL(game.download.url,location.origin);
   if(!['http:','https:'].includes(url.protocol)||known.has(url.href))continue;
   known.add(url.href);
   const link=document.createElement('a');link.className='tile';link.href=url.href;
   const text=document.createElement('div'),title=document.createElement('b'),detail=document.createElement('span');
   title.textContent=game.title;detail.textContent=game.download.label||'Download';
   text.append(title,detail);link.append(text);list.append(link);
  }
 }catch{/* The bundled download catalog remains available offline. */}
})();
