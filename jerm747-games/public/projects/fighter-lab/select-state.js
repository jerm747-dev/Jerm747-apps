/* Input-independent selection state. No DOM or renderer dependency. */
(function(root){
'use strict';
class FighterSelectState {
 constructor(ids, initial=ids.slice(0,2)) {
  if(!ids.length)throw new Error('The roster needs a fighter');
  this.ids=ids.slice();this.cursor=[0,1].map(i=>Math.max(0,ids.indexOf(initial[i]||ids[0])));
  this.locked=[false,false];this.side=0;this.focus=this.cursor[0];this.assignment=null;
 }
 get chosen(){return this.cursor.map(i=>this.ids[i]);}
 get ready(){return this.locked.every(Boolean);}
 edit(side){this.side=side;this.locked[side]=false;this.focus=this.cursor[side];}
 move(side,delta){this.edit(side);this.cursor[side]=(this.cursor[side]+delta%this.ids.length+this.ids.length)%this.ids.length;this.focus=this.cursor[side];}
 confirm(side=this.side){this.locked[side]=true;if(!this.locked[1-side])this.side=1-side;}
 browse(delta){this.focus=(this.focus+delta%this.ids.length+this.ids.length)%this.ids.length;}
 highlight(index){this.focus=Math.max(0,Math.min(this.ids.length-1,index));}
 pick(index=this.focus,side=this.side){this.highlight(index);this.assignment={index:this.focus,side:side===1?1:0};}
 chooseSide(side){if(this.assignment)this.assignment.side=side===1?1:0;}
 assign(side=this.assignment?.side){if(!this.assignment||![0,1].includes(side))return false;this.cursor[side]=this.assignment.index;this.confirm(side);this.assignment=null;return true;}
 cancel(){if(!this.assignment)return false;this.assignment=null;return true;}
 back(){if(this.ready||this.locked[1]){this.edit(1);return true;}if(this.locked[0]||this.side===1){this.edit(0);return true;}return false;}
}
// Horizontal slide selects P2 while a short tap always assigns P1.
class FighterTileGesture {
 constructor(x,y){this.x=x;this.y=y;this.side=0;this.opened=false;this.cancelled=false;this.inside=true;}
 open(){if(this.cancelled)return false;this.opened=true;return true;}
 move(x,y){
  const dx=x-this.x,dy=y-this.y;
  if(!this.opened){if(Math.hypot(dx,dy)>12)this.cancelled=true;return;}
  if(dx>14)this.side=1;else if(dx<6)this.side=0;
  this.inside=Math.abs(dx)<150&&dy>-160&&dy<85;
 }
 release(x,y,explicitSide){this.move(x,y);if(this.opened&&[0,1].includes(explicitSide))this.side=explicitSide;return this.cancelled||!this.inside?null:this.opened?this.side:0;}
}
// One instance per connected pad. Inputs must return to neutral after opening.
class FighterMenuPad {
 constructor(pad){this.previous=(pad.buttons||[]).map(b=>!!b.pressed);this.axes={};this.armed={};}
 poll(pad,now,emit,secondary=false,side=0){
  const b=pad.buttons||[],a=pad.axes||[];
  const edge=i=>!!b[i]?.pressed&&!this.previous[i];
  const direction=(key,x,y,owner)=>{
   const v=Math.abs(x)>Math.abs(y)?x:y;
   if(Math.abs(v)<.3){this.armed[key]=true;delete this.axes[key];return;}
   if(!this.armed[key]||Math.abs(v)<.55)return;
   const d=Math.sign(v),prev=this.axes[key];
   if(!prev||prev.d!==d||now>=prev.next){emit('move',owner,d);this.axes[key]={d,next:now+(!prev||prev.d!==d?360:150)};}
  };
  direction('left',a[0]||0,a[1]||0,secondary?1:0);
  if(!secondary)direction('right',a[2]||0,a[3]||0,1);
  direction('dpad',(b[15]?.pressed?1:0)-(b[14]?.pressed?1:0),(b[13]?.pressed?1:0)-(b[12]?.pressed?1:0),secondary?1:side);
  if(edge(1)||edge(8))emit('back');
  else {
   if(edge(4)||edge(10))emit('confirm',secondary?1:0);
   if(edge(5)||edge(11))emit('confirm',1);
   if(edge(0))emit('advance',secondary?1:null);
   if(edge(9))emit('start');
  }
  this.previous=b.map(b=>!!b.pressed);
 }
}
root.FighterTileGesture=FighterTileGesture;root.FighterSelectState=FighterSelectState;root.FighterMenuPad=FighterMenuPad;
if(typeof module!=='undefined')module.exports={FighterSelectState,FighterMenuPad,FighterTileGesture};
})(typeof window==='undefined'?globalThis:window);
