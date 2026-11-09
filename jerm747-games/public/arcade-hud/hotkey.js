'use strict';
// Shared by the WebView host and the visor. Coordinates are fractions of the
// safe rectangle for the CENTER of a 48 px target, never physical screen pixels.
window.Jerm747Hotkey=(()=>{
  const prefix='jerm747.arcade.hotkey.',memory=new Map();
  function read(key){
    try{return localStorage.getItem(prefix+key)??memory.get(key);}catch{return memory.get(key);}
  }
  function write(key,value){
    memory.set(key,value);
    try{localStorage.setItem(prefix+key,value);}catch{/* Keep the choice in-session. */}
  }
  const unit=n=>Math.round(Math.max(0,Math.min(1,n))*10000)/10000;
  const point=(x,y)=>({x:unit(x),y:unit(y)});
  const positionKey=id=>'position.'+(id?'game-'+id:'default');
  function savedPosition(id=''){
    try{
      const p=JSON.parse(read(positionKey(id)));
      if(p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=0&&p.x<=1&&p.y>=0&&p.y<=1)return p;
    }catch{/* An invalid preference falls back to the cabinet position. */}
    return null;
  }
  function position(id=''){
    return savedPosition(id)||(id&&savedPosition())||{x:1,y:0};
  }
  function place(bounds,pos){bounds.style.setProperty('--hud-x',pos.x);bounds.style.setProperty('--hud-y',pos.y);}
  return {point,place,position,savedPosition,save:(id,pos)=>write(positionKey(id),JSON.stringify(pos)),
    visible:()=>read('visible')!=='off',setVisible:on=>write('visible',on?'on':'off'),
    isPreference:key=>key===null||key.startsWith(prefix)};
})();
