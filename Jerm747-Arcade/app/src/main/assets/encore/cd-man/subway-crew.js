/* The night-shift cast. Coordinates and facing match Cast.drawCritter. */
(() => {
 'use strict';
 const ink='#172432', steel='#b4ccd6', ice='#e9f6f3', amber='#ffbf54';
 const outlines=new Map();

 function shape(c,d,fill,edge=ink,weight=1.6){
  let path=outlines.get(d);
  if(!path){path=new Path2D(d);outlines.set(d,path)}
  if(fill){c.fillStyle=fill;c.fill(path)}
  if(edge){c.strokeStyle=edge;c.lineWidth=weight;c.stroke(path)}
 }
 function oval(c,x,y,w,h,fill,edge=null,weight=1){
  c.beginPath();c.ellipse(x,y,w,h,0,0,Math.PI*2);
  c.fillStyle=fill;c.fill();
  if(edge){c.strokeStyle=edge;c.lineWidth=weight;c.stroke()}
 }
 function eyes(c,x,y){
  c.save();c.translate(x,y);
  oval(c,-3.3,0,3.2,3.5,ice,ink);
  oval(c,3.3,-.3,2.9,3.5,ice,ink);
  oval(c,-2.1,0,1.4,2.3,ink);
  oval(c,4.3,-.4,1.3,2.3,ink);
  shape(c,'M-7 -4.8 L-.6 -3 M1.3 -3.1 L6.8 -5.1',null,ink,1.75);
  c.restore();
 }
 function shades(c,x,y){
  c.save();c.translate(x,y);
  shape(c,'M-11 -4 L10 -4 L9 -.7 Q8 3 4 3 Q1 3 0 -.7 L-1 -.7 Q-2 3.4 -7 3 Q-10 2.8 -10 -1.6 Z','#183545',ink,1.2);
  shape(c,'M-8.5 -2.5 L-4.1 -2.5 L-7.3 .5 Z M2.8 -2.5 L6.6 -2.5 L4.3 .5 Z','#99dbe3',null);
  c.restore();
 }
 function shoe(c,x,y){
  c.save();c.translate(x,y);
  shape(c,'M-4 -4.8 L1 -5.1 L2.3 -3.3 Q7 -3.6 7 -.5 Q7 .7 4.8 .8 L-3.4 .7 Q-4.6 .5 -4.6 -1.4 Z','#4d697c');
  shape(c,'M-3.5 -.5 Q1 .3 5.6 -.7',null,'#a6cdd8',.9);
  c.restore();
 }

 // The same chocolate silhouette wears a torn midnight-blue foil wrapper.
 function cocoa(c){
  shape(c,'M-17 -9 L-17 -21 L-13 -24 L-13 -28 L7 -31 L14 -28 L14 -24 L17 -21 L17 -9 L10 -6 L-10 -6 Z','#66433f');
  shape(c,'M-13 -28 L7 -30 L12 -28 L-7 -25 Z','#bc8660',null);
  shape(c,'M-12 -24 L9 -27 M-4 -28 L-.5 -26.6 M2 -29 L5.5 -27.7',null,'#523c3b',.85);
  shape(c,'M-17 -21 L-11 -18.8 L-8 -21 L-4 -19.5 L-.5 -22.5 L3 -20.8 L8 -23.2 L12 -22.3 L17 -24 L17 -10 L11 -6 L-10 -6 L-17 -9 Z','#487ca5');
  shape(c,'M-16 -19.4 L-11 -17.8 L-7.7 -20 L-4 -18.4 L-.4 -21.5 L3 -19.7 L8 -22.2 L12 -21.1 L16 -22.7',null,'#c3e1de',1.2);
  shape(c,'M11 -20 L16 -21.6 L16 -10.5 L11 -8 Z','#2e506c',null);
  eyes(c,1,-14);
  shape(c,'M2 -8.8 Q5 -7.8 7 -10.1',null,ink,1.15);
 }

 // A blue enamel station plate with a front-view train pictogram.
 function marker(c){
  shape(c,'M-14 -28 L-11 -31 L13 -31 L16 -28 L16 -9 L12 -6 L-12 -6 L-15 -9 Z','#254e78');
  shape(c,'M-11 -28.6 L12 -28.6 L13.4 -27 L13.4 -10.1 L11 -8.6 L-11 -8.6 L-12.4 -10 L-12.4 -27 Z',null,'#b5d5e4',1);
  shape(c,'M-7 -26.6 H.8 Q2 -26.6 2 -25.3 V-22 L.6 -20.6 H-7 L-8.2 -22 V-25.3 Q-8 -26.6 -7 -26.6 Z',ice,null);
  shape(c,'M-7 -25.2 H.8 V-23.1 H-7 Z','#275077',null);
  shape(c,'M-5.8 -21.2 L-7.8 -18.8 M-.4 -21.2 L1.3 -18.8',null,ice,.85);
  shape(c,'M4.5 -23.8 H10 M8.2 -25.6 L10 -23.8 L8.2 -22',null,amber,1.35);
  eyes(c,1,-14.1);
 }

 // A scalloped transit token with the original little crew's heavy shades.
 function token(c){
  shape(c,'M-16 -14 Q-17 -23 -10 -27 L-8 -28 L-5 -28 L-3 -30 L3 -30 L5 -28.8 L9 -28 Q16 -25 17 -18 Q18 -10 11 -7 L-10 -7 Q-15 -8 -16 -14 Z','#658598');
  shape(c,'M-12.5 -14 Q-13.4 -23 -6 -26 Q3 -30 9 -25',null,'#c4dde3',1.7);
  shape(c,'M-4.2 -25.8 H4.6 L3.4 -23.8 H.7 V-20.1 H-1.7 V-23.8 H-5.2 Z','#d4e4e5',null);
  shades(c,1,-15.1);
  shape(c,'M1 -9.4 Q4 -7.7 7 -10.3',null,ink,1.1);
 }

 // A clipped ticket, stamped twice by the conductor.
 function ticket(c){
  shape(c,'M-17 -23 L-13 -28 L12 -30 L16 -27 L15.9 -22 Q12.5 -21 13 -18.7 Q13 -17 16.3 -17 L17 -11 L14 -7.5 L-12 -6 L-16 -9 L-16.4 -14.3 Q-12.6 -15.3 -13 -17.1 Q-13.5 -19.3 -16.8 -19 Z','#96b8c5');
  shape(c,'M-14 -22.6 L-11.8 -25.5 L13 -27.5 L14 -25.8 L-13.5 -23.8 Z','#355f83',null);
  shape(c,'M-12 -9 L8.2 -10 M10.9 -25.1 L11 -22.8 M11.3 -15.9 L11.5 -13.4',null,'#49748b',.95);
  eyes(c,.5,-16.2);
  oval(c,-9.5,-20.5,1.2,1.1,ink);oval(c,-5.5,-20.9,1.2,1.1,ink);
  shape(c,'M1 -10.8 Q3.2 -10.1 5.3 -11.9',null,ink,1.1);
 }

 function conductor(c){
  shape(c,'M-15 -18 Q-15 -25 -5 -25 L7 -25 Q15 -24 16 -18 L15 -11 Q14 -7 9 -6.5 H-11 Q-15 -8 -15 -13 Z','#738da1');
  shape(c,'M-15 -23 Q-19 -25 -16 -28 Q-10 -32 -1 -31 Q11 -32 15 -28 L14 -24 L9 -22 L-11 -21.7 Z','#384e6d');
  shape(c,'M-13 -23.6 Q.5 -26.3 13 -24.7 L12 -22.6 L-12 -21.5 Z','#dbab51',null);
  shape(c,'M-8 -21.9 Q4 -24.4 15 -23.7 L18 -22.1 Q17 -19.7 9.5 -20.7 L-7.8 -20.4 Z','#233647',ink,1);
  oval(c,-2,-27,2.2,1.9,amber,'#534f51',.65);
  eyes(c,1,-15.3);
  shape(c,'M-4 -9.5 Q1 -12.1 3 -9.8 Q5 -12 9 -11 Q6.9 -7.2 3 -8.7 Q.4 -7 -4 -9.5 Z','#30445a',null);
 }

 function spike(c){
  // Three bright steel spikes are the collision cue. Other hats have blunt tops.
  shape(c,'M-17 -13 L-15 -20 L-16 -30 L-9 -23 L-3 -32 L1 -23 L9 -31 L11 -22 L16 -25 L15 -18 L17 -14 L15 -8 L-13 -7 Z','#aab8c2',ink,1.9);
  shape(c,'M-15 -28.5 L-10.7 -23 L-13.5 -22 Z M-3 -30.4 L-2.5 -23.3 L-6.7 -23 Z M8.7 -29.2 L8 -22.8 L4.4 -22.8 Z','#e6efeb',null);
  shape(c,'M-15 -19.8 L13.5 -21 L16 -16.8 L14.8 -9 L11 -6.6 L-11 -6.6 L-16 -9 Z','#445e70');
  shape(c,'M-12 -19 L-9 -19 L-11 -15.5 L-14 -15.2 Z M-7 -19.2 L-4 -19.4 L-6.3 -15.9 L-9.1 -15.7 Z M8 -20 L11 -20.1 L9.2 -16.9 L6.4 -16.8 Z','#ffd16c',null);
  shape(c,'M-8 -15.4 Q1 -14.6 10 -16.4 L8.6 -12.3 Q4 -10.7 1 -13.1 Q-2 -10.4 -6.4 -11.8 Z','#182734',ink,1);
  shape(c,'M-6 -14.2 L-.5 -13.5 L-4 -12.5 Z M2.7 -13.7 L8.4 -15 L6.5 -12.9 Z','#ff965c',null);
 }

 const bodies={cocoa,marker,peach:token,shield:ticket,crown:conductor,spike};
 function drawCritter(c,type,x,soleY,{phase=0,facing=1,flipped=false}={}){
  const stride=Math.sin(phase);
  c.save();c.translate(x,soleY);c.scale(facing<0?-1:1,1);
  c.lineJoin='round';c.lineCap='round';
  if(flipped){c.translate(0,-16);c.rotate(Math.PI);c.translate(0,16)}
  for(const side of [-1,1]){
   const xx=side*(7+stride*2.2), yy=-.6-Math.max(0,side*stride)*1.8;
   c.beginPath();c.moveTo(side*7,-8.8);c.lineTo(xx-.5,yy-4.4);
   c.lineWidth=3.2;c.strokeStyle=ink;c.stroke();shoe(c,xx,yy);
  }
  c.translate(0,-Math.abs(stride)*.75);
  (bodies[type]||cocoa)(c);c.restore();
 }
 globalThis.SubwayCrew=Object.freeze({drawCritter});
})();
