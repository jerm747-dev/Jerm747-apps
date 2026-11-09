// Feet positions are world coordinates; platforms are solid only on descent.
export const WIDTH = 900;
export const PLATFORMS = Array.from({length:16}, (_,i) => ({
 x:[70,280,490,640,430,220,60,270,480,640,430,220,60,270,480,620][i],
 y:1850-i*108, w:i===0?260:i===15?230:185, checkpoint:i%4===0, goal:i===15
}));
const mediumSteps = [
 [70,300,0],[345,190,100],[635,180,120],[380,165,140],[90,220,105],
 [330,145,145],[650,165,120],[390,175,140],[100,220,110],
 [390,160,135],[650,150,150],[360,170,110],[75,225,140],
 [335,145,145],[635,165,120],[375,160,155],[80,220,100],
 [330,145,150],[655,165,125],[390,165,145],[100,225,110],
 [375,185,125],[640,185,100],[405,195,90],[165,220,80],[460,320,75]
];
let elevation=3300;
export const MEDIUM_PLATFORMS=mediumSteps.map(([x,w,rise],i)=>({x,w,y:(elevation-=rise),checkpoint:i%4===0,goal:i===mediumSteps.length-1}));
export const JOURNEY_ROUTES={
 easy:{label:'Easy',platforms:PLATFORMS,bottom:1980,speed:260,jump:590,gravity:1150,acceleration:Infinity,scoreGame:'follow-kiana'},
 medium:{label:'Medium',platforms:MEDIUM_PLATFORMS,bottom:3460,speed:300,jump:640,gravity:1050,acceleration:1600,scoreGame:'follow-kiana-medium'}
};
// Crosswind is gentle (at most 22 world units/s), only affects airborne Medium runners.
export function journeyWind(mode,y,time){
 const cfg=JOURNEY_ROUTES[mode||'easy'];
 const altitude=Math.max(0,Math.min(1,(cfg.platforms[0].y-y)/(cfg.platforms[0].y-cfg.platforms.at(-1).y)));
 return 22*Math.max(0,(altitude-.25)/.75)*Math.sin(time*.55+.8);
}
export function createRunner(mode='easy'){
 const cfg=JOURNEY_ROUTES[mode]||JOURNEY_ROUTES.easy;
 return {mode:cfg===JOURNEY_ROUTES.medium?'medium':'easy',x:cfg.platforms[0].x+70,y:cfg.platforms[0].y,vx:0,vy:0,ground:0,highest:0,checkpoint:0,won:false,elapsed:0,prepare:0,prepareAge:0,jumpAge:-1,landingAge:-1,coyote:.1,jumpBuffer:0};
}
export function resetRunner(p){const r=JOURNEY_ROUTES[p.mode||'easy'].platforms[p.checkpoint];Object.assign(p,{x:r.x+40,y:r.y,vx:0,vy:0,ground:p.checkpoint,prepare:0,prepareAge:0,jumpAge:-1,landingAge:-1,coyote:.1,jumpBuffer:0});}
export function advanceRunner(p,input,dt,haptics){
 if(p.won)return;
 const cfg=JOURNEY_ROUTES[p.mode||'easy'],platforms=cfg.platforms,wasGrounded=p.ground>=0;
 dt=Math.min(dt,1/30);p.elapsed=(p.elapsed||0)+dt;
 if(input.jump){p.jumpBuffer=.14;input.jump=false;if(p.ground>=0||p.coyote>0){p.prepare=.05;p.prepareAge=0;}}else p.jumpBuffer=Math.max(0,p.jumpBuffer-dt);
 if(p.prepare>0){p.prepareAge+=dt;p.prepare=Math.max(0,p.prepare-dt);}
 if(p.jumpAge>=0)p.jumpAge+=dt;
 if(p.landingAge>=0)p.landingAge+=dt;
 p.coyote=p.ground>=0?.1:Math.max(0,p.coyote-dt);
 const target=((input.right?1:0)-(input.left?1:0))*cfg.speed,change=cfg.acceleration*dt;
 p.vx=Number.isFinite(change)?p.vx+Math.max(-change,Math.min(change,target-p.vx)):target;
 if(p.jumpBuffer>0 && p.coyote>0 && p.prepare<=0){p.vy=-cfg.jump;p.ground=-1;p.jumpAge=0;p.landingAge=-1;p.coyote=0;p.jumpBuffer=0;haptics?.pulse('jump');}
 const oldY=p.y;
 p.x=Math.max(15,Math.min(WIDTH-15,p.x+(p.vx+(p.mode==='medium'&&p.ground<0?journeyWind(p.mode,p.y,p.elapsed):0))*dt));p.vy+=cfg.gravity*dt;p.y+=p.vy*dt;p.ground=-1;
 if(p.vy>=0){for(let i=0;i<platforms.length;i++){const r=platforms[i];if(oldY<=r.y+.5&&p.y>=r.y&&p.x+13>r.x&&p.x-13<r.x+r.w){if(!wasGrounded&&p.vy>140){p.landingAge=0;p.jumpAge=-1;if(!r.goal)haptics?.pulse('land');}p.y=r.y;p.vy=0;p.ground=i;p.highest=Math.max(i,p.highest);if(r.checkpoint)p.checkpoint=Math.max(i,p.checkpoint);if(r.goal)p.won=true;break;}}}
 if(p.y>cfg.bottom || p.y>platforms[p.checkpoint].y+300)resetRunner(p);
}

export function runnerMotion(p){
 if(p.prepare>0)return {phase:'prepare',time:p.prepareAge};
 if(p.ground<0)return {phase:p.vy<0?'rise':'descend',time:p.jumpAge,vy:p.vy};
 if(p.landingAge>=0&&p.landingAge<.18)return {phase:'land',time:p.landingAge};
 return null;
}
