/* Horizontal physics for Parallax Run only; jump gravity remains in the fight engine. */
(function(g){'use strict';const tuning={maxSpeed:250.1928,acceleration:620,brake:1050,friction:1800,slideFriction:1600,airAcceleration:190,airBrake:300,crawlSpeed:125};const approach=(v,target,amount)=>v<target?Math.min(target,v+amount):Math.max(target,v-amount);
function create(){return{vx:0,sliding:false}}
function step(s,input,airborne,dt,stunned=false){const cap=tuning.maxSpeed*(input.boost?2:1),accel=tuning.acceleration*(input.boost?2:1),d=(input.right?1:0)-(input.left?1:0),v=s.vx;dt=Math.max(0,Math.min(.05,dt));if(stunned){s.vx=approach(v,0,tuning.brake*dt)}else if(airborne){if(d)s.vx=approach(v,d*cap,(v*d<0?tuning.airBrake:tuning.airAcceleration)*dt); // releasing direction keeps every bit of takeoff speed
}else if(d&&v*d<0){s.vx=approach(v,0,tuning.brake*dt)}else if(input.duck){s.vx=Math.abs(v)>tuning.crawlSpeed||!d?approach(v,0,tuning.slideFriction*dt):approach(v,d*tuning.crawlSpeed,accel*dt)}else if(d){s.vx=approach(v,d*cap,accel*dt)}else s.vx=approach(v,0,tuning.friction*dt);
s.boost=!!input.boost;s.sliding=!airborne&&Math.abs(s.vx)>35&&(!!input.duck||!d||d*s.vx<0);return s.vx*dt;}
const api={create,step,tuning};if(typeof module!=='undefined')module.exports=api;g.GSRunnerMomentum=api;})(typeof window!=='undefined'?window:globalThis);
