/* Coordinates are in fixed game units. Generated ledges are optional detours:
   the tested floor gaps, checkpoint floors, and finish approaches stay intact. */
(() => {
'use strict';
const floorRuns=[[0,866],[953,1614],[1705,2376],[2481,3108],[3219,3906],[4020,4970]];
const bridges=[[580,259,115],[1180,267,135],[1860,258,106],[2750,256,115],[3450,267,104],[3610,211,102],[4260,259,122]];
const blockSet=[[275,'wood'],[311,'disc'],[347,'wood'],[1120,'wood'],[1480,'wood'],[1990,'disc'],[2026,'wood'],[2260,'wood'],[2860,'wood'],[2896,'disc'],[3290,'wood'],[3750,'wood'],[4180,'disc'],[4460,'wood']];
const patrols=[
 ['cocoa',571,472,675],['marker',795,720,824],
 ['cocoa',1375,1280,1450],['crown',1580,1470,1584],
 ['crown',1828,1760,1910],['marker',2160,2080,2230],
 ['peach',2680,2550,2720],['shield',3020,2920,3050],
 ['marker',3420,3335,3470],['peach',3650,3520,3675],['shield',3844,3760,3870],
 ['peach',4330,4260,4400],['shield',4515,4410,4560]
];
const saves=[65,1733,3246];
const allNotes=[[170,292],[220,269],[594,216],[632,209],[672,216],[856,267],[908,232],[961,267],[1220,228],[1260,221],[1490,282],[1620,259],[1660,237],[1700,259],[1880,215],[1922,216],[2325,279],[2400,245],[2440,236],[2483,256],[2770,211],[2812,205],[3113,249],[3167,228],[3211,249],[3472,222],[3634,172],[3670,171],[3910,245],[3970,226],[4020,249],[4290,214],[4334,211],[4600,285],[4650,267]];

const highway={theme:'highway',finish:4740,endX:4970,floorRuns,bridges,blockSet,patrols,saves,allNotes};
const subway={
 theme:'subway',finish:4110,endX:4300,
 floorRuns:[[0,770],[862,1500],[1600,2250],[2356,3075],[3175,3630],[3720,4300]],
 bridges:[[308,256,148],[505,184,118],[980,263,148],[1205,197,145],[1704,258,135],[1910,188,130],
  [2435,258,142],[2635,190,135],[3245,261,153],[3445,191,120],[3795,258,133]],
 blockSet:[[181,'wood'],[217,'disc'],[555,'disc',65],[1160,'wood'],[1430,'disc'],[1860,'wood'],
  [1960,'disc',70],[2595,'wood'],[2810,'disc'],[3414,'wood'],[3855,'disc',139]],
 patrols:[['cocoa',390,328,485],['marker',687,610,720],['crown',1070,958,1140],['peach',1345,1250,1400],
  ['spike',1815,1750,1880],['marker',2110,2020,2180],['shield',2550,2450,2610],['cocoa',2790,2710,2880],
  ['spike',3370,3275,3415],['peach',3548,3495,3575],['crown',3870,3790,3920]],
 saves:[65,1638,3208],
 allNotes:[[120,292],[327,224],[382,208],[435,224],[532,152],[584,148],[753,258],[812,226],[874,258],
  [1004,225],[1055,217],[1240,155],[1300,156],[1485,259],[1550,231],[1612,261],[1730,222],
  [1935,151],[1995,145],[2225,258],[2300,229],[2370,257],[2460,222],[2514,213],[2670,153],
  [2730,152],[3055,257],[3125,228],[3190,257],[3290,221],[3480,151],[3530,150],[3620,259],
  [3675,227],[3732,256],[3945,286],[4055,269],[4108,239]]
};
function routeFor(leg,random=Math.random){
 const base=leg%2===0?highway:subway;
 if(leg<2)return base;
 // Shift each elevated section as a group, so upper notes and disc boxes
 // keep their relationship to its platforms and every landing stays reachable.
 const route={...base,bridges:[],allNotes:base.allNotes.filter(n=>n[1]>=230),blockSet:base.blockSet.filter(b=>b.length<3)};
 for(let i=0;i<base.bridges.length;i++){
  const [x,y,w]=base.bridges[i],shift=Math.round((random()-.5)*64);
  const floor=base.floorRuns.find(([left,right])=>x>=left&&x+w<=right);
  if(!floor)continue;
  const ledgeX=Math.max(floor[0]+12,Math.min(floor[1]-w-12,x+shift));
  const top=y+Math.round((random()-.5)*18);
  // Leave clear headroom over each randomized landing, even near an old box.
  route.blockSet=route.blockSet.filter(([bx,kind,by=218])=>
   !(bx<ledgeX+w+6&&bx+36>ledgeX-6&&by<top+2&&by+36>top-62));
  route.bridges.push([ledgeX,top,w]);
  route.allNotes.push([ledgeX+w*.3,top-38],[ledgeX+w*.72,top-45]);
  if(i%3===leg%3)route.blockSet.push([Math.round(ledgeX+w*.5-18),'disc',top-118]);
 }
 return route;
}
globalThis.CDRoutes={routeFor};
})();
